# Recloser Research — Tahap 1

## Backend

Pakai venv `rec/` yang sudah ada di direktori kerja.

```
"D:\Penelitian\program pengujian\Pengujian_penelitian\rec\Scripts\python.exe" -m pip install -r "D:\Penelitian\program pengujian\Pengujian_penelitian\recloser-research-web\backend\requirements.txt"
```

Jalankan (PYTHONPATH menunjuk ke folder `backend/`):

```
$env:PYTHONPATH = "D:\Penelitian\program pengujian\Pengujian_penelitian\recloser-research-web\backend"
& "D:\Penelitian\program pengujian\Pengujian_penelitian\rec\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Frontend

Butuh Node.js (belum terpasang di mesin ini).

```
cd "D:\Penelitian\program pengujian\Pengujian_penelitian\recloser-research-web\frontend"
npm install
npm run dev
```

Buka http://localhost:5173/.
