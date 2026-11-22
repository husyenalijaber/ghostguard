#!/usr/bin/env python3
"""Menyusun angka Bab IV (Tabel 21-30) dari file hasil evaluasi.ts.

Dijalankan oleh bab4.sh setelah semua evaluasi offline selesai. Tidak memanggil API.
Keluaran: hasil/LAPORAN_BAB4.md (tabel siap salin ke skripsi).

Semua metrik dihitung oleh evaluasi.ts; skrip ini hanya membaca dan memformat,
kecuali relevansi red flag (dari kolom relevan_1_atau_0 yang diisi peneliti)
dan validitas JSON gabungan (dari kolom json_valid pada file rincian).
"""
import csv
import json
import sys
from pathlib import Path

H = Path(sys.argv[1] if len(sys.argv) > 1 else "hasil")
out = []
p = out.append


def baca(nama):
    f = H / nama
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else None


def rincian(nama):
    f = H / nama
    return list(csv.DictReader(open(f, encoding="utf-8-sig"))) if f.exists() else []


pct = lambda v: f"{v * 100:.1f}%".replace(".", ",")
dec = lambda v, d=2: "tak terdefinisi" if v is None or v != v else f"{v:.{d}f}".replace(".", ",")

p("# Angka Bab IV (dihasilkan otomatis oleh scripts/laporan_bab4.py)\n")
p("Sumber: file di folder hasil/. Angka hanya sah bila data/dataset.csv berisi label FINAL dari peneliti.\n")

# ---------------- Tabel 21: iterasi prompt di set pengembangan
p("## Tabel 21. Iterasi prompt pada 10 sampel pengembangan\n")
p("| Versi | JSON valid (10 sampel x 3 run) | Relevansi red flag | Akurasi 10 sampel (run 1) | Prediksi terisi |")
p("|---|---|---|---|---|")
for v in ["v0", "v1", "v2", "v3"]:
    r = baca(f"pengembangan/ringkasan_{v}_pengembangan.json")
    if not r:
        p(f"| {v} | (belum ada) | | | |")
        continue
    flags = rincian(f"pengembangan/red_flags_{v}_pengembangan.csv")
    nilai = [x["relevan_1_atau_0"] for x in flags if x.get("relevan_1_atau_0", "").strip() in ("0", "1")]
    rel = pct(sum(map(int, nilai)) / len(nilai)) if nilai else "isi kolom relevan_1_atau_0"
    g = r["gabungan"]
    p(f"| {v} | {pct(r['json_valid_persen'])} | {rel} | {pct(g['akurasi'])} | {g['n']} dari {r['jumlah_iklan']} |")
p("")

# ---------------- Tabel 22-24: set uji
s0, b1 = baca("ringkasan_v3_uji.json"), baca("ringkasan_v0_uji.json")
if s0:
    p("## Tabel 22. Confusion matrix sistem final (S0) pada set uji\n")
    p("| Kelompok | n | TP | FN | FP | TN |\n|---|---|---|---|---|---|")
    for k, nm in [("gabungan", "Gabungan"), ("linkedin", "LinkedIn (teks)"), ("instagram", "Instagram (gambar)")]:
        m = s0[k]
        p(f"| {nm} | {m['n']} | {m['tp']} | {m['fn']} | {m['fp']} | {m['tn']} |")
    if s0["tanpa_prediksi"]:
        p(f"\nCatatan: tanpa prediksi (galat/timeout/gambar tidak terbaca): {', '.join(s0['tanpa_prediksi'])}")
    p("\n## Tabel 23. Metrik S0 vs B1 pada set uji\n")
    p("| Kode | Akurasi | Presisi | Recall | F1 | CI Wilson 95% | Cohen's kappa |\n|---|---|---|---|---|---|---|")
    for kode, r in [("S0 (v3)", s0), ("B1 (v0)", b1)]:
        if not r:
            continue
        m = r["gabungan"]
        p(f"| {kode} | {pct(m['akurasi'])} | {dec(m['presisi'])} | {dec(m['recall'])} | {dec(m['f1'])} | "
          f"{pct(m['wilson95'][0])} - {pct(m['wilson95'][1])} | {dec(m['kappa'])} |")
    p("\n## Tabel 24. Metrik per platform (S0)\n")
    p("| Platform | n | Akurasi | Presisi | Recall | F1 |\n|---|---|---|---|---|---|")
    for k in ["linkedin", "instagram", "gabungan"]:
        m = s0[k]
        p(f"| {k} | {m['n']} | {pct(m['akurasi'])} | {dec(m['presisi'])} | {dec(m['recall'])} | {dec(m['f1'])} |")
    p("\n## Tabel 25. Sensitivitas ambang dan bobot\n")
    p("| Bobot | Ambang | Akurasi | Presisi | Recall | F1 | Prediksi ghost |\n|---|---|---|---|---|---|---|")
    for x in s0.get("sensitivitas", []):
        p(f"| {x['bobot']} | {x['ambang']} | {pct(x['akurasi'])} | {dec(x['presisi'])} | {dec(x['recall'])} | {dec(x['f1'])} | {x['prediksi_ghost']} |")
    p("")
    # Tabel 29: FP dan FN
    p("## Tabel 29. Kasus FP dan FN (S0)\n")
    p("| ID | Platform | Label | Prediksi | Skor | Jenis | Red flag model (untuk menyusun dugaan penyebab) |\n|---|---|---|---|---|---|---|")
    for r in rincian("rincian_v3_uji.csv"):
        if r["run"] != "1" or r["prediksi"] == "" or r["label"] == r["prediksi"]:
            continue
        jenis = "FP" if r["prediksi"] == "1" else "FN"
        p(f"| {r['id']} | {r['platform']} | {r['label']} | {r['prediksi']} | {r['skor']} | {jenis} | {r['red_flags'][:160]} |")
    p("")

# ---------------- Tabel 26: konsistensi + JSON valid
k = baca("konsistensi/ringkasan_v3_uji.json")
if k and k.get("konsistensi"):
    p("## Tabel 26. Konsistensi skor 3 run (TC-09)\n")
    p("| ID | Platform | Run 1 | Run 2 | Run 3 | Rata-rata | Simpangan baku |\n|---|---|---|---|---|---|---|")
    for x in k["konsistensi"]["per_iklan"]:
        sk = x["skor"] + [""] * (3 - len(x["skor"]))
        p(f"| {x['id']} | {x['platform']} | {sk[0]} | {sk[1]} | {sk[2]} | {dec(x['rata'], 1)} | {dec(x['simpangan_baku'])} |")
    kk = k["konsistensi"]
    p(f"\nSimpangan baku maksimum {dec(kk['simpangan_baku_maks'])} poin, rata-rata {dec(kk['simpangan_baku_rata'])} poin (target < 10).")
semua = rincian("konsistensi/rincian_v3_uji.csv") + [r for r in rincian("rincian_v3_uji.csv")]
if semua:
    valid = sum(r["json_valid"] == "1" for r in semua)
    p(f"\nRespons JSON valid (Persamaan 13, prompt v3, set uji termasuk pengulangan): {valid}/{len(semua)} = {pct(valid / len(semua))} (target >= 95%).\n")

# ---------------- Tabel 27: relevansi red flag
flags = rincian("red_flags_v3_uji.csv")
isi = [x for x in flags if x.get("relevan_1_atau_0", "").strip() in ("0", "1")]
p("## Tabel 27. Relevansi red flag (penilaian peneliti)\n")
if isi:
    p("| Platform | Jumlah | Relevan | Tidak relevan | Relevansi |\n|---|---|---|---|---|")
    for plat in ["linkedin", "instagram", None]:
        g = [x for x in isi if plat is None or x["platform"] == plat]
        rel = sum(x["relevan_1_atau_0"].strip() == "1" for x in g)
        if g:
            p(f"| {plat or 'gabungan'} | {len(g)} | {rel} | {len(g) - rel} | {pct(rel / len(g))} |")
else:
    p(f"Belum dinilai: isi kolom relevan_1_atau_0 di {H}/red_flags_v3_uji.csv ({len(flags)} red flag), lalu jalankan ulang.")
p("")

# ---------------- Tabel 28: performa
p("## Tabel 28. Performa\n")
for jenis in ["teks", "gambar"]:
    r = baca(f"performa_{jenis}.json")
    if not r:
        p(f"- {jenis}: belum diuji")
        continue
    b = r["berurutan"]
    p(f"- {jenis}: p95 {dec(b['p95_detik'])} dtk, rata-rata {dec(b.get('rata_detik', float('nan')))} dtk, median {dec(b['median_detik'])} dtk, "
      f"{b['di_bawah_10_detik']}/{b.get('n', 30)} di bawah 10 dtk, cold start {dec(r['cold_start_detik'])} dtk, "
      f"galat bersamaan {r['bersamaan']['galat_500_atau_timeout']}/{r['bersamaan']['n']} (URL: {r.get('url', '-')})")

(H / "LAPORAN_BAB4.md").write_text("\n".join(out) + "\n", encoding="utf-8")
print("\n".join(out))
