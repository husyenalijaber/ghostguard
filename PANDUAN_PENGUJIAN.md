# Panduan Pengujian GhostGuard

Panduan ini memetakan 19 skenario uji (TC-01 sampai TC-19) pada Bab III ke cara menjalankannya, berkas hasil yang perlu disimpan, dan jumlah panggilan Gemini API yang dipakai. Semua hasil disimpan di folder `hasil/` (sudah masuk `.gitignore`, jadi tidak ikut ter-push).

## 0. Persiapan

1. Isi `.env` di komputer sendiri (salin dari `.env.example`), minimal `GEMINI_API_KEY`.
2. Siapkan `data/dataset.csv` dengan format sama seperti `data/contoh_dataset.csv`:
   `id,platform,set,label,teks,gambar`
   - `set`: `uji` (40 sampel: 20 LinkedIn + 20 Instagram) atau `pengembangan` (10 sampel)
   - `label`: 1 = ghost job, 0 = genuine (label final hasil pelabelan peneliti)
   - `teks`: isi iklan LinkedIn; `gambar`: path poster Instagram (beberapa slide dipisah `;`)
3. Labeli dulu semua sampel sebelum menjalankan model (lihat bagian 4, pelabelan ulang).
4. `npm install`, lalu `npm run lint` harus tanpa galat.

## 1. Daftar skenario dan cara uji

| Kode | Skenario | Cara uji | Panggilan API |
|---|---|---|---|
| TC-01 | Genuine, teks LinkedIn | Otomatis lewat TC-11: lihat baris LinkedIn berlabel 0 di `hasil/rincian_v3_uji.csv`. Untuk gambar Bab IV, tempel satu iklan genuine di aplikasi live lalu screenshot. | 0 (pakai hasil TC-11) + 1 untuk screenshot |
| TC-02 | Genuine, poster Instagram | Sama seperti TC-01, baris Instagram berlabel 0. | 0 + 1 |
| TC-03 | Ghost, teks LinkedIn | Baris LinkedIn berlabel 1 yang skornya ≥ 67. | 0 + 1 |
| TC-04 | Ghost, poster Instagram | Baris Instagram berlabel 1 yang skornya ≥ 67. | 0 + 1 |
| TC-05 | Format keluaran JSON | `npm run uji-fungsional` (otomatis). | 1 |
| TC-06 | Waktu respons < 10 detik | `npm run uji-performa` (bagian 3). | 31 per jenis input |
| TC-07 | 10 permintaan bersamaan | Ikut dalam `uji-performa`. | 10 per jenis input |
| TC-08 | Lintas peramban | Manual: buka aplikasi di Chrome, Firefox, Edge. Di tiap peramban: buka halaman, unggah satu poster (cukup sampai pratinjau tampil, tidak perlu analisis), buka Dashboard dan riwayat. Screenshot + catat versi peramban (menu Bantuan > Tentang). | 0 (opsional 1 analisis teks per peramban) |
| TC-09 | Konsistensi skor | `npm run evaluasi -- --data data/dataset.csv --set uji --ulang 3 --ids <10 id>`. Run ke-1 diambil dari cache TC-11. | 20 |
| TC-10 | Input terlalu pendek / tidak terbaca | Teks pendek otomatis lewat `uji-fungsional`. Poster buram: unggah manual satu gambar buram, screenshot. | 0 + 1 |
| TC-11 | Akurasi set uji | `npm run evaluasi -- --data data/dataset.csv --set uji` | 40 |
| TC-12 | Kuota gambar harian | `uji-fungsional` dengan `IMAGE_DAILY_LIMIT=2` sementara. | 2 |
| TC-13 | Kunci API tidak bocor | `uji-fungsional` (halaman, bundle, respons) + cek repositori: `git log -p \| grep -E "AIza\|GEMINI_API_KEY=\"[^\"]"` harus kosong. | 0 |
| TC-14 | Batas laju teks | `uji-fungsional` dengan `TEXT_HOURLY_LIMIT=3` sementara. | 3 |
| TC-15 | Perintah tersembunyi | `uji-fungsional` (otomatis). Screenshot manual bila perlu gambar panel peringatan. | 1 |
| TC-16 | Berkas unggahan tidak valid | `uji-fungsional` (otomatis). Cek juga di UI: ganti nama file .txt jadi .png lalu unggah. | 0 |
| TC-17 | Riwayat di peramban | Manual: jalankan dua analisis (pakai hasil TC-01/TC-03), buka DevTools > Network, pastikan body `/api/analyze-job` tidak berisi riwayat; tekan Hapus riwayat, pastikan daftar kosong. | 0 (pakai analisis yang sudah ada) |
| TC-18 | Pembersihan teks LinkedIn | `uji-fungsional` (otomatis, tanpa API). Untuk syarat "tidak ada red flag tentang jumlah pelamar/lama tayang", cek kolom red flag iklan LinkedIn di `hasil/red_flags_v3_uji.csv`. | 0 |
| TC-19 | Ekspor laporan | Manual: dari salah satu hasil analisis, klik Ekspor Laporan, unduh PDF dan PNG, cocokkan isi dengan panel hasil. | 0 |

## 2. Uji fungsional otomatis (TC-05, 10, 12, 13, 14, 15, 16, 18)

1. Di Vercel > Settings > Environment Variables, ubah sementara:
   `TEXT_HOURLY_LIMIT=3` dan `IMAGE_DAILY_LIMIT=2`, lalu Redeploy. Pastikan kuota bersama `GLOBAL_IMAGE_DAILY_LIMIT` masih tersisa minimal 3 hari itu (atau naikkan sementara), agar yang menolak analisis ke-3 adalah kuota per pengguna.
2. Jalankan:
   ```
   npm run uji-fungsional -- --url https://<alamat-aplikasi> --teks data/contoh_iklan.txt --poster data/poster_contoh.jpg
   ```
3. Kembalikan ke `30` dan `5`, lalu Redeploy.
4. Simpan `hasil/uji_fungsional.json` dan screenshot terminal.

Total ±7 panggilan API. Bila kuota menipis, lewati sebagian: `--lewati TC-12,TC-14`.
Catatan: kuota gambar dihitung per hari, jadi TC-12 hanya bisa diulang keesokan harinya (atau pakai peramban/cookie baru).

## 3. Uji performa (TC-06, TC-07, H3)

Permintaan lewat aplikasi terkena batas IP 40/jam. Satu jenis input memakai 41 permintaan, jadi:
- jalankan teks dan gambar pada jam berbeda, **atau**
- naikkan sementara `IP_HOURLY_LIMIT=100` lalu kembalikan.

```
npm run uji-performa -- --url https://<alamat-aplikasi> --teks data/contoh_iklan.txt
npm run uji-performa -- --url https://<alamat-aplikasi> --gambar data/poster_contoh.jpg
```
Jalankan saat aplikasi sudah "hangat" (buka halaman sekali dulu). Catat region Vercel (Settings > Functions) dan kecepatan internet (speedtest) untuk Bab IV.

## 4. Pelabelan ulang (pengganti validator HRD, tanpa API)

1. Label pertama: labeli 50 sampel (kolom `label`) memakai lima indikator pada Bab III.
2. Tunggu minimal 7 hari. Ambil 20 sampel acak (10 LinkedIn, 10 Instagram), labeli ulang **tanpa melihat label pertama** di kolom `label_ulang`.
3. Hitung Cohen's Kappa antara `label` dan `label_ulang` (target ≥ 0,70). Sampel yang berbeda dibaca ulang, lalu tetapkan label final.
4. Relevansi red flag: untuk tiap red flag di `hasil/red_flags_v3_uji.csv`, isi kolom `relevan_1_atau_0` = 1 bila red flag merujuk informasi yang benar ada/tidak ada di iklan **dan** terkait salah satu dari lima dimensi; selain itu 0.

## 5. Evaluasi prompt dan akurasi (TC-09, TC-11, Bab IV)

Script `evaluasi` memanggil Gemini langsung dari komputer (tidak lewat kuota aplikasi). Semua jawaban disimpan di `hasil/cache.jsonl`, jadi menjalankan ulang tidak memakan API lagi (kecuali `--tanpa-cache`).

| Langkah | Perintah | Panggilan |
|---|---|---|
| Iterasi prompt v0–v3 di set pengembangan | `npm run evaluasi -- --data data/dataset.csv --set pengembangan --prompt v0 --ulang 3` (ulangi untuk v1, v2, v3) | 4 × 10 × 3 = 120 |
| Baseline S0 (prompt v0) di set uji | `... --set uji --prompt v0` | 40 |
| Sistem final B1 (prompt v3) di set uji = TC-11 | `... --set uji` | 40 |
| Konsistensi TC-09 | `... --set uji --ulang 3 --ids U-01,U-05,...` (10 id: 5 LinkedIn, 5 Instagram) | 20 |

Sensitivitas ambang (50/60/67/75) dan bobot rata dihitung dari hasil yang sama, tanpa panggilan tambahan.

## 6. Anggaran panggilan Gemini API

| Kelompok | Panggilan |
|---|---|
| Iterasi prompt (set pengembangan) | 120 |
| S0 + B1 di set uji | 80 |
| Konsistensi TC-09 | 20 |
| Performa teks + gambar | 82 |
| Uji fungsional otomatis | ±7 |
| Screenshot manual (TC-01–04, TC-10, TC-15) | ±6 |
| **Total** | **±315** |

Saran jadwal agar tidak menumpuk dalam satu hari:
- Hari 1: uji fungsional + screenshot (±13)
- Hari 2: iterasi v0 dan v1 (60)
- Hari 3: iterasi v2 dan v3 (60)
- Hari 4: S0, B1, konsistensi (100)
- Hari 5: performa teks dan gambar di jam berbeda (82)

Bila muncul galat 429/503 dari Gemini, tunggu lalu jalankan perintah yang sama lagi: sampel yang sudah berhasil diambil dari cache, hanya yang gagal yang dipanggil ulang. Naikkan jeda dengan `--jeda 4000` bila perlu.

## 7. Yang dikirim balik untuk mengisi Bab IV dan V

- Folder `hasil/` (rincian_*.csv, ringkasan_*.json, red_flags_*.csv, performa_*.json, uji_fungsional.json)
- Lembar pelabelan (label, label_ulang, relevansi red flag)
- Screenshot TC-01–04, 08, 10, 15, 17, 19 (nama perusahaan disamarkan)
- Region Vercel, kecepatan internet saat uji performa, versi peramban, dan tanggal tiap pengujian
