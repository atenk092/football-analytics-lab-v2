# Football Analytics Lab

Aplikasi analisis sepak bola berbasis web yang dapat dipasang sebagai PWA dan dibungkus menjadi Android APK melalui GitHub Actions.

## Fitur MVP
- Kalkulator probabilitas Poisson untuk skor, 1X2, dan total gol.
- Kalkulator EV dan Kelly.
- Input pertandingan manual dan penyimpanan lokal pada perangkat.
- Impor/ekspor CSV untuk analisis tersimpan.\n- Impor hasil historis (home/away goals) dengan header standar dan Football-Data (FTHG/FTAG).\n- Estimasi lambda awal dari performa kandang/tandang pada dataset yang diimpor (minimal 20 pertandingan; idealnya lebih banyak).
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

Data analisis dan hasil historis yang diimpor disimpan di browser/perangkat (localStorage) dan belum tersinkron ke server. Impor data historis menggunakan kolom `date`, `home_team`, `away_team`, `home_goals`, `away_goals`; kolom `league` opsional. Format Football-Data `FTHG`/`FTAG` juga didukung. Template tersedia di `public/templates/historical_matches_template.csv`. Data historis 10 tahun belum disediakan otomatis; pengguna perlu mengimpor dataset berlisensi/tersedia. Buat cadangan dengan ekspor CSV.

## Rencana tahap berikutnya
1. Import Engine dan validasi dataset.
2. Database historis SQLite/backend.
3. Model Dixon-Coles + Elo dan evaluasi out-of-sample.
4. API fixture/hasil/odds dengan pencatatan timestamp.
5. Live data collector dan dashboard performa.
