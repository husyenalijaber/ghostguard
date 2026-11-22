# GhostGuard: Deteksi Indikasi Ghost Job Posting

Aplikasi web untuk menilai indikasi ghost job pada iklan lowongan kerja Indonesia dari
**teks LinkedIn** dan **poster Instagram** memakai Gemini API. Aplikasi ini dikembangkan
untuk skripsi *Pengembangan Sistem Deteksi Ghost Job Posting pada Platform Rekrutmen
Digital di Indonesia Berbasis Large Language Model* (Husyen Ali Alhabsy, Informatika Untirta).

## Cara kerja singkat

1. Pengguna menempel teks iklan LinkedIn atau mengunggah 1–5 slide poster Instagram.
2. Backend membersihkan elemen antarmuka LinkedIn, memvalidasi gambar, dan memeriksa kuota.
3. Gemini menilai **lima dimensi** (0–100): deskripsi, identitas, konsistensi, kompensasi, proses.
4. Backend menghitung skor total: `S = 0,25·D1 + 0,20·D2 + 0,20·D3 + 0,20·D4 + 0,15·D5`,
   lalu kategori Rendah (0–33), Sedang (34–66), Tinggi (67–100). Model tidak menentukan skor total.
5. Riwayat pemeriksaan (hasil, teks iklan, dan thumbnail poster yang diperkecil) hanya disimpan di
   Local Storage peramban pengguna, tidak pernah dikirim ke server.

## Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| Backend | Node.js, Express 4 (TypeScript), berjalan sebagai Vercel Function |
| Model | `gemini-3.5-flash-lite` (teks, thinking: minimal), `gemini-3.6-flash` (gambar, thinking: low) |
| Penyimpanan kuota | Upstash Redis (cadangan: memori, hanya untuk lokal) |
| Deployment | Vercel (paket Hobby) |

Struktur penting:

```
lib/analysis.ts        logika inti: prompt v3/v0, model, rumus skor, validasi (dipakai server dan skrip)
server.ts              API Express: /api/analyze-job, /api/quota-status, /api/health
api/[...path].ts       pintu masuk Vercel Function
src/                   antarmuka React
scripts/evaluasi.ts    evaluasi akurasi, konsistensi, sensitivitas (Bab IV)
scripts/uji-performa.ts uji waktu respons dan permintaan bersamaan (H3)
scripts/uji-fungsional.ts uji fungsional otomatis TC-05, 10, 12–16, 18
```

## Menjalankan di komputer sendiri

Butuh Node.js 20 atau lebih baru.

```bash
npm install
cp .env.example .env      # lalu isi GEMINI_API_KEY
npm run dev               # buka http://localhost:3000
```

## Push ke GitHub

```bash
git init
git add .
git status          # pastikan tidak ada .env atau folder data/hasil asli di daftar
git commit -m "GhostGuard"
git branch -M main
git remote add origin https://github.com/<akun>/<repo>.git
git push -u origin main
```

## Deploy ke Vercel

1. Push repositori ke GitHub, lalu import di Vercel (framework: Other; build sudah diatur di `vercel.json`).
2. Di **Project → Settings → Environment Variables**, isi minimal:
   - `GEMINI_API_KEY` (wajib, jangan pernah ditulis di kode atau chat)
   - `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` (wajib di Vercel agar kuota berlaku di semua instance)
   - `AUTH_CHALLENGE_SECRET` (string acak panjang, agar cookie pengguna tetap valid antar deploy)
3. Redeploy, lalu buka `https://<alamat-aplikasi>/api/health`. Hasil yang benar: `{"status":"ok","redis":"ok"}`.

Variabel opsional: `GLOBAL_DAILY_LIMIT` (default 200 analisis/hari), `IP_HOURLY_LIMIT` (default 40/jam),
`PUBLIC_ENABLED=false` (mode pemeliharaan), `VITE_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` (anti-bot).

## Isi paket final

Paket ini menggabungkan versi aplikasi terakhir (yang dipakai untuk uji fungsional dan screenshot Bab IV) dengan
data dan hasil evaluasi akhir. Fitur modal kriteria dari versi lama (ghostguard-fixed) tidak dibawa karena
daftar kriterianya (mis. repost > 90 hari, jumlah karyawan LinkedIn) tidak sesuai dengan lima dimensi pada prompt v3.

```
data/dataset.csv            50 iklan berlabel (set uji 40, set pengembangan 10), tanggal tayang 11–18 Nov 2026
data/label_final.csv        skor rubrik D1–D5, label, URL, tanggal, sesi pelabelan
data/poster/                poster Instagram set uji dan pengembangan
data/uji_performa/          berkas masukan untuk TC-06 dan TC-07
hasil/evaluasi/             cache respons, ringkasan, rincian, konsistensi, relevansi red flag, kappa
hasil/uji_lokal/            hasil uji antarmuka, lintas peramban, performa lokal, uji fungsional Gemini
```

Folder `data/` dan `hasil/` tidak ikut ter-push (lihat `.gitignore`), jadi simpan salinannya sendiri.

## Mengulang angka Bab IV tanpa API

```bash
npm run evaluasi -- --data data/dataset.csv --set uji --cache hasil/evaluasi/cache.jsonl --out hasil/cek
npm run evaluasi -- --data data/dataset.csv --set uji --prompt v0 --cache hasil/evaluasi/cache.jsonl --out hasil/cek
```

Hasil yang benar: S0 akurasi 72,5%, presisi 1,00, recall 0,45, F1 0,62; B1 akurasi 57,5%, F1 0,26.
`GEMINI_BASE_URL` hanya dipakai untuk pengujian lokal dengan server pemutar ulang. Jangan diisi di Vercel.

## Uji performa di Vercel (TC-06 dan TC-07)

Kedua skenario harus dijalankan pada URL produksi dengan model sebenarnya.

1. Pastikan aplikasi sudah jalan di Vercel dan `/api/health` mengembalikan `"status":"ok"`.
   Pakai kunci Gemini dari proyek dengan billing aktif; Free Tier akan menolak permintaan bersamaan (HTTP 503).
2. Naikkan batas sementara di Environment Variables, lalu **Redeploy**:
   `IP_HOURLY_LIMIT=1000`, `TEXT_HOURLY_LIMIT=1000`, `IMAGE_DAILY_LIMIT=100`, `GLOBAL_IMAGE_DAILY_LIMIT=100`, `GLOBAL_DAILY_LIMIT=1000`.
3. Jalankan dari komputer sendiri (biarkan aplikasi idle kira-kira 15 menit sebelumnya agar cold start terukur):

   ```bash
   npm run uji-performa -- --url https://NAMA-APP.vercel.app --teks data/uji_performa/iklan_perf.txt --out hasil/vercel
   npm run uji-performa -- --url https://NAMA-APP.vercel.app --gambar data/uji_performa/poster_perf.jpg --out hasil/vercel
   ```

   Satu jenis masukan memakai 41 panggilan Gemini (1 cold start + 30 berurutan + 10 bersamaan).
4. Baca `hasil/vercel/performa_teks.json` dan `performa_gambar.json`:
   TC-06 lulus bila `p95_detik` < 10; TC-07 lulus bila `galat_500_atau_timeout` = 0.
5. Salin angkanya ke Tabel 28, baris TC-06/TC-07 di Tabel 20, H3 di Tabel 30, Subbab 4.4.1 (rumusan masalah 3),
   Gambar 25, dan Bab V butir 3 (bagian yang ditandai "Menunggu uji Vercel").
6. Kembalikan batas ke nilai produksi (`IP_HOURLY_LIMIT=40`, `TEXT_HOURLY_LIMIT=30`, `IMAGE_DAILY_LIMIT=5`, `GLOBAL_IMAGE_DAILY_LIMIT=5`, `GLOBAL_DAILY_LIMIT=200`) dan Redeploy.

## Keamanan

- Semua rahasia (`GEMINI_API_KEY`, token Redis, `AUTH_CHALLENGE_SECRET`, `TURNSTILE_SECRET_KEY`) hanya dibaca
  server dari environment variable. Tidak ada rahasia di kode atau bundle frontend; hanya variabel berawalan
  `VITE_` yang boleh terlihat publik.
- `.gitignore` mencegah `.env`, `node_modules`, hasil build, folder `hasil/`, dan dataset asli di `data/`
  ikut ter-push. Yang ikut hanya contoh fiktif (`data/contoh_*`).
- Jika kunci pernah tertempel di chat, kode, atau commit, cabut kunci itu di Google AI Studio dan buat yang baru.
- Pesan galat ke pengguna selalu umum; alasan teknis (kunci tidak valid, billing, free tier) hanya dicatat di log Vercel.
- Cookie pengguna `HttpOnly`, ditandatangani HMAC, dan `Secure` di HTTPS. Header `nosniff`, `Referrer-Policy`,
  dan `Permissions-Policy` aktif; respons API tidak di-cache.

## Batas dan kuota

| Batas | Nilai |
|---|---|
| Panjang teks | 50–10.000 karakter |
| Gambar | PNG/JPG/WEBP, maks. 3 MB per berkas, sisi terpanjang maks. 4.096 px, 1–5 slide per analisis |
| Kuota gambar bersama | 5 analisis poster per hari untuk semua pengguna (`GLOBAL_IMAGE_DAILY_LIMIT`) |
| Kuota gambar per pengguna | 5 analisis poster per pengguna per hari (`IMAGE_DAILY_LIMIT`) |
| Batas laju teks | 30 analisis per pengguna per jam |
| Batas per IP | 40 permintaan per jam (`IP_HOURLY_LIMIT`) |
| Batas global | 200 analisis per hari (`GLOBAL_DAILY_LIMIT`) |
| Batas waktu model | 30 detik (teks), 60 detik (gambar) |

Sebelum dikirim, peramban memperkecil poster ke maksimal 2.048 px dan menyimpannya ulang sebagai
JPEG. Ini membuang metadata dan menjaga total kiriman di bawah batas body Vercel (4,5 MB).
Kuota tidak terpotong bila analisis gagal.

## Penghematan token Gemini

| Pengaturan | Nilai | Efek |
|---|---|---|
| Tingkat berpikir | minimal (teks), low (gambar) | token "thinking" jauh lebih sedikit dibanding bawaan Gemini 3 |
| Resolusi media gambar | MEDIUM (`GEMINI_MEDIA_RESOLUTION`) | kira-kira setengah token gambar dibanding HIGH |
| Ukuran poster | diperkecil ke maks. 2.048 px di peramban | kiriman kecil, tanpa metadata |
| Batas keluaran | `maxOutputTokens` 4.096, maks. 5 red flag, penjelasan maks. 3 kalimat | jawaban tidak memanjang |
| Teks LinkedIn | elemen antarmuka dibuang sebelum dikirim | token masukan lebih sedikit |
| Kuota | per pengguna, per IP, global | membatasi biaya harian |

Bila teks poster kecil sering gagal terbaca, ubah `GEMINI_MEDIA_RESOLUTION=HIGH` di Vercel.

## Evaluasi untuk skripsi (Bab IV)

Siapkan `data/dataset.csv` dengan kolom `id,platform,set,label,teks,gambar` (lihat
`data/contoh_dataset.csv`). Path gambar ditulis relatif terhadap file CSV; beberapa slide dipisah `;`.

```bash
# akurasi sistem final (S0) pada 40 sampel uji
npm run evaluasi -- --data data/dataset.csv --set uji
# pembanding zero-shot (B1)
npm run evaluasi -- --data data/dataset.csv --set uji --prompt v0
# konsistensi: 10 iklan uji dijalankan 3 kali (H2)
npm run evaluasi -- --data data/dataset.csv --set uji --ulang 3 --ids U-01,U-03,...
# iterasi prompt pada set pengembangan (Tabel iterasi prompt)
npm run evaluasi -- --data data/dataset.csv --set pengembangan
# performa deployment (H3): 30 berurutan + 10 bersamaan
npm run uji-performa -- --url https://<alamat-aplikasi> --teks data/contoh_iklan.txt
npm run uji-performa -- --url https://<alamat-aplikasi> --gambar data/poster_contoh.jpg
npm run uji-fungsional -- --url https://<alamat-aplikasi> --teks data/contoh_iklan.txt --poster data/poster_contoh.jpg
```

Hasil tersimpan di folder `hasil/`: rincian per iklan (CSV), ringkasan metrik (JSON: confusion matrix,
akurasi, presisi, recall, F1, CI Wilson 95%, Cohen's κ, sensitivitas ambang/bobot, simpangan baku),
dan lembar penilaian relevansi red flag oleh peneliti.

Saat uji performa, naikkan sementara `IP_HOURLY_LIMIT` di Vercel karena 30 + 10 permintaan dari satu IP
akan menyentuh batas default 40 per jam.


Panduan lengkap semua skenario uji, cara menjalankan, dan anggaran panggilan Gemini API ada di `PANDUAN_PENGUJIAN.md`.
