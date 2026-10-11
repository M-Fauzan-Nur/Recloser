# Tahap Final Validation Report — IEEE 69 Bus Research Website

- Date: 2026-09-24
- Backend: uvicorn app.main:app @ http://127.0.0.1:8000
- Frontend: Vite build artifacts under `recloser-research-web/frontend/dist/`

## Summary

| Item | Status |
|---|---|
| a. Dataset (A–E) | **PASS** — semua skenario 4080 baris |
| b. LSTM (A–E) | **PASS** — cached_csv, data_rows_used=4080 |
| c. ABC Optimization | **PASS** — parameter riset, fitness match |
| d. Results | **PASS** — rekap tersedia via ResultsOverview |
| e. Input Data Gangguan | **PASS** — CRUD lengkap dengan field benar |
| f. `npm run build` | **PASS** — exit 0, 39 modul |
| g. Endpoint testing | **30/30 PASS** |
| h. SHA256 | **PASS — 27/27 file identik** |
| i. Regresi A–E | **150/150 leaf PASS** (5/5 skenario) |
| j. File berubah | Tidak ada (Tahap 10 murni validasi) |
| k. Algoritma asli | Tidak berubah (verified via SHA256) |

## a. Status Dataset

`GET /api/scenarios/{a..e}/dataset` untuk semua 5 skenario:

| Sk | File | total_rows |
|---|---|---|
| A | system_dataset_scenario_a.csv | **4080** |
| B | system_dataset_b.csv | **4080** |
| C | system_dataset_c.csv | **4080** |
| D | system_dataset_d.csv | **4080** |
| E | system_dataset_e.csv | **4080** |

Catatan: `scenarios.py` `lstm_dataset["a"]` = `system_dataset_scenario_a.csv` (Tahap 7) — bukan `system_dataset_latest_scenario_a.csv`. B–E memakai `system_dataset_<id>.csv`.

## b. Status LSTM

`POST /api/scenarios/{a..e}/lstm/predict` untuk semua 5 skenario:

| Sk | source | data_rows_used | total_rows |
|---|---|---|---|
| A | cached_csv | **4080** | 68 |
| B | cached_csv | **4080** | 68 |
| C | cached_csv | **4080** | 68 |
| D | cached_csv | **4080** | 68 |
| E | cached_csv | **4080** | 68 |

- Algoritma LSTM **tidak diubah** — terintegrasi lewat `importlib` dari `lstm_train.py`.
- Tidak ada training model/scaler baru. `cached_csv` jalur dipakai karena `backend/lstm_artifacts/<id>/{model.keras, scaler.pkl}` tidak ada — konsisten dengan Tahap 3.
- Threshold kategori risiko (RENDAH <0.2, SEDANG <0.5, TINGGI <0.8, KRITIS) tetap dipakai lstm_integration.py untuk data contoh.

## c. Status ABC

- `POST /api/scenarios/a/abc/optimize` mengembalikan parameter riset asli (diverifikasi via curl):
  - `num_reclosers = 4`
  - `colony_size = 100`
  - `max_iterations = 30`
  - `W_SAIDI = 0.3`, `W_SAIFI = 0.3`, `W_RISK = 0.4`
  - `RANDOM_SEED = 42`
  - `MAX_PROTECTED_FRACTION = 0.65`, `MAX_ZONE_OVERLAP = 0.2`
  - `PENALTY_PROXIMITY_COEF = 8.0`, `PENALTY_ZONE_SIZE_COEF = 3.0`, `RISK_SCALE = 1000.0`
- Algoritma ABC **tidak diubah** — `abc_integration.py` memakai `importlib` untuk mengakses `RecloserOptimizer`, konstanta, `_kategori_risiko` dari `abc_Multirecloser.py`.
- Validasi via `validate_tahap5.ps1`: **150/150 leaf comparison lulus** untuk A–E (fitness, baseline SAIDI/SAIFI, optimal, positions, improvements — semua identik dengan `abc_{a..e}.json` referensi Tahap 4).

### Hasil ABC per skenario (Tahap 10 vs referensi Tahap 4)

| Sk | Fitness | Baseline SAIDI | Optimal SAIDI | Baseline SAIFI | Optimal SAIFI | Positions |
|---|---|---|---|---|---|---|
| A | 0.176407 | 2040.1802 | 539.8920 | 135.5197 | 43.7973 | line_27, line_52, line_35, line_9 |
| B | 0.156040 | 1726.2614 | 386.7628 | 130.7795 | 38.6923 | line_27, line_52, line_35, line_9 |
| C | 0.155680 | 2019.9756 | 472.4125 | 138.0505 | 39.3240 | line_27, line_52, line_35, line_9 |
| D | 0.233098 | 1574.9251 | 637.5533 | 127.7563 | 47.5198 | line_27, line_52, line_35, line_9 |
| E | 0.218291 | 145.4817 | 53.1418 | 68.4782 | 24.7984 | line_27, line_52, line_35, line_9 |

Catatan: User menyebutkan posisi `line_9, line_27, line_35, line_52` — himpunan posisi identik (cuma berbeda urutan tampilan, yang bukan perubahan hasil sesuai instruksi user).

## d. Status Results

- `<ResultsOverview />` terpasang di `App.jsx` ketika `viewMode === 'results'`.
- Membaca `abcCache` (App-level) yang diisi dari POST `/abc/optimize` atau dari "Run Optimization" di `ScenarioView`.
- Tabel rekap menampilkan: baseline SAIDI/SAIFI, optimal SAIDI/SAIFI, improvement %, total system risk, remaining risk, fitness, positions.
- Empty state jika cache kosong (tautan "open ABC first" ke menu ABC Optimization).
- Tidak terjadi training ulang otomatis.

## e. Status Input Data Gangguan

Endpoint `GET/POST/PUT/DELETE /api/manual-faults` + `/stats` lulus:

### CRUD lifecycle lengkap
| Langkah | Hasil |
|---|---|
| a) GET initial | HTTP 200, total=0 |
| b) POST (Cuaca/Petir) | HTTP 201, id, faktor=Cuaca, penyebab=Petir, source=manual |
| c) GET ulang | HTTP 200, total=1 |
| d) PUT (ganti ke Peralatan/Kerusakan isolator) | HTTP **200** |
| e) GET ulang | HTTP 200, update tercermin |
| f) DELETE | HTTP 200, `{deleted: <id>}` |
| g) GET ulang | HTTP 200, total=0 |

### Field & validasi
- **Tidak ada** field `pola_gangguan` maupun `kategori_risiko` di input manual — skema backend `manual_faults.py` tetap menggunakan `faktor_penyebab` + `penyebab_gangguan`. POST dengan `pola_gangguan` schema lama → **422** (validasi eksplisit).
- Field form (frontend): `line_id`, `timestamp`, `fault_type`, `faktor_penyebab` (dropdown Cuaca/Peralatan/Hewan/Risiko), `penyebab_gangguan` (dropdown cascading mengikuti faktor), `description`, `reported_by`, `affected_customers`, `duration_hours` (satuan jam). Tidak ada `pola_gangguan` atau `kategori_risiko`.
- Validasi Pydantic (422 untuk semua kasus salah):
  - `line_id=99` → 422 "must be between 1 and 68"
  - `faktor_penyebab="X"` → 422 "must be one of ('Cuaca', 'Peralatan', 'Hewan', 'Risiko')"
  - Cuaca + Kerusakan isolator (penyebab tidak cocok faktor) → 422 "not valid for faktor 'Cuaca'"
  - `duration_hours=-1` → 422
  - `timestamp="x"` → 422
- DELETE id nonexistent → **404**.
- CORS preflight (OPTIONS) untuk PUT/DELETE: `access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS`.

### Penyimpanan & isolasi
- Data tersimpan di `recloser-research-web/backend/data/manual_faults.json` via atomic write (Pydantic + `threading.Lock` + `os.replace`).
- `source="manual"` otomatis disetel server-side; tidak bisa diisi oleh klien.
- Tidak ada kode di `manual_faults.py` yang membaca/menulis CSV riset atau memanggil `/lstm/predict`/`/abc/optimize`.

## f. Hasil `npm run build`

```
> recloser-research-frontend@0.1.0 build
> vite build

vite v5.4.21 building for production...
transforming...
✓ 39 modules transformed.
dist/index.html                   0.46 kB │ gzip:  0.30 kB
dist/assets/index-mu3VmYKn.css    4.32 kB │ gzip:  1.42 kB
dist/assets/index-BNBGuDUz.js   168.17 kB │ gzip: 51.45 kB
✓ built in 1.04s
```
- **Exit code: 0**
- 39 modul ditransformasi (sama dengan build terakhir — tidak ada file baru/dihapus).

## g. Hasil endpoint testing

### Regression (via `validate_tahap5.ps1`)

| Endpoint | Expected | Actual |
|---|---|---|
| GET / | 200 | 200 ✓ |
| GET /api/dashboard | 200 | 200 ✓ |
| GET /api/scenarios | 200 | 200 ✓ |
| GET /api/scenarios/{a..e} | 200 | 5/5 ✓ |
| GET /api/scenarios/{a..e}/prediction | 200 | 5/5 ✓ |
| GET /api/scenarios/{a..e}/dataset | 200 | 5/5 ✓ |
| GET /api/scenarios/{a..e}/latest | 200 | 5/5 ✓ |
| POST /api/scenarios/{a..e}/lstm/predict | 200 | 5/5 ✓ |
| POST /api/scenarios/z/lstm/predict | 404 | 404 ✓ |
| POST /api/scenarios/z/abc/optimize | 404 | 404 ✓ |

**Total: 30/30 PASS.**

### Manual-faults CRUD (Tahap 10 khusus)
Lulus semua langkah a–g + 5 validasi 422 + DELETE 404. CORS preflight OPTIONS untuk PUT/DELETE → **200** dengan header lengkap.

### Negative & edge cases
- `GET /api/scenarios/{nonexistent}/lstm/predict` → 500 dengan pesan (sesuai desain; `IntegrationError` dari wrapper). Bisa diperketat jadi 404 tapi Tahap 1–9 tetap lulus, tidak diubah.
- `GET /api/scenarios/{nonexistent}/prediction` → 404 (sudah ada di validate_tahap5).

## h. Hasil SHA256 (27 file penelitian asli)

PowerShell snapshot diambil sebelum dan sesudah validasi runtime. Hasil:

```
PASS: 0 differences among 27 research files.
```

Semua `*.py` & `*.csv` di `scenario_a_website/`, `scenario_b/`, `scenario_c/`, `scenario_d/`, `scenario_e/` (termasuk `lstm_train.py`, `abc_Multirecloser.py`, `data_generate.py`, `merge_data.py`, `split_tahun.py`, `kurva_lambda_a.py`, semua CSV) **byte-identik** sebelum vs sesudah eksekusi.

## i. Hasil regresi Scenario A–E

`validate_tahap5.ps1` membandingkan 30 leaf field per skenario antara POST `/abc/optimize` Tahap 10 dan `abc_{a..e}.json` referensi Tahap 4:

| Sk | Leaves | Isolation | Positions | Fitness ref vs new | Fitness match |
|---|---|---|---|---|---|
| A | **30/30 PASS** | True | True | 0.176407 == 0.176407 | ✓ |
| B | **30/30 PASS** | True | True | 0.156040 == 0.156040 | ✓ |
| C | **30/30 PASS** | True | True | 0.155680 == 0.155680 | ✓ |
| D | **30/30 PASS** | True | True | 0.233098 == 0.233098 | ✓ |
| E | **30/30 PASS** | True | True | 0.218291 == 0.218291 | ✓ |

**150/150 leaf comparisons PASS.** Tidak ada drift hasil riset.

## j. Daftar file yang berubah

**Tidak ada.** Tahap 10 adalah validasi murni — tidak menyentuh kode apa pun. Setiap perubahan kode pada file `ManualFaults.jsx`, `manual_faults.py`, `main.py`, `scenarios.py`, `App.jsx`, `Sidebar.jsx`, `App.css` yang dibutuhkan sudah selesai di Tahap 9.

File yang dibuat hanya untuk dokumentasi:
- `recloser-research-web/backend/tahap_final_validation_report.md` (laporan ini)

File data eksperimen (otomatis dibuat runtime; bukan SHA256 penelitian):
- `recloser-research-web/backend/data/manual_faults.json` — saat ini `[]` setelah cleanup.

## k. Konfirmasi algoritma penelitian asli tidak berubah

| File | Status |
|---|---|
| `scenario_a_website/data_generate.py` | byte-identik |
| `scenario_a_website/lstm_train.py` | byte-identik |
| `scenario_a_website/abc_Multirecloser.py` | byte-identik |
| `scenario_a_website/merge_data.py` | byte-identik |
| `scenario_a_website/split_tahun.py` | byte-identik |
| `scenario_a_website/kurva_lambda_a.py` | byte-identik |
| `scenario_a_website/IEEE_69_bus.csv` | byte-identik |
| `scenario_a_website/system_dataset_*.csv`, `system_dataset_latest_*.csv`, `hasil_prediksi_gangguan_*.csv` | byte-identik (8 file) |
| `scenario_{b,c,d,e}/*.csv` (4 file per skenario) | byte-identik |

**Total: 27 file penelitian SHA256 PASS, 0 perbedaan.**

## Kesimpulan

Website penelitian IEEE 69 Bus recloser-research-web **siap digunakan untuk demonstrasi penelitian** dengan komponen:

1. **Dashboard** — metadata proyek IEEE 69 Bus.
2. **Dataset** — ringkasan 5 skenario × 4080 baris.
3. **LSTM** — cached fault-risk prediction A–E dengan 4080 baris masing-masing (tidak melatih ulang tanpa artefak).
4. **ABC Optimization** — parameter riset + 150 leaf comparison lulus untuk A–E.
5. **Results** — rekap hasil dari cache ABC dengan semua field wajib.
6. **Input Data Gangguan** — CRUD lengkap dengan 9 field, validasi backend yang ketat, isolasi penyimpanan, dan auto-refresh.
7. **Scenario A–E** — masing-masing membuka halaman detail dengan blok dataset + LSTM cached + ABC + tabel zona proteksi.

Konsistensi dengan penelitian asli:
- Tidak ada perubahan pada file `*.py` atau `*.csv` di folder skenario.
- Tidak ada perubahan pada parameter LSTM/ABC.
- Tidak ada perubahan pada rumus SAIDI/SAIFI/risk/fitness.
- Hasil optimasi A–E (fitness, baseline/optimal, positions) identik dengan referensi Tahap 4.
- Data manual terisolasi di `backend/data/manual_faults.json`; tidak memengaruhi cache ABC atau LSTM.

Validasi final dianggap selesai.
