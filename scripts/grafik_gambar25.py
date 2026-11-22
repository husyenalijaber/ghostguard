"""Gambar 25: waktu respons per permintaan pada aplikasi di Vercel (Gemini Free Tier, 23 November 2026).
Pakai: python scripts/grafik_gambar25.py hasil/vercel hasil/vercel/gambar25.png"""
import csv, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

dasar, keluar = sys.argv[1], sys.argv[2]
plt.rcParams.update({"font.family": "Inter", "font.size": 11})

def baca(uji, jenis):
    with open(f"{dasar}/{uji}/performa_{jenis}.csv") as f:
        return [(int(r["status"]), float(r["detik"])) for r in csv.DictReader(f)]

WARNA_1, WARNA_2, WARNA_TOLAK = "#9DC9C2", "#1F6F66", "#E8735A"
fig, axes = plt.subplots(1, 2, figsize=(12, 6), dpi=150, sharey=True)
for ax, jenis, judul in zip(axes, ["teks", "gambar"], ["(a) Teks LinkedIn (gemini-3.5-flash-lite)", "(b) Poster Instagram (gemini-3.6-flash)"]):
    u1, u2 = baca("uji1_tanpa_retry", jenis), baca("uji2_dengan_retry", jenis)
    x = range(1, len(u1) + 1)
    w = 0.38
    ax.bar([i - w / 2 for i in x], [d for _, d in u1], w, color=[WARNA_1 if s == 200 else WARNA_TOLAK for s, _ in u1])
    ax.bar([i + w / 2 for i in x], [d for _, d in u2], w, color=[WARNA_2 if s == 200 else WARNA_TOLAK for s, _ in u2])
    ax.axhline(10, ls="--", lw=1, color="#555")
    ax.text(len(u1) + 0.5, 10.4, "target 10 detik", ha="right", color="#555", fontsize=10)
    ax.set_title(judul, fontsize=12)
    ax.set_xlabel("Permintaan berurutan ke-")
    ax.set_xticks(list(x))
    ax.spines[["top", "right"]].set_visible(False)
axes[0].set_ylabel("Waktu respons end-to-end (detik)")
axes[0].set_ylim(0, 26)
fig.legend(handles=[Patch(color=WARNA_1, label="Uji 1: tanpa coba-ulang (HTTP 200)"),
                    Patch(color=WARNA_2, label="Uji 2: dengan coba-ulang batas laju (HTTP 200)"),
                    Patch(color=WARNA_TOLAK, label="HTTP 503 (ditolak batas kuota Free Tier)")],
           loc="lower center", ncol=3, frameon=False, fontsize=10)
fig.tight_layout(rect=(0, 0.07, 1, 1))
fig.savefig(keluar)
