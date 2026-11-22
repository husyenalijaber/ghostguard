/**
 * Skrip evaluasi GhostGuard (Bab IV skripsi).
 *
 * Memanggil Gemini API langsung (tanpa kuota aplikasi) dengan prompt, model,
 * pembersihan teks, validasi, dan rumus skor yang SAMA dengan aplikasi
 * (lib/analysis.ts), lalu menghitung metrik penelitian.
 *
 * Contoh:
 *   npm run evaluasi -- --data data/dataset.csv --set uji                    # S0, prompt v3
 *   npm run evaluasi -- --data data/dataset.csv --set uji --prompt v0        # B1, zero-shot
 *   npm run evaluasi -- --data data/dataset.csv --set uji --ulang 3 --ids U-01,U-05,...   # konsistensi (H2)
 *   npm run evaluasi -- --data data/dataset.csv --set pengembangan --prompt v1 --ulang 3  # Tabel iterasi prompt (v0-v3)
 *
 * Hemat kuota API: setiap respons model disimpan di <out>/cache.jsonl. Bila skrip dijalankan ulang
 * (misalnya setelah terhenti karena batas kuota), iklan yang sudah punya respons tidak dipanggil lagi.
 * Pakai --tanpa-cache untuk memaksa memanggil ulang.
 *
 * Format CSV dataset (UTF-8, baris pertama header):
 *   id,platform,set,label,teks,gambar
 *   - platform : linkedin | instagram
 *   - set      : pengembangan | uji
 *   - label    : 1 = ghost job, 0 = genuine (label akhir)
 *   - teks     : teks iklan LinkedIn (boleh multi-baris, diapit tanda kutip)
 *   - gambar   : path poster Instagram, relatif terhadap file CSV; beberapa slide dipisah ";"
 *
 * Keluaran (folder --out, default "hasil"):
 *   rincian_<prompt>_<set>.csv     satu baris per iklan per pengulangan
 *   ringkasan_<prompt>_<set>.json  metrik keseluruhan dan per platform
 *   red_flags_<prompt>_<set>.csv   lembar penilaian relevansi red flag oleh peneliti
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import {
  AMBANG_GHOST,
  BOBOT,
  DIMENSI_KEYS,
  DimensiSkor,
  PROMPT_V0,
  PROMPT_V1,
  PROMPT_V2,
  PROMPT_V3,
  bentukHasil,
  buatKlienGemini,
  hitungSkor,
  keluaranValid,
  panggilModel,
  parseJsonModel,
  sanitizeLinkedInText,
  tentukanKategori,
  validasiGambar,
} from "../lib/analysis";

dotenv.config({ quiet: true });

// ------------------------------------------------------------------ argumen
const argv = process.argv.slice(2);
const arg = (name: string, def?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};
const DATA = arg("data", "data/dataset.csv")!;
const SET = arg("set", "uji")!; // uji | pengembangan | semua
const PROMPT = arg("prompt", "v3")!; // v0 | v1 | v2 | v3
const TANPA_CACHE = argv.includes("--tanpa-cache");
const ULANG = Math.max(1, Number(arg("ulang", "1")));
const IDS = (arg("ids", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const OUT = arg("out", "hasil")!;
const JEDA_MS = Number(arg("jeda", "1500"));
// --cache: lokasi cache respons model (default <out>/cache.jsonl); dipakai bersama oleh bab4.sh
const CACHE = arg("cache", "");

// ------------------------------------------------------------------ CSV
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}

// ------------------------------------------------------------------ statistik
type Matriks = { tp: number; tn: number; fp: number; fn: number };
function matriks(y: number[], p: number[]): Matriks {
  const m = { tp: 0, tn: 0, fp: 0, fn: 0 };
  y.forEach((t, i) => {
    if (t === 1 && p[i] === 1) m.tp++;
    else if (t === 0 && p[i] === 0) m.tn++;
    else if (t === 0 && p[i] === 1) m.fp++;
    else m.fn++;
  });
  return m;
}
function metrik(y: number[], p: number[]) {
  const m = matriks(y, p);
  const n = m.tp + m.tn + m.fp + m.fn;
  const akurasi = n ? (m.tp + m.tn) / n : 0;
  const presisi = m.tp + m.fp ? m.tp / (m.tp + m.fp) : 0;
  const recall = m.tp + m.fn ? m.tp / (m.tp + m.fn) : 0;
  const f1 = presisi + recall ? (2 * presisi * recall) / (presisi + recall) : 0;
  return { n, ...m, akurasi, presisi, recall, f1, wilson95: wilson(akurasi, n), kappa: kappa(y, p) };
}
function wilson(p: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 0];
  const pusat = p + (z * z) / (2 * n);
  const lebar = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(pusat - lebar) / (1 + (z * z) / n), (pusat + lebar) / (1 + (z * z) / n)];
}
function kappa(a: number[], b: number[]): number {
  const n = a.length;
  if (!n) return 0;
  const po = a.filter((x, i) => x === b[i]).length / n;
  const p1 = a.reduce((s, x) => s + x, 0) / n;
  const p2 = b.reduce((s, x) => s + x, 0) / n;
  const pe = p1 * p2 + (1 - p1) * (1 - p2);
  return pe < 1 ? (po - pe) / (1 - pe) : NaN; // tak terdefinisi bila semua label/prediksi satu kelas
}
function simpanganBaku(x: number[]): number {
  if (x.length < 2) return 0;
  const r = x.reduce((s, v) => s + v, 0) / x.length;
  return Math.sqrt(x.reduce((s, v) => s + (v - r) ** 2, 0) / (x.length - 1));
}
const pct = (v: number) => (v * 100).toFixed(1).replace(".", ",") + "%";
const dec = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

// ------------------------------------------------------------------ utama
async function main() {
  // Kunci API hanya dibutuhkan bila ada iklan yang belum punya respons di cache.
  // Tanpa kunci, skrip tetap menghitung ulang metrik dari hasil/cache.jsonl (misalnya setelah label diperbaiki).
  const ai = buatKlienGemini();
  if (!ai) console.log("GEMINI_API_KEY kosong: mode offline, hanya memakai respons yang sudah ada di cache.\n");
  const baseDir = path.dirname(path.resolve(DATA));
  let data = parseCsv(fs.readFileSync(DATA, "utf8"));
  if (SET !== "semua") data = data.filter((r) => r.set === SET);
  if (IDS.length) data = data.filter((r) => IDS.includes(r.id));
  if (!data.length) {
    console.error("Tidak ada baris data yang cocok dengan filter --set / --ids.");
    process.exit(1);
  }
  const PROMPTS: Record<string, string> = { v0: PROMPT_V0, v1: PROMPT_V1, v2: PROMPT_V2, v3: PROMPT_V3 };
  if (!PROMPTS[PROMPT]) {
    console.error("--prompt harus v0, v1, v2, atau v3");
    process.exit(1);
  }
  const systemPrompt = PROMPTS[PROMPT];
  const skorLangsung = PROMPT === "v0" || PROMPT === "v1"; // v0/v1: model memberi skor langsung

  // cache respons model agar pengulangan skrip tidak menghabiskan kuota API
  fs.mkdirSync(OUT, { recursive: true });
  const cachePath = CACHE || path.join(OUT, "cache.jsonl");
  const cache = new Map<string, { teksRespons: string; model: string; durasiMs: number }>();
  if (!TANPA_CACHE && fs.existsSync(cachePath)) {
    for (const line of fs.readFileSync(cachePath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const c = JSON.parse(line);
        cache.set(c.kunci, c);
      } catch {
        /* abaikan baris rusak */
      }
    }
  }
  console.log(`Evaluasi prompt ${PROMPT} pada ${data.length} iklan (set: ${SET}), ${ULANG} pengulangan.\n`);

  const rincian: Record<string, unknown>[] = [];
  for (let run = 1; run <= ULANG; run++) {
    for (const row of data) {
      const platform = row.platform.toLowerCase();
      const out: Record<string, unknown> = {
        id: row.id, platform, set: row.set, label: Number(row.label), run,
        model: "", json_valid: 0, skor: "", kategori: "", prediksi: "",
        ...Object.fromEntries(DIMENSI_KEYS.map((k) => [`d_${k}`, ""])),
        perusahaan: "", posisi: "", red_flags: "", penjelasan: "", durasi_ms: "", dari_cache: 0, galat: "",
      };
      try {
        let teks = "";
        let gambar: ReturnType<typeof validasiGambar> = [];
        if (platform === "instagram") {
          const entries = row.gambar.split(";").map((p) => p.trim()).filter(Boolean).map((p) => {
            const buf = fs.readFileSync(path.resolve(baseDir, p));
            return { base64: buf.toString("base64") };
          });
          gambar = validasiGambar(entries);
        } else {
          teks = sanitizeLinkedInText(row.teks);
        }
        const kunci = `${PROMPT}|${row.id}|${run}`;
        let r = TANPA_CACHE ? undefined : cache.get(kunci);
        out.dari_cache = r ? 1 : 0;
        if (!r) {
          if (!ai) throw new Error("belum ada di cache dan GEMINI_API_KEY kosong");
          r = await panggilModel(ai, { teks, gambar, prompt: systemPrompt, konfigurasiFinal: PROMPT === "v3" });
          cache.set(kunci, r);
          fs.appendFileSync(cachePath, JSON.stringify({ kunci, ...r }) + "\n");
        }
        out.model = r.model;
        out.durasi_ms = r.durasiMs;
        const parsed = parseJsonModel(r.teksRespons);
        if (skorLangsung) {
          const ok = parsed && typeof parsed.skor === "number" && parsed.skor >= 0 && parsed.skor <= 100;
          out.json_valid = ok ? 1 : 0;
          if (ok) {
            out.skor = Math.round(parsed.skor);
            out.kategori = tentukanKategori(out.skor as number);
            out.prediksi = (out.skor as number) >= AMBANG_GHOST ? 1 : 0;
            out.red_flags = (parsed.red_flags || []).join(" | ");
            out.penjelasan = parsed.penjelasan || "";
          }
        } else if (parsed && keluaranValid(parsed)) {
          out.json_valid = 1;
          const h = bentukHasil(parsed);
          out.skor = h.skor;
          out.kategori = h.kategori;
          if (h.skor >= 0) {
            out.prediksi = h.skor >= AMBANG_GHOST ? 1 : 0;
            for (const k of DIMENSI_KEYS) out[`d_${k}`] = h.dimensi_skor[k];
          }
          out.perusahaan = h.perusahaan;
          out.posisi = h.posisi;
          out.red_flags = h.red_flags.join(" | ");
          out.penjelasan = h.penjelasan;
        }
      } catch (e: any) {
        out.galat = String(e?.message || e).slice(0, 200);
      }
      rincian.push(out);
      console.log(`[run ${run}] ${row.id} (${platform}) label=${row.label} skor=${out.skor} prediksi=${out.prediksi}${out.galat ? " galat=" + out.galat : ""}`);
      if (!out.dari_cache) await new Promise((r) => setTimeout(r, JEDA_MS));
    }
  }

  // ----------------------------------------------------------------- ringkasan
  const tag = `${PROMPT}_${SET}`;
  fs.writeFileSync(path.join(OUT, `rincian_${tag}.csv`), toCsv(rincian));

  const run1 = rincian.filter((r) => r.run === 1 && r.prediksi !== "");
  const grup = (rows: typeof run1) => metrik(rows.map((r) => r.label as number), rows.map((r) => r.prediksi as number));
  const ringkasan: Record<string, unknown> = {
    prompt: PROMPT, set: SET, jumlah_iklan: data.length, pengulangan: ULANG,
    waktu: new Date().toISOString(),
    json_valid_persen: rincian.filter((r) => r.json_valid === 1).length / rincian.length,
    tanpa_prediksi: rincian.filter((r) => r.run === 1 && r.prediksi === "").map((r) => r.id),
    gabungan: grup(run1),
    linkedin: grup(run1.filter((r) => r.platform === "linkedin")),
    instagram: grup(run1.filter((r) => r.platform === "instagram")),
  };

  if (PROMPT === "v3") {
    const sens: Record<string, unknown>[] = [];
    const sama = Object.fromEntries(DIMENSI_KEYS.map((k) => [k, 0.2])) as Record<(typeof DIMENSI_KEYS)[number], number>;
    const dimOf = (r: Record<string, unknown>) =>
      Object.fromEntries(DIMENSI_KEYS.map((k) => [k, Number(r[`d_${k}`])])) as DimensiSkor;
    const konfigurasi: Array<[string, Record<(typeof DIMENSI_KEYS)[number], number>, number]> = [
      ["Bobot penelitian", BOBOT, 50], ["Bobot penelitian", BOBOT, 60], ["Bobot penelitian (utama)", BOBOT, 67],
      ["Bobot penelitian", BOBOT, 75], ["Bobot sama rata (20%)", sama, 67],
    ];
    for (const [nama, bobot, ambang] of konfigurasi) {
      const pred: number[] = run1.map((r) => (hitungSkor(dimOf(r), bobot) >= ambang ? 1 : 0));
      const m = metrik(run1.map((r) => r.label as number), pred);
      sens.push({ bobot: nama, ambang, akurasi: m.akurasi, presisi: m.presisi, recall: m.recall, f1: m.f1,
        prediksi_ghost: pred.reduce((acc: number, v: number) => acc + v, 0) });
    }
    ringkasan.sensitivitas = sens;
  }

  if (ULANG > 1) {
    const perIklan = data.map((row) => {
      const skor = rincian.filter((r) => r.id === row.id && r.skor !== "" && (r.skor as number) >= 0).map((r) => r.skor as number);
      return { id: row.id, platform: row.platform, skor, rata: skor.reduce((s, v) => s + v, 0) / (skor.length || 1), simpangan_baku: simpanganBaku(skor) };
    });
    ringkasan.konsistensi = {
      per_iklan: perIklan,
      simpangan_baku_maks: Math.max(...perIklan.map((p) => p.simpangan_baku)),
      simpangan_baku_rata: perIklan.reduce((s, p) => s + p.simpangan_baku, 0) / perIklan.length,
    };
  }
  fs.writeFileSync(path.join(OUT, `ringkasan_${tag}.json`), JSON.stringify(ringkasan, null, 2));

  const flags = rincian
    .filter((r) => r.run === 1 && r.red_flags)
    .flatMap((r) => String(r.red_flags).split(" | ").map((f) => ({ id: r.id, platform: r.platform, red_flag: f, relevan_1_atau_0: "" })));
  // pertahankan penilaian relevansi yang sudah diisi peneliti bila file ditulis ulang
  const flagPath = path.join(OUT, `red_flags_${tag}.csv`);
  if (fs.existsSync(flagPath)) {
    const lama = new Map(parseCsv(fs.readFileSync(flagPath, "utf8")).map((r) => [`${r.id}|${r.red_flag}`, r.relevan_1_atau_0]));
    for (const f of flags) f.relevan_1_atau_0 = lama.get(`${f.id}|${f.red_flag}`) ?? "";
  }
  if (flags.length) fs.writeFileSync(flagPath, toCsv(flags));

  // ----------------------------------------------------------------- tampilan
  const g = ringkasan.gabungan as ReturnType<typeof metrik>;
  console.log("\n================ RINGKASAN ================");
  console.log(`JSON valid           : ${pct(ringkasan.json_valid_persen as number)} dari ${rincian.length} respons`);
  for (const k of ["gabungan", "linkedin", "instagram"] as const) {
    const m = ringkasan[k] as ReturnType<typeof metrik>;
    if (!m.n) continue;
    console.log(`${k.padEnd(10)} n=${m.n}  TP=${m.tp} FN=${m.fn} FP=${m.fp} TN=${m.tn}  akurasi=${pct(m.akurasi)}  presisi=${dec(m.presisi)}  recall=${dec(m.recall)}  F1=${dec(m.f1)}`);
  }
  console.log(`CI Wilson 95% akurasi: ${pct(g.wilson95[0])} sampai ${pct(g.wilson95[1])}   Cohen's κ: ${dec(g.kappa)}`);
  if (ringkasan.konsistensi) {
    const k = ringkasan.konsistensi as any;
    console.log(`Simpangan baku skor  : maks ${dec(k.simpangan_baku_maks)} poin, rata-rata ${dec(k.simpangan_baku_rata)} poin`);
  }
  console.log(`\nFile hasil disimpan di folder "${OUT}".`);
}

main().catch((e) => {
  console.error("Evaluasi gagal:", e?.message || e);
  process.exit(1);
});
