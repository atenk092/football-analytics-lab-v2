# Football Analytics Lab

Aplikasi analisis sepak bola berbasis web yang dapat dipasang sebagai PWA dan dibungkus menjadi Android APK melalui GitHub Actions.

## Fitur
- Kalkulator probabilitas Poisson dengan koreksi Dixon-Coles.
- Pasar 1X2, double chance, total gol, team totals, handicap dasar, BTTS, odd/even, dan correct score.
- Estimasi lambda otomatis dari hasil historis yang diimpor.
- Walk-forward backtesting dan simulasi ROI dari odds historis.
- Fractional Kelly dengan batas risiko bankroll.
- Bet Tracker, Full Backup & Restore, validasi CSV.
- Model live manual.
- Netlify Function sebagai proxy aman untuk API-Football (API key hanya di server).

## API-Football: konfigurasi aman

Proxy tersedia di `/.netlify/functions/football?action=...`. Jangan pernah menaruh API key di kode frontend, APK, atau repository.

1. Buat akun di [API-Football](https://www.api-football.com/) dan salin API key dari dashboard.
2. Di Netlify, buka **Site configuration → Environment variables**.
3. Tambahkan `API_FOOTBALL_KEY` dengan nilai API key. Opsional: tambahkan `APP_ORIGIN` dengan URL situs Netlify, misalnya `https://nama-situs.netlify.app`, untuk membatasi origin web.
4. Deploy ulang situs agar fungsi menerima environment variable.
5. Uji endpoint status melalui `/.netlify/functions/football?action=leagues&season=2025` (hasil bergantung cakupan paket).

Action proxy yang tersedia:
- `leagues` — `country`, `season`, `search`, dll.
- `teams` — wajib `league` dan `season`.
- `fixtures` — gunakan salah satu filter seperti `date`, `league`, `team`, `live=all`, atau `id`.
- `events` — wajib `fixture`.
- `statistics` — wajib `fixture`.
- `odds` — wajib filter `fixture`, `league`, atau `date`.
- `liveOdds` — odds in-play.

Contoh: `/.netlify/functions/football?action=fixtures&date=2026-11-21&timezone=Asia%2FJakarta`.

Paket gratis API-Football memiliki kuota 100 request/hari. Karena itu aplikasi harus memakai refresh manual/terbatas dan cache; jangan menjalankan polling tiap menit sepanjang hari pada paket gratis. Periksa dashboard dan dokumentasi provider untuk kuota, musim, liga, serta ketersediaan bookmaker sebelum mengandalkan feed. Proxy mengizinkan origin web yang dikonfigurasi dan origin localhost Capacitor; request tanpa origin tetap dapat digunakan oleh klien native.

## Jalankan lokal
```bash
npm install
npm run dev
```

## Build Android
Workflow **Actions → Build Android APK**. Setelah selesai, unduh artifact bernama `football-analytics-lab-debug-apk`.

APK debug untuk uji coba/pribadi. Distribusi publik memerlukan signing release key.

## Data dan model
Hasil historis diimpor dari CSV dengan kolom `date, home_team, away_team, home_goals, away_goals`; kolom `league` dan odds opsional. Database 10 tahun belum disertakan otomatis; pengguna perlu mengimpor dataset yang tersedia dan berlisensi. Data lokal tersimpan di perangkat/browser; gunakan Full Backup secara berkala.

Probabilitas adalah estimasi matematis, bukan jaminan keuntungan. Backtest hanya bermakna bila dataset dan odds historis memadai. API-Football menyediakan data jadwal, event, statistik, dan odds sesuai cakupan paket; data provider bukan pengganti evaluasi model sendiri.
