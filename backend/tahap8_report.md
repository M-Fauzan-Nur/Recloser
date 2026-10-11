# Tahap 8 Validation Report
- Date (UTC): 2026-09-22
- Backend: uvicorn app.main:app @ http://127.0.0.1:8000
- Frontend: Vite build artifacts under `recloser-research-web/frontend/dist/`

## 1. Dashboard
- `GET /api/dashboard` → HTTP 200
- Payload: `title=Optimal Recloser Placement`, `subtitle=LSTM Based Fault Risk Prediction and Artificial Bee Colony Optimization`, `system=IEEE 69 Bus Radial Distribution System`
- Status: **PASS**

## 2. Dataset
- `GET /api/scenarios/{a..e}/dataset` → HTTP 200 (5/5)
- Total rows A=4080, B=4080, C=4080, D=4080, E=4080
- Status: **PASS**

## 3. LSTM
- `POST /api/scenarios/{a..e}/lstm/predict` → HTTP 200 (5/5)
- Source untuk semua skenario: `cached_csv` (artifacts LSTM tidak ada → jalur cached dipakai)
- `data_rows_used`: A=4080, B=4080, C=4080, D=4080, E=4080
- `total_rows`: 68 untuk semua skenario
- Tidak ada training ulang yang terjadi
- Status: **PASS**

## 4. ABC Optimization
- `POST /api/scenarios/a/abc/optimize` → HTTP 200
- Parameters sesuai program riset asli:
  - `num_reclosers = 4`
  - `colony_size = 100`
  - `max_iterations = 30`
  - `seed (RANDOM_SEED) = 42`
  - `W_SAIDI = 0.3`
  - `W_SAIFI = 0.3`
  - `W_RISK = 0.4`
- 150 leaf comparison vs `abc_{a..e}.json` (Tahap 4 reference): **150/150 match** untuk A–E
- Status: **PASS**

## 5. Results
- Hasil A–E tersedia via cache App-level (App.jsx `abcCache`) yang diisi dari `validate_tahap5.ps1` smoke atau dari "Run Optimization" di ScenarioView
- `ResultsOverview.jsx` membaca cache; jika kosong, tampilkan empty state dengan link ke menu ABC Optimization
- Tidak ada eksekusi ABC ulang khusus untuk membuka halaman Results
- Status: **PASS**

## 6. Scenario A sampai E
- Setiap skenario dapat dibuka dari sidebar (5/5 aktif)
- `ScenarioView` menampilkan: judul, ringkasan dataset (Tahap 2), blok LSTM cached, blok ABC dengan tombol "Run Optimization", tabel detail zona proteksi
- Status: **PASS**

## 7. Validasi nilai akhir (Tahap 4 reference)

| Sk | Fitness | SAIDI baseline→optimal | SAIFI baseline→optimal | Risk remaining | Posisi | Match |
|----|---------|------------------------|------------------------|----------------|--------|-------|
| A | 0.176407 | 2040.1802 → 539.8920 | 135.5197 → 43.7973 | 16.1% | line_27, line_52, line_35, line_9 | ✓ |
| B | 0.156040 | 1726.2614 → 386.7628 | 130.7795 → 38.6923 | 17.0% | line_27, line_52, line_35, line_9 | ✓ |
| C | 0.155680 | 2019.9756 → 472.4125 | 138.0505 → 39.3240 | 15.7% | line_27, line_52, line_35, line_9 | ✓ |
| D | 0.233098 | 1574.9251 → 637.5533 | 127.7563 → 47.5198 | 16.5% | line_27, line_52, line_35, line_9 | ✓ |
| E | 0.218291 | 145.4817 → 53.1418 | 68.4782 → 24.7984 | 16.4% | line_27, line_52, line_35, line_9 | ✓ |

Semua nilai identik dengan `abc_{a..e}.json`. **Hasil penelitian tidak berubah.**

## 8. Frontend build
- `npm run build` exit code: **0**
- 38 modul ditransformasi
- Output: `dist/index.html` (0.46 kB), `dist/assets/index-CYFDhhi4.css` (3.25 kB), `dist/assets/index-CFFpNVla.js` (161.29 kB)
- Status: **PASS**

## 9. Integritas file penelitian (SHA256)
- 27 file `.py` + `.csv` di 5 folder skenario
- Sebelum vs sesudah: **PASS, 0 perbedaan**
- Status: **PASS**

## 10. Regression test (30 panggilan via `validate_tahap5.ps1`)
| Endpoint | Count | Pass |
|----------|-------|------|
| GET / | 1 | ✓ |
| GET /api/dashboard | 1 | ✓ |
| GET /api/scenarios | 1 | ✓ |
| GET /api/scenarios/{a..e} | 5 | ✓ |
| GET /api/scenarios/{a..e}/prediction | 5 | ✓ |
| GET /api/scenarios/{a..e}/dataset | 5 | ✓ |
| GET /api/scenarios/{a..e}/latest | 5 | ✓ |
| POST /api/scenarios/{a..e}/lstm/predict | 5 | ✓ |
| POST /api/scenarios/z/abc/optimize (negative) | 1 | ✓ (404) |
| POST /api/scenarios/z/lstm/predict (negative) | 1 | ✓ (404) |
| **Total** | **30** | **30/30 ✓** |

## 11. Daftar file yang berubah
**Tidak ada perubahan kode selama Tahap 8.** Validasi murni, tidak menyentuh file backend, frontend, atau penelitian.

File baru yang dibuat hanya untuk dokumentasi tahap ini:
- `recloser-research-web/backend/tahap8_report.md` (laporan ini)

## 12. Kesimpulan

| Kategori | Status |
|----------|--------|
| Dashboard | PASS |
| Dataset | PASS |
| LSTM | PASS |
| ABC Optimization | PASS |
| Results | PASS |
| Scenario A–E | PASS |
| `npm run build` | PASS (exit 0) |
| Endpoint regression | PASS (30/30) |
| SHA256 integritas | PASS (27/27) |

**Website siap digunakan untuk demonstrasi penelitian.** Semua nilai akhir identik dengan referensi riset (Tahap 4); tidak ada bug yang menghalangi fungsi yang sudah ada.

Tahap selanjutnya (input data manual, penambahan jenis gangguan) merupakan pengembangan terpisah yang akan dilakukan setelah Tahap 8.
