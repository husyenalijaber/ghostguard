/**
 * Uji performa deployment GhostGuard (H3, TC-06 dan TC-07).
 *
 * Contoh:
 *   npm run uji-performa -- --url https://ghostguard.vercel.app --teks data/contoh_iklan.txt
 *   npm run uji-performa -- --url https://ghostguard.vercel.app --gambar data/poster_contoh.jpg --n 30
 *
 * Langkah:
 *   1. Satu permintaan pembuka (dicatat terpisah sebagai cold start bila aplikasi lama tidak dipakai).
 *   2. N permintaan berurutan (default 30): waktu respons end-to-end, persentil ke-95.
 *   3. P permintaan bersamaan (default 10): jumlah galat HTTP 500 atau timeout.
 *
 * Catatan: setiap permintaan memakai sesi baru (tanpa cookie) agar kuota per pengguna tidak
 * menghalangi pengujian. Batas per IP (IP_HOURLY_LIMIT, default 40/jam) dan batas global harian
 * tetap berlaku, jadi naikkan sementara di Environment Variables Vercel selama pengujian.
 */
import fs from "fs";
import path from "path";

const argv = process.argv.slice(2);
const arg = (n: string, d?: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const URL_APP = (arg("url") || "").replace(/\/$/, "");
const N = Number(arg("n", "30"));
const P = Number(arg("paralel", "10"));
const OUT = arg("out", "hasil")!;
const teksFile = arg("teks");
const gambarFile = arg("gambar");

if (!URL_APP || (!teksFile && !gambarFile)) {
  console.error("Pakai: --url <alamat aplikasi> dan --teks <file.txt> atau --gambar <poster.jpg>");
  process.exit(1);
}

const body = teksFile
  ? { sourceType: "LinkedIn", jobPostingText: fs.readFileSync(teksFile, "utf8") }
  : { sourceType: "Instagram", images: [{ base64: fs.readFileSync(gambarFile!).toString("base64") }] };
const jenis = teksFile ? "teks" : "gambar";

async function satu(): Promise<{ status: number; ms: number }> {
  const t = performance.now();
  try {
    const r = await fetch(`${URL_APP}/api/analyze-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    await r.text();
    return { status: r.status, ms: performance.now() - t };
  } catch {
    return { status: 0, ms: performance.now() - t }; // 0 = timeout / koneksi gagal
  }
}

const persentil = (x: number[], p: number) => {
  const s = [...x].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)];
};

async function main() {
  console.log(`Uji performa ${jenis} pada ${URL_APP}`);
  const pembuka = await satu();
  console.log(`Permintaan pembuka (cold start bila lama tidak dipakai): ${(pembuka.ms / 1000).toFixed(2)} detik, status ${pembuka.status}`);

  const urut: { no: number; status: number; ms: number }[] = [];
  for (let i = 1; i <= N; i++) {
    const r = await satu();
    urut.push({ no: i, ...r });
    console.log(`  [${i}/${N}] ${(r.ms / 1000).toFixed(2)} dtk status ${r.status}`);
  }
  const ok = urut.filter((r) => r.status === 200).map((r) => r.ms / 1000);
  const p95 = ok.length ? persentil(ok, 95) : NaN;

  console.log(`\n${P} permintaan bersamaan...`);
  const paralel = await Promise.all(Array.from({ length: P }, () => satu()));
  const galat = paralel.filter((r) => r.status === 0 || r.status >= 500 || r.status === 408).length;

  const ringkasan = {
    url: URL_APP, jenis, waktu: new Date().toISOString(),
    cold_start_detik: pembuka.ms / 1000,
    berurutan: {
      n: N, sukses: ok.length,
      p95_detik: p95,
      rata_detik: ok.reduce((s, v) => s + v, 0) / (ok.length || 1),
      median_detik: ok.length ? persentil(ok, 50) : NaN,
      di_bawah_10_detik: ok.filter((v) => v < 10).length,
      ditolak_status: urut.filter((r) => r.status !== 200).map((r) => r.status),
      // TC-06 lulus bila semua permintaan berhasil dan p95 < 10 detik
      tc06_lulus: ok.length === N && p95 < 10,
    },
    bersamaan: {
      n: P, galat_500_atau_timeout: galat, status: paralel.map((r) => r.status),
      detik: paralel.map((r) => Number((r.ms / 1000).toFixed(3))),
      tc07_lulus: galat === 0,
    },
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `performa_${jenis}.json`), JSON.stringify(ringkasan, null, 2));
  fs.writeFileSync(
    path.join(OUT, `performa_${jenis}.csv`),
    "no,status,detik\n" + urut.map((r) => `${r.no},${r.status},${(r.ms / 1000).toFixed(3)}`).join("\n") + "\n"
  );
  console.log(`\nPersentil ke-95 : ${p95.toFixed(2)} detik (target < 10 detik)`);
  console.log(`Berhasil        : ${ok.length}/${N}; di bawah 10 dtk: ${ringkasan.berurutan.di_bawah_10_detik}/${N}`);
  console.log(`TC-06           : ${ringkasan.berurutan.tc06_lulus ? "LULUS" : "GAGAL"} (semua berhasil dan p95 < 10 detik)`);
  console.log(`Galat bersamaan : ${galat}/${P} -> TC-07 ${galat === 0 ? "LULUS" : "GAGAL"}`);
  console.log(`Hasil disimpan di folder "${OUT}".`);
}

main();
