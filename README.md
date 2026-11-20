# Football Analytics Lab

Aplikasi analisis sepak bola berbasis web yang dapat dipasang sebagai PWA dan dibungkus menjadi Android APK melalui GitHub Actions.

## Fitur MVP
- Kalkulator probabilitas Poisson untuk skor, 1X2, dan total gol.
- Kalkulator EV dan Kelly.
- Input pertandingan manual dan penyimpanan lokal pada perangkat.
- Impor CSV sederhana dan ekspor data CSV.
- Tampilan responsif untuk Android.
- Workflow GitHub Actions untuk membangun APK debug.

## Jalankan lokal
```bash
npm install
npm run dev
```

## Build Android
Workflow **Actions → Build Android APK → Run workflow**. Setelah selesai, unduh artifact bernama `football-analytics-lab-debug-apk`.

APK debug hanya untuk uji coba / instalasi pribadi. Untuk distribusi publik atau Play Store, perlu signing release key.

## Catatan data dan model
Versi awal menghitung probabilitas dengan Poisson independen berdasarkan lambda home/away yang dimasukkan manual. Ini bukan prediksi terkalibrasi dan belum menggunakan database historis, Dixon-Coles, Elo, xG, atau data odds/API otomatis. Hasil adalah estimasi matematis, bukan jaminan keuntungan.

Data pertandingan disimpan di browser/perangkat (localStorage) dan belum tersinkron ke server. Buat cadangan dengan ekspor CSV.

## Rencana tahap berikutnya
1. Import Engine dan validasi dataset.
2. Database historis SQLite/backend.
3. Model Dixon-Coles + Elo dan evaluasi out-of-sample.
4. API fixture/hasil/odds dengan pencatatan timestamp.
5. Live data collector dan dashboard performa.
