/**
 * Mengisi hasil/cache.jsonl secara paralel (dipakai sekali saat kunci API tersedia).
 * Memakai panggilModel, prompt, dan pembersihan teks yang SAMA dengan scripts/evaluasi.ts,
 * dengan format kunci cache "<prompt>|<id>|<run>", sehingga evaluasi.ts dapat menghitung
 * semua metrik dari cache tanpa memanggil API lagi.
 *
 *   npx tsx scripts/jalankan-paralel.ts --data data/dataset_semua.csv --out hasil --tugas "v3:1-3,v0:1" --paralel 6
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { PROMPT_V0, PROMPT_V1, PROMPT_V2, PROMPT_V3, buatKlienGemini, panggilModel, sanitizeLinkedInText, validasiGambar } from "../lib/analysis";
dotenv.config({ quiet: true });

const argv = process.argv.slice(2);
const arg = (n: string, d?: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const DATA = arg("data")!.split(",");
const OUT = arg("out", "hasil")!;
const PARALEL = Number(arg("paralel", "6"));
const SET = arg("set", ""); // filter opsional
const IDS = (arg("ids", "") || "").split(",").filter(Boolean);
// contoh "v3:1-3,v0:1" = prompt v3 run 1..3, prompt v0 run 1
const TUGAS = arg("tugas", "v3:1")!.split(",").map((t) => {
  const [p, r] = t.split(":"); const [a, b] = (r || "1").split("-").map(Number);
  return { p, runs: Array.from({ length: (b || a) - a + 1 }, (_, i) => a + i) };
});
const PROMPTS: Record<string, string> = { v0: PROMPT_V0, v1: PROMPT_V1, v2: PROMPT_V2, v3: PROMPT_V3 };

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [h, ...b] = rows.filter((r) => r.some((x) => x.trim()));
  return b.map((r) => Object.fromEntries(h.map((k, i) => [k.trim(), (r[i] ?? "").trim()])));
}

async function main() {
  const ai = buatKlienGemini();
  if (!ai) throw new Error("GEMINI_API_KEY kosong");
  fs.mkdirSync(OUT, { recursive: true });
  const cachePath = path.join(OUT, "cache.jsonl");
  const ada = new Set<string>();
  if (fs.existsSync(cachePath)) for (const l of fs.readFileSync(cachePath, "utf8").split("\n")) { try { ada.add(JSON.parse(l).kunci); } catch {} }

  const kerja: Array<() => Promise<void>> = [];
  for (const file of DATA) {
    const base = path.dirname(path.resolve(file));
    for (const row of parseCsv(fs.readFileSync(file, "utf8"))) {
      if (SET && row.set !== SET) continue;
      if (IDS.length && !IDS.includes(row.id)) continue;
      for (const t of TUGAS) for (const run of t.runs) {
        const kunci = `${t.p}|${row.id}|${run}`;
        if (ada.has(kunci)) continue;
        kerja.push(async () => {
          const ig = row.platform.toLowerCase() === "instagram";
          const gambar = ig ? validasiGambar(row.gambar.split(";").filter(Boolean).map((p) => ({ base64: fs.readFileSync(path.resolve(base, p.trim())).toString("base64") }))) : [];
          const teks = ig ? "" : sanitizeLinkedInText(row.teks);
          try {
            let r;
            for (let k = 0; ; k++) {
              try { r = await panggilModel(ai, { teks, gambar, prompt: PROMPTS[t.p], konfigurasiFinal: t.p === "v3" }); break; }
              catch (e: any) {
                // 429 = batas per menit: tunggu lalu coba lagi (tidak berlaku untuk galat lain)
                if (!/429|RESOURCE_EXHAUSTED|exceeded your current quota/.test(String(e?.message || e)) || k >= 6) throw e;
                await new Promise((res) => setTimeout(res, 30000 + k * 15000));
              }
            }
            fs.appendFileSync(cachePath, JSON.stringify({ kunci, ...r }) + "\n");
            console.log("ok", kunci, r.durasiMs);
          } catch (e: any) {
            fs.appendFileSync(path.join(OUT, "galat.log"), `${new Date().toISOString()} ${kunci} ${String(e?.message || e).slice(0, 160)}\n`);
            console.log("GAGAL", kunci, String(e?.message || e).slice(0, 80));
          }
        });
      }
    }
  }
  console.log(`antrean: ${kerja.length} panggilan`);
  let i = 0;
  await Promise.all(Array.from({ length: PARALEL }, async () => { while (i < kerja.length) await kerja[i++](); }));
  console.log("SELESAI");
}
main();
