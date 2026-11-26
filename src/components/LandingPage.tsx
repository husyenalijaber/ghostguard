import { GhostGuardLogo } from "./GhostGuardLogo";
import React, { useState } from "react";
import {
  CheckCircle2,
  ArrowRight,
  Sun,
  Moon,
} from "lucide-react";

interface LandingPageProps {
  onStartCheck: () => void;
  isDark?: boolean;
  onToggleDarkMode?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartCheck,
  isDark = false,
  onToggleDarkMode,
}) => {
  const [hoveredPlatform, setHoveredPlatform] = useState<
    "linkedin" | "instagram" | null
  >(null);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-sky-50 via-white to-teal-50/70 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/35 flex flex-col justify-center px-4 py-6 sm:px-6 lg:px-10 font-sans antialiased text-slate-900 dark:text-slate-100 transition-colors">
      {/* Theme Switcher Top Right */}
      {onToggleDarkMode && (
        <div className="fixed top-4 right-4 z-40">
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
            title={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 shadow-sm backdrop-blur-md text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          >
            {isDark ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Mode Terang</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-slate-700" />
                <span className="hidden sm:inline">Mode Gelap</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Subtle Background Pattern */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden select-none"
        aria-hidden="true"
      >
        <div className="absolute -top-36 -left-36 w-[28rem] h-[28rem] rounded-full bg-sky-200/25 dark:bg-sky-900/20 blur-3xl" />
        <div className="absolute -bottom-36 -right-36 w-[28rem] h-[28rem] rounded-full bg-teal-200/25 dark:bg-teal-900/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.18] dark:opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* Main Content: Responsive Single-Column on Mobile/Tablet, Split Two-Column on Desktop */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col lg:grid lg:grid-cols-12 gap-5 lg:gap-10 items-center pt-8 sm:pt-4 lg:pt-0">
        {/* Mobile/Tablet Compact Brand Header above card */}
        <div className="flex lg:hidden w-full max-w-md mx-auto items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <GhostGuardLogo className="w-9 h-9 rounded-xl shadow-xs" />
            <div className="min-w-0">
              <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white block leading-tight">
                GhostGuard
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-300 block truncate">
                Deteksi <strong className="font-semibold text-slate-900 dark:text-white">Ghost Job</strong> &amp;{" "}
                <strong className="font-semibold text-slate-900 dark:text-white">Risiko</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-semibold shrink-0 text-slate-700 dark:text-slate-300">
            <span>LinkedIn</span>
            <span aria-hidden="true">&middot;</span>
            <span>Instagram</span>
          </div>
        </div>

        {/* Desktop Left Column: Supporting Context */}
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-center space-y-5 pr-4">
          <div className="flex items-center gap-2.5">
            <GhostGuardLogo className="w-9 h-9 rounded-xl shadow-sm" />
            <div>
              <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                GhostGuard
              </p>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
                Audit Lowongan Kerja Berbasis Risiko
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg xl:text-xl font-semibold text-slate-800 dark:text-slate-100 leading-snug tracking-tight">
              Deteksi{" "}
              <strong className="text-teal-800 dark:text-teal-300 font-bold">
                Ghost Job
              </strong>{" "}
              &amp; ukur{" "}
              <strong className="text-teal-800 dark:text-teal-300 font-bold">
                Risiko
              </strong>{" "}
              sebelum melamar
            </h2>

            <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                <span>
                  Evaluasi teks iklan{" "}
                  <strong className="font-semibold text-slate-800 dark:text-white">
                    LinkedIn
                  </strong>{" "}
                  &amp; poster{" "}
                  <strong className="font-semibold text-slate-800 dark:text-white">
                    Instagram
                  </strong>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                <span>
                  Skor{" "}
                  <strong className="font-semibold text-slate-800 dark:text-white">
                    Risiko 0–100
                  </strong>{" "}
                  terukur di 5 dimensi
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                <span>
                  Klasifikasi cepat:{" "}
                  <strong className="font-semibold text-slate-800 dark:text-white">
                    Rendah, Sedang, Tinggi
                  </strong>
                </span>
              </li>
            </ul>

            <div className="pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Sumber Iklan yang Didukung
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="relative"
                  onMouseEnter={() => setHoveredPlatform("linkedin")}
                  onMouseLeave={() => setHoveredPlatform(null)}
                >
                  <button
                    type="button"
                    onFocus={() => setHoveredPlatform("linkedin")}
                    onBlur={() => setHoveredPlatform(null)}
                    aria-label="Informasi dukungan iklan teks LinkedIn"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-600 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs transition-colors cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                    </svg>
                    <span>Teks LinkedIn</span>
                  </button>
                  {hoveredPlatform === "linkedin" && (
                    <div
                      role="tooltip"
                      className="absolute left-0 top-full mt-1.5 w-56 p-2.5 rounded-lg bg-slate-900 dark:bg-slate-800 border border-slate-700 text-white text-[11px] leading-snug shadow-lg z-30"
                    >
                      Tempel deskripsi lowongan LinkedIn untuk mendeteksi indikasi evergreen atau spesifikasi tidak konsisten.
                    </div>
                  )}
                </div>

                <div
                  className="relative"
                  onMouseEnter={() => setHoveredPlatform("instagram")}
                  onMouseLeave={() => setHoveredPlatform(null)}
                >
                  <button
                    type="button"
                    onFocus={() => setHoveredPlatform("instagram")}
                    onBlur={() => setHoveredPlatform(null)}
                    aria-label="Informasi dukungan poster Instagram"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs transition-colors cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                    </svg>
                    <span>Poster Instagram</span>
                  </button>
                  {hoveredPlatform === "instagram" && (
                    <div
                      role="tooltip"
                      className="absolute left-0 top-full mt-1.5 w-56 p-2.5 rounded-lg bg-slate-900 dark:bg-slate-800 border border-slate-700 text-white text-[11px] leading-snug shadow-lg z-30"
                    >
                      Unggah gambar poster lowongan (PNG/JPG/WEBP) untuk memeriksa kelengkapan identitas, gaji, dan proses rekrutmen.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Clean CTA Card */}
        <div className="w-full lg:col-span-7 flex justify-center lg:justify-end">
          <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-sky-950/10 dark:shadow-black/40 p-6 sm:p-8 space-y-6">
            <div className="space-y-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Mulai Periksa Lowongan
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Tempel teks iklan LinkedIn atau unggah poster Instagram untuk mendeteksi indikasi risiko lowongan secara langsung tanpa akun.
              </p>
            </div>

            <button
              type="button"
              onClick={onStartCheck}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 active:scale-[0.99] text-white font-bold text-sm transition-all shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
            >
              <span>Mulai Periksa</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
