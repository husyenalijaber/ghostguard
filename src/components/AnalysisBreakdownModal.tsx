import React, { useEffect } from "react";
import {
  X,
  Building2,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  FileDown,
  BarChart3,
  FileText,
  Scale,
  Wallet,
  Workflow,
  Info,
  ShieldAlert,
} from "lucide-react";
import { AnalysisResult } from "../types";
import { SpeedometerGauge } from "./SpeedometerGauge";
import { SavedInputPreview } from "./SavedInputPreview";

interface AnalysisBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: AnalysisResult | null;
  onExport?: (analysis: AnalysisResult) => void;
}

export interface DimensionBreakdownItem {
  key: "deskripsi" | "identitas" | "konsistensi" | "kompensasi" | "proses";
  label: string;
  weightPct: number;
  score: number;
  weightedContribution: number;
  description: string;
  icon: React.ReactNode;
}

export function buildFiveDimensionBreakdown(
  analysis: AnalysisResult
): DimensionBreakdownItem[] {
  const d = analysis.dimensi_skor || {
    deskripsi: 0,
    identitas: 0,
    konsistensi: 0,
    kompensasi: 0,
    proses: 0,
  };

  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n || 0)));

  return [
    {
      key: "deskripsi",
      label: "Deskripsi Pekerjaan",
      weightPct: 25,
      score: clamp(d.deskripsi),
      weightedContribution: Number(((clamp(d.deskripsi) * 25) / 100).toFixed(1)),
      description:
        "Mengukur kejelasan tanggung jawab harian, deliverable peran, serta ada/tidaknya teks generik yang terus diulang.",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      key: "identitas",
      label: "Identitas Perusahaan",
      weightPct: 20,
      score: clamp(d.identitas),
      weightedContribution: Number(((clamp(d.identitas) * 20) / 100).toFixed(1)),
      description:
        "Menilai kejelasan nama perusahaan, domain/kontak resmi, lokasi kerja, dan jejak verifikasi entitas perekrut.",
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      key: "konsistensi",
      label: "Konsistensi Persyaratan",
      weightPct: 20,
      score: clamp(d.konsistensi),
      weightedContribution: Number(((clamp(d.konsistensi) * 20) / 100).toFixed(1)),
      description:
        "Mengecek kesesuaian level posisi, tahun pengalaman, dan daftar keahlian yang realistis tanpa syarat kontradiktif.",
      icon: <Scale className="w-4 h-4" />,
    },
    {
      key: "kompensasi",
      label: "Transparansi Kompensasi",
      weightPct: 20,
      score: clamp(d.kompensasi),
      weightedContribution: Number(((clamp(d.kompensasi) * 20) / 100).toFixed(1)),
      description:
        "Menilai keterbukaan rentang gaji, status kontrak/penuh waktu, serta kewajaran skema remunerasi yang ditawarkan.",
      icon: <Wallet className="w-4 h-4" />,
    },
    {
      key: "proses",
      label: "Proses Rekrutmen",
      weightPct: 15,
      score: clamp(d.proses),
      weightedContribution: Number(((clamp(d.proses) * 15) / 100).toFixed(1)),
      description:
        "Mendeteksi kejelasan tahapan seleksi, kanal lamaran resmi, tenggat waktu, serta absennya permintaan biaya/data sensitif.",
      icon: <Workflow className="w-4 h-4" />,
    },
  ];
}

export function getDimensionRiskMeta(score: number): {
  label: string;
  barClass: string;
  textClass: string;
  surfaceClass: string;
} {
  if (score <= 33) {
    return {
      label: "Rendah",
      barClass: "bg-emerald-600 dark:bg-emerald-500",
      textClass: "text-emerald-800 dark:text-emerald-300",
      surfaceClass: "bg-emerald-50/70 dark:bg-emerald-950/40",
    };
  }
  if (score <= 66) {
    return {
      label: "Sedang",
      barClass: "bg-amber-500 dark:bg-amber-400",
      textClass: "text-amber-800 dark:text-amber-300",
      surfaceClass: "bg-amber-50/70 dark:bg-amber-950/40",
    };
  }
  return {
    label: "Tinggi",
    barClass: "bg-rose-600 dark:bg-rose-500",
    textClass: "text-rose-800 dark:text-rose-300",
    surfaceClass: "bg-rose-50/70 dark:bg-rose-950/40",
  };
}

export const AnalysisBreakdownModal: React.FC<AnalysisBreakdownModalProps> = ({
  isOpen,
  onClose,
  analysis,
  onExport,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !analysis) return null;

  const dimensions = buildFiveDimensionBreakdown(analysis);
  const redFlags = analysis.red_flags || analysis.redFlags || [];
  const score = analysis.skor >= 0 ? analysis.skor : analysis.totalScore || 0;
  const kategori =
    analysis.kategori && analysis.kategori !== "Error"
      ? analysis.kategori
      : score <= 33
      ? "Rendah"
      : score <= 66
      ? "Sedang"
      : "Tinggi";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 dark:bg-black/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="breakdown-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 dark:text-teal-300 mb-1">
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Laporan Hasil Analisis &amp; Rincian 5 Dimensi</span>
            </div>
            <h2
              id="breakdown-modal-title"
              className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate"
            >
              {analysis.posisi || analysis.jobTitle || "Detail Lowongan"}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {analysis.perusahaan || analysis.companyName || "Perusahaan tidak disebutkan"}
              </span>
              <span aria-hidden="true">&middot;</span>
              <span>{analysis.jenisInput}</span>
              <span aria-hidden="true">&middot;</span>
              <span className="tabular-nums">{analysis.tanggal}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal hasil analisis"
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Top Overview: Score Gauge + Executive Summary */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center pb-5 border-b border-slate-200 dark:border-slate-800">
            <div className="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
              <SpeedometerGauge score={score} kategori={kategori} />
            </div>

            <div className="md:col-span-7 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Klasifikasi Risiko Keseluruhan
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-extrabold ${
                    kategori === "Rendah"
                      ? "text-emerald-800 dark:text-emerald-300"
                      : kategori === "Sedang"
                      ? "text-amber-800 dark:text-amber-300"
                      : "text-rose-800 dark:text-rose-300"
                  }`}
                >
                  {kategori === "Rendah" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : kategori === "Sedang" ? (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertOctagon className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    Indikasi risiko {kategori} ({score}/100)
                  </span>
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {analysis.penjelasan || "Ringkasan evaluasi tidak tersedia."}
              </p>

              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">
                  Sinyal Peringatan Terdeteksi
                </span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                  {redFlags.length} Red Flags
                </span>
              </div>
            </div>
          </div>

          {analysis.promptInjectionWarning && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-semibold">
                {analysis.promptInjectionMessage ||
                  "Iklan memuat kalimat yang mencoba memengaruhi penilaian. Hasil perlu dibaca hati-hati."}
              </p>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2">
            <Info className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">
              Hasil ini adalah alat bantu berdasarkan isi iklan, bukan bukti bahwa perusahaan melakukan ghost job.
            </p>
          </div>

          {/* 5 Dimensions Detailed Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Rincian 5 Dimensi Penilaian Risiko
              </h3>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Total bobot 100% &middot; Skala risiko 0–100
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
              {dimensions.map((dim, idx) => {
                const meta = getDimensionRiskMeta(dim.score);
                return (
                  <div
                    key={dim.key}
                    className="p-4 space-y-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                          {dim.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              0{idx + 1}. {dim.label}
                            </span>
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              Bobot {dim.weightPct}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-bold ${meta.textClass}`}>
                          {meta.label}
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                          {dim.score}/100
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${meta.barClass}`}
                        style={{ width: `${dim.score}%` }}
                      />
                    </div>

                    <div className="flex items-start justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
                      <p className="leading-relaxed">{dim.description}</p>
                      <span className="shrink-0 font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-400">
                        +{dim.weightedContribution} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Red Flags Detail */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Temuan Red Flags ({redFlags.length})
            </h3>
            {redFlags.length > 0 ? (
              <ul className="space-y-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                {redFlags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-rose-600 dark:text-rose-400 font-bold leading-none mt-1">
                      &bull;
                    </span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                &check; Tidak ditemukan sinyal peringatan mencurigakan pada iklan lowongan ini.
              </p>
            )}
          </div>

          <SavedInputPreview analysis={analysis} defaultExpanded={true} />
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          {onExport ? (
            <button
              type="button"
              onClick={() => onExport(analysis)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-teal-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Ekspor Laporan (PDF/PNG)</span>
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
