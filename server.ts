import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  MODEL_TEKS,
  MODEL_GAMBAR,
  MIN_TEKS,
  MAX_TEKS,
  TIMEOUT_TEKS_MS,
  TIMEOUT_GAMBAR_MS,
  GambarTervalidasi,
  InputError,
  TimeoutError,
  validasiGambar,
  sanitizeLinkedInText,
  adaKalimatInjeksi,
  buatKlienGemini,
  panggilModel,
  parseJsonModel,
  keluaranValid,
  bentukHasil,
  hasilError,
} from "./lib/analysis";
import { Redis } from "@upstash/redis";
import dotenv from "dotenv";

const localEnvPath = path.join(process.cwd(), ".env");
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: true, quiet: true });
} else {
  dotenv.config({ quiet: true });
}

const app = express();
const PORT = 3000;

// ---------------------------------------------------------------------------
// Pengamanan dasar
// ---------------------------------------------------------------------------
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(express.json({ limit: "20mb" }));

// =========================================================================
// Security, Quota & Rate-Limit Store (Redis REST + In-Memory Fallback)
// =========================================================================
const AUTH_HMAC_SECRET =
  (process.env.AUTH_CHALLENGE_SECRET || "").trim() ||
  crypto.randomBytes(32).toString("hex");
if (!(process.env.AUTH_CHALLENGE_SECRET || "").trim() && process.env.VERCEL) {
  console.warn(
    "[GhostGuard] AUTH_CHALLENGE_SECRET belum diatur: cookie pengguna berubah antar instance sehingga kuota per pengguna tidak konsisten. Isi variabel ini di Vercel."
  );
}

function getEnvPositiveInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

function isPublicServiceEnabled(): boolean {
  return String(process.env.PUBLIC_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

function getGlobalDailyLimit(): number {
  return getEnvPositiveInt("GLOBAL_DAILY_LIMIT", 200);
}

function getIpHourlyLimit(): number {
  return getEnvPositiveInt("IP_HOURLY_LIMIT", 40);
}

// Dapat diperkecil sementara saat pengujian (TC-12, TC-14) agar hemat kuota Gemini
const COOKIE_TEXT_HOURLY_LIMIT = getEnvPositiveInt("TEXT_HOURLY_LIMIT", 30);
const IMAGE_DAILY_LIMIT = getEnvPositiveInt("IMAGE_DAILY_LIMIT", 5);

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).split(",")[0].trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}

function hashIp(ip: string): string {
  return crypto
    .createHash("sha256")
    .update(ip + AUTH_HMAC_SECRET)
    .digest("hex")
    .slice(0, 32);
}

function signAuthPayload(data: string): string {
  return crypto
    .createHmac("sha256", AUTH_HMAC_SECRET)
    .update(data)
    .digest("hex");
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) result[key] = val;
  }
  return result;
}

function getOrCreateClientCookieId(req: express.Request, res: express.Response): string {
  const cookies = parseCookies(req.headers.cookie);
  const existing = cookies["gg_cid"];
  if (existing) {
    const parts = existing.split(".");
    if (parts.length === 2 && parts[0] && parts[1]) {
      const expected = signAuthPayload(`cid.${parts[0]}`);
      if (
        expected.length === parts[1].length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[1]))
      ) {
        return parts[0];
      }
    }
  }

  const newId = crypto.randomUUID().replace(/-/g, "");
  const sig = signAuthPayload(`cid.${newId}`);
  const isHttps =
    req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
  const cookieAttrs = [
    `gg_cid=${encodeURIComponent(`${newId}.${sig}`)}`,
    "Path=/",
    "HttpOnly",
    ...(isHttps ? ["SameSite=None", "Secure", "Partitioned"] : ["SameSite=Lax"]),
    "Max-Age=2592000",
  ];
  res.setHeader("Set-Cookie", cookieAttrs.join("; "));
  return newId;
}

interface MemoryCounterRecord {
  count: number;
  expiresAt: number;
}

interface IncrementedCounterEntry {
  key: string;
  ttlSeconds: number;
  backend: "redis" | "memory";
}

const memoryCounterMap = new Map<string, MemoryCounterRecord>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryCounterMap.entries()) {
    if (now >= v.expiresAt) memoryCounterMap.delete(k);
  }
}, 300000);

const REDIS_TIMEOUT_MS = 3000;
const TTL_TWO_DAYS_SECONDS = 2 * 24 * 60 * 60; // 172800s
const TTL_TWO_HOURS_SECONDS = 2 * 60 * 60; // 7200s

function createUpstashRedisClient(): Redis | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) {
    console.warn(
      "[GhostGuard] UPSTASH_REDIS_REST_URL atau UPSTASH_REDIS_REST_TOKEN kosong. Menggunakan penghitung kuota sementara di memori."
    );
    return null;
  }
  try {
    return new Redis({ url, token });
  } catch (err: any) {
    console.warn(
      `[GhostGuard] Gagal menginisialisasi klien Upstash Redis (${err?.name || "InitError"}). Beralih ke penghitung sementara di memori.`
    );
    return null;
  }
}

const redisClient = createUpstashRedisClient();

async function withRedisTimeout<T>(operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("REDIS_TIMEOUT_3S")), REDIS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getCounterValue(key: string): Promise<number> {
  if (redisClient) {
    try {
      const raw = await withRedisTimeout(() => redisClient.get<number | string | null>(key));
      if (raw === null || raw === undefined) return 0;
      const val = Number(raw);
      return Number.isFinite(val) && val > 0 ? val : 0;
    } catch (err: any) {
      const reason =
        err?.message === "REDIS_TIMEOUT_3S" ? "batas waktu 3 detik terlampaui" : "koneksi gagal";
      console.warn(`[GhostGuard Redis] Gagal membaca penghitung (${reason}), memakai fallback memori.`);
    }
  }
  const now = Date.now();
  const mem = memoryCounterMap.get(key);
  if (!mem || now >= mem.expiresAt) return 0;
  return mem.count;
}

async function incrementCounterWithTtl(
  key: string,
  ttlSeconds: number
): Promise<{ count: number; backend: "redis" | "memory" }> {
  if (redisClient) {
    try {
      const count = await withRedisTimeout(() => redisClient.incr(key));
      if (count === 1) {
        await withRedisTimeout(() => redisClient.expire(key, ttlSeconds));
      }
      return { count, backend: "redis" };
    } catch (err: any) {
      const reason =
        err?.message === "REDIS_TIMEOUT_3S" ? "batas waktu 3 detik terlampaui" : "koneksi gagal";
      console.warn(`[GhostGuard Redis] Gagal menaikkan penghitung (${reason}), memakai fallback memori.`);
    }
  }

  const now = Date.now();
  let mem = memoryCounterMap.get(key);
  if (!mem || now >= mem.expiresAt) {
    mem = { count: 0, expiresAt: now + ttlSeconds * 1000 };
  }
  mem.count += 1;
  memoryCounterMap.set(key, mem);
  return { count: mem.count, backend: "memory" };
}

async function decrementCounter(entry: IncrementedCounterEntry): Promise<void> {
  if (entry.backend === "redis" && redisClient) {
    try {
      const next = await withRedisTimeout(() => redisClient.decr(entry.key));
      if (typeof next === "number" && next < 0) {
        await withRedisTimeout(() => redisClient.set(entry.key, 0, { ex: entry.ttlSeconds }));
      }
      return;
    } catch (err: any) {
      const reason =
        err?.message === "REDIS_TIMEOUT_3S" ? "batas waktu 3 detik terlampaui" : "koneksi gagal";
      console.warn(`[GhostGuard Redis] Gagal mengurangi penghitung DECR (${reason}).`);
      return;
    }
  }

  const now = Date.now();
  const mem = memoryCounterMap.get(entry.key);
  if (mem && now < mem.expiresAt) {
    mem.count = Math.max(0, mem.count - 1);
    memoryCounterMap.set(entry.key, mem);
  }
}

async function rollbackCounters(entries: IncrementedCounterEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await Promise.all(entries.map((entry) => decrementCounter(entry)));
}

function getJakartaTimeKeys(): { dateKey: string; hourKey: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  const year = map.year || "1970";
  const month = map.month || "01";
  const day = map.day || "01";
  const hour = map.hour === "24" ? "00" : map.hour || "00";

  return {
    dateKey: `${year}-${month}-${day}`,
    hourKey: `${year}${month}${day}${hour}`,
  };
}

// Health check endpoint (never exposes secrets, tokens, or URLs)
app.get("/api/health", async (_req, res) => {
  if (!redisClient) {
    return res.json({ status: "ok", redis: "memory-fallback" });
  }

  const probeKey = "gg:health:probe";
  const probeValue = `ok-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  try {
    await withRedisTimeout(() => redisClient.set(probeKey, probeValue, { ex: 10 }));
    const fetched = await withRedisTimeout(() => redisClient.get<string>(probeKey));
    if (fetched === probeValue) {
      return res.json({ status: "ok", redis: "ok" });
    }
    console.warn("[GhostGuard Health] Nilai uji Redis tidak cocok.");
    return res.json({ status: "error", redis: "error" });
  } catch (err: any) {
    const reason =
      err?.message === "REDIS_TIMEOUT_3S" ? "batas waktu 3 detik terlampaui" : "koneksi gagal";
    console.warn(`[GhostGuard Health] Pemeriksaan Redis gagal (${reason}).`);
    return res.json({ status: "error", redis: "error" });
  }
});

// Endpoint to inspect quota status and public maintenance state
app.get("/api/quota-status", async (req, res) => {
  try {
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);
    const cid = getOrCreateClientCookieId(req, res);
    const { dateKey, hourKey } = getJakartaTimeKeys();

    const globalLimit = getGlobalDailyLimit();
    const ipHourlyLimit = getIpHourlyLimit();
    const publicEnabled = isPublicServiceEnabled();

    const [globalUsed, ipHourlyUsed, userTextUsed, userImgUsed] = await Promise.all([
      getCounterValue(`gg:global:${dateKey}`),
      getCounterValue(`gg:ip:${ipHash}:${hourKey}`),
      getCounterValue(`gg:txt:${cid}:${hourKey}`),
      getCounterValue(`gg:img:${cid}:${dateKey}`),
    ]);

    res.json({
      publicEnabled,
      maintenanceMessage: publicEnabled
        ? undefined
        : "Layanan sedang dalam pemeliharaan pengujian.",
      turnstileRequired:
        Boolean((process.env.TURNSTILE_SECRET_KEY || "").trim()) &&
        Boolean((process.env.VITE_TURNSTILE_SITE_KEY || "").trim()),
      global: {
        max: globalLimit,
        used: globalUsed,
        remaining: Math.max(0, globalLimit - globalUsed),
      },
      ip: {
        max: ipHourlyLimit,
        remaining: Math.max(0, ipHourlyLimit - ipHourlyUsed),
      },
      text: {
        max: COOKIE_TEXT_HOURLY_LIMIT,
        remaining: Math.max(0, COOKIE_TEXT_HOURLY_LIMIT - userTextUsed),
      },
      image: {
        max: IMAGE_DAILY_LIMIT,
        remaining: Math.max(0, IMAGE_DAILY_LIMIT - userImgUsed),
        used: userImgUsed,
      },
    });
  } catch {
    console.warn("[GhostGuard Quota Status] Gagal membaca status kuota.");
    res.json({
      publicEnabled: isPublicServiceEnabled(),
      text: { max: COOKIE_TEXT_HOURLY_LIMIT, remaining: COOKIE_TEXT_HOURLY_LIMIT },
      image: { max: IMAGE_DAILY_LIMIT, remaining: IMAGE_DAILY_LIMIT, used: 0 },
    });
  }
});

// =========================================================================
// Analisis lowongan
// =========================================================================
function galatAuth(err: any): boolean {
  const status = Number(err?.status ?? err?.code ?? err?.statusCode);
  const msg = String(err?.message || err || "").toLowerCase();
  return status === 401 || status === 403 ||
    /unauthenticated|account_state_invalid|api_key_invalid|permission_denied|api key not valid/.test(msg);
}

function galatTagihan(err: any): boolean {
  const status = Number(err?.status ?? err?.code ?? err?.statusCode);
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    status === 402 ||
    msg.includes("prepayment credits") ||
    msg.includes("set up billing") ||
    msg.includes("free tier is not available") ||
    msg.includes("upgrade to the paid tier")
  );
}

function galatKuotaGemini(err: any): boolean {
  const status = Number(err?.status ?? err?.code ?? err?.statusCode);
  const msg = String(err?.message || err || "").toLowerCase();
  return status === 429 || /resource_exhausted|quota|too many requests|rate limit/.test(msg);
}

function galatSibuk(err: any): boolean {
  const status = Number(err?.status ?? err?.code ?? err?.statusCode);
  const msg = String(err?.message || "");
  return [502, 503, 504].includes(status) || /\b503\b|UNAVAILABLE|high demand|overloaded/.test(msg);
}

async function verifyTurnstileToken(
  token: string,
  remoteIp: string
): Promise<{ ok: boolean; error?: string }> {
  const secretKey = (process.env.TURNSTILE_SECRET_KEY || "").trim();
  const siteKey = (process.env.VITE_TURNSTILE_SITE_KEY || "").trim();
  if (!secretKey || !siteKey) return { ok: true };
  if (!token || typeof token !== "string" || !token.trim()) {
    return { ok: false, error: "Verifikasi anti-bot diperlukan sebelum melakukan analisis." };
  }
  try {
    const form = new URLSearchParams();
    form.set("secret", secretKey);
    form.set("response", token.trim());
    if (remoteIp) form.set("remoteip", remoteIp);
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data: any = await resp.json().catch(() => ({}));
    if (!resp.ok || data?.success !== true) {
      console.error("[GhostGuard Turnstile] Verifikasi ditolak:", data?.["error-codes"] || resp.status);
      return { ok: false, error: "Verifikasi anti-bot gagal atau kedaluwarsa. Silakan ulangi verifikasi." };
    }
    return { ok: true };
  } catch (err: any) {
    console.error("[GhostGuard Turnstile] Galat jaringan:", err?.message || "unknown");
    return { ok: false, error: "Verifikasi anti-bot gagal terhubung. Silakan coba lagi sebentar lagi." };
  }
}

const PESAN_GAGAL = "Analisis gagal. Coba lagi beberapa saat lagi.";

app.post("/api/analyze-job", async (req, res) => {
  const mulai = Date.now();
  let jenis = "teks";
  let model = MODEL_TEKS;
  const catat = (status: number, ket = "") =>
    console.log(
      `[GhostGuard] analisis jenis=${jenis} model=${model} status=${status} waktu_ms=${Date.now() - mulai}${ket ? " ket=" + ket : ""}`
    ); // tidak mencatat isi iklan

  if (!isPublicServiceEnabled()) {
    catat(423, "pemeliharaan");
    return res.status(423).json({ error: "Layanan sedang dalam pemeliharaan pengujian." });
  }

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const cid = getOrCreateClientCookieId(req, res);
  const incrementedCounters: IncrementedCounterEntry[] = [];
  let rolledBack = false;
  const rollbackOnce = async () => {
    if (rolledBack) return;
    rolledBack = true;
    await rollbackCounters(incrementedCounters);
  };
  const tolak = (status: number, error: string, ket = "") => {
    catat(status, ket);
    return res.status(status).json({ error });
  };

  try {
    const { jobPostingText, imageBase64, imageMimeType, images, sourceType, turnstileToken } = req.body || {};

    const turnstileCheck = await verifyTurnstileToken(typeof turnstileToken === "string" ? turnstileToken : "", ip);
    if (!turnstileCheck.ok) return tolak(400, turnstileCheck.error || "Verifikasi anti-bot tidak valid.", "turnstile");

    const rawText = typeof jobPostingText === "string" ? jobPostingText : "";
    const rawImages: Array<{ base64?: unknown; mimeType?: unknown }> =
      Array.isArray(images) && images.length > 0 ? images : imageBase64 ? [{ base64: imageBase64, mimeType: imageMimeType }] : [];
    const hasImage = rawImages.length > 0;
    if (hasImage) {
      jenis = "gambar";
      model = MODEL_GAMBAR;
    }

    if (sourceType === "Instagram" && !hasImage) {
      return tolak(400, "Unggah poster lowongan kerja Instagram terlebih dahulu.", "tanpa_gambar");
    }
    if (rawText.length > MAX_TEKS) {
      return tolak(400, "Teks iklan melebihi batas maksimal 10.000 karakter.", "teks_terlalu_panjang");
    }

    let gambar: GambarTervalidasi[] = [];
    if (hasImage) {
      try {
        gambar = validasiGambar(rawImages);
      } catch (e: any) {
        if (e instanceof InputError) return tolak(400, e.message, "gambar_tidak_valid");
        throw e;
      }
    }

    // Teks hanya dipakai untuk input LinkedIn (input Instagram hanya gambar poster)
    const cleanText = hasImage ? "" : sanitizeLinkedInText(rawText);

    if (!hasImage && cleanText.length < MIN_TEKS) {
      catat(200, "teks_kurang_50");
      return res.json(
        hasilError(
          "Teks kurang dari 50 karakter.",
          "Teks iklan lowongan kerja kurang dari 50 karakter sehingga tidak mencukupi untuk dianalisis. Mohon masukkan teks deskripsi lowongan yang lebih lengkap."
        )
      );
    }

    const ai = buatKlienGemini();
    if (!ai) {
      console.error("[GhostGuard] GEMINI_API_KEY belum diatur pada environment variable.");
      return tolak(500, PESAN_GAGAL, "tanpa_kunci_api");
    }

    // Kuota berurutan: global harian -> IP per jam -> pengguna (gambar per hari / teks per jam)
    const { dateKey, hourKey } = getJakartaTimeKeys();
    const naik = async (key: string, ttl: number) => {
      const r = await incrementCounterWithTtl(key, ttl);
      incrementedCounters.push({ key, ttlSeconds: ttl, backend: r.backend });
      return r.count;
    };

    if ((await naik(`gg:global:${dateKey}`, TTL_TWO_DAYS_SECONDS)) > getGlobalDailyLimit()) {
      await rollbackOnce();
      return tolak(429, "Kuota harian layanan sudah habis. Silakan coba lagi besok.", "kuota_global");
    }
    if ((await naik(`gg:ip:${ipHash}:${hourKey}`, TTL_TWO_HOURS_SECONDS)) > getIpHourlyLimit()) {
      await rollbackOnce();
      return tolak(429, "Batas laju permintaan per jam terlampaui. Silakan coba lagi nanti.", "batas_ip");
    }
    if (hasImage) {
      if ((await naik(`gg:img:${cid}:${dateKey}`, TTL_TWO_DAYS_SECONDS)) > IMAGE_DAILY_LIMIT) {
        await rollbackOnce();
        return tolak(429, `Kuota gambar hari ini sudah habis (${IMAGE_DAILY_LIMIT} per hari).`, "kuota_gambar");
      }
    } else if ((await naik(`gg:txt:${cid}:${hourKey}`, TTL_TWO_HOURS_SECONDS)) > COOKIE_TEXT_HOURLY_LIMIT) {
      await rollbackOnce();
      return tolak(429, `Batas analisis teks per jam tercapai (${COOKIE_TEXT_HOURLY_LIMIT} per jam). Coba lagi nanti.`, "batas_teks");
    }

    const injeksi = adaKalimatInjeksi(rawText);

    let teksRespons = "";
    try {
      teksRespons = (await panggilModel(ai, { teks: cleanText, gambar })).teksRespons;
    } catch (apiErr: any) {
      await rollbackOnce(); // kuota tidak terpotong bila analisis gagal
      if (apiErr instanceof TimeoutError) {
        const detik = Math.round((hasImage ? TIMEOUT_GAMBAR_MS : TIMEOUT_TEKS_MS) / 1000);
        return tolak(408, `Analisis gagal karena batas waktu ${detik} detik terlampaui. Silakan coba lagi.`, "timeout");
      }
      // detail teknis hanya dicatat di log server
      console.error("[GhostGuard Gemini]", apiErr?.status || "", String(apiErr?.message || apiErr).slice(0, 300));
      // Masalah kunci/billing hanya dijelaskan di log server, tidak ke pengguna
      if (galatTagihan(apiErr)) {
        console.error(
          "[GhostGuard] Billing Gemini: free tier tidak tersedia atau kredit habis untuk proyek GEMINI_API_KEY. Aktifkan billing di Google AI Studio atau ganti key."
        );
        return tolak(503, PESAN_GAGAL, "billing_api");
      }
      if (galatAuth(apiErr)) {
        console.error("[GhostGuard] GEMINI_API_KEY tidak valid atau tidak aktif. Perbarui di Environment Variables Vercel.");
        return tolak(503, PESAN_GAGAL, "kunci_api");
      }
      if (galatKuotaGemini(apiErr) || galatSibuk(apiErr)) {
        return tolak(503, "Layanan sedang sibuk. Kuota Anda tidak terpotong, silakan coba lagi beberapa saat lagi.", "model_sibuk");
      }
      return tolak(500, PESAN_GAGAL, "galat_model");
    }

    const parsed = parseJsonModel(teksRespons);
    if (!parsed || !keluaranValid(parsed)) {
      await rollbackOnce();
      return tolak(500, "Analisis gagal karena format hasil tidak sesuai. Silakan coba lagi.", "json_tidak_valid");
    }

    const hasil = bentukHasil(parsed);
    catat(200, hasil.skor < 0 ? "gambar_tidak_terbaca" : `skor=${hasil.skor}`);
    return res.json({
      ...hasil,
      ...(injeksi
        ? {
            promptInjectionWarning: true,
            promptInjectionMessage: "Iklan memuat kalimat yang mencoba memengaruhi penilaian. Hasil perlu dibaca hati-hati.",
          }
        : {}),
    });
  } catch (err: any) {
    await rollbackOnce();
    console.error("[GhostGuard] Galat tak terduga:", err?.message || "unknown");
    return tolak(500, PESAN_GAGAL, "galat_server");
  }
});

// Express JSON/Payload error handler so raw error HTML/JSON is never sent to client
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!err) return next();
  console.error("[GhostGuard Middleware Error]:", err?.message || err);
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: "Ukuran total unggahan terlalu besar. Kurangi jumlah slide atau gunakan gambar yang lebih kecil.",
    });
  }
  return res.status(400).json({
    error: "Permintaan tidak valid. Muat ulang halaman lalu coba lagi.",
  });
});

async function startServer() {
  let viteMiddleware: any = null;
  let viteInitError: Error | null = null;

  if (process.env.NODE_ENV !== "production") {
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next();
      }
      if (viteMiddleware) {
        return viteMiddleware(req, res, next);
      }
      if (viteInitError) {
        return res.status(500).send("Gagal memuat server pengembangan Vite.");
      }
      res
        .status(200)
        .set("Content-Type", "text/html; charset=utf-8")
        .send(
          `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta http-equiv="refresh" content="1"><title>Memuat GhostGuard...</title></head><body style="font-family:sans-serif;padding:24px">Memuat aplikasi GhostGuard...</body></html>`
        );
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GhostGuard server running on http://localhost:${PORT}`);
  });

  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      viteMiddleware = vite.middlewares;
    } catch (err: any) {
      viteInitError = err instanceof Error ? err : new Error("Vite init failed");
      console.error("[GhostGuard Vite Init Error]:", viteInitError.message);
    }
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
