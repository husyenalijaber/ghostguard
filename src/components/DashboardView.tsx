import React, { useState } from "react";
import {
  Briefcase,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Search,
  Plus,
  MapPin,
  Calendar,
  ChevronRight,
  Trash2,
  RefreshCw,
  AlertOctagon,
  BarChart3,
} from "lucide-react";
import { AnalysisResult } from "../types";
import { AnalysisBreakdownModal } from "./AnalysisBreakdownModal";

interface DashboardViewProps {
  history: AnalysisResult[];
  onSelectJob: (job: AnalysisResult) => void;
  onNewScan: () => void;
  onDeleteJob?: (id: string) => void;
  onClearAllHistory?: () => void;
  isLoadingHistory?: boolean;
  historyError?: string | null;
  onRetryLoadHistory?: () => void;
}

const EmptyDashboardIllustration: React.FC = () => (
  <svg
    viewBox="0 0 180 120"
    className="w-40 h-28 mx-auto"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="90" cy="60" r="50" className="fill-teal-50 dark:fill-teal-950/60" />
    <circle
      cx="90"
      cy="60"
      r="38"
      className="stroke-teal-200 dark:stroke-teal-800"
      strokeWidth="1.5"
      strokeDasharray="4 4"
    />
    <rect
      x="54"
      y="28"
      width="56"
      height="66"
      rx="10"
      className="fill-white dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-600"
      strokeWidth="2"
    />
    <rect
      x="64"
      y="42"
      width="32"
      height="5"
      rx="2.5"
      className="fill-teal-600 dark:fill-teal-400"
    />
    <rect
      x="64"
      y="53"
      width="36"
      height="4"
      rx="2"
      className="fill-slate-200 dark:fill-slate-600"
    />
    <rect
      x="64"
      y="62"
      width="26"
      height="4"
      rx="2"
      className="fill-slate-200 dark:fill-slate-600"
    />
    <rect
      x="64"
      y="71"
      width="30"
      height="4"
      rx="2"
      className="fill-slate-200 dark:fill-slate-600"
    />
    <circle
      cx="114"
      cy="76"
      r="16"
      className="fill-teal-700 stroke-white dark:stroke-slate-900"
      strokeWidth="3"
    />
    <path
      d="M114 68l6 2.7v4.5c0 3.7-2.6 7-6 8-3.4-1-6-4.3-6-8v-4.5l6-2.7z"
      className="fill-white"
    />
  </svg>
);

export const DashboardView: React.FC<DashboardViewProps> = ({
  history,
  onSelectJob,
  onNewScan,
  onDeleteJob,
  onClearAllHistory,
  isLoadingHistory = false,
  historyError = null,
  onRetryLoadHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [breakdownJob, setBreakdownJob] = useState<AnalysisResult | null>(null);

  const validHistory = history.filter(
    (item) => item.skor >= 0 || (typeof item.totalScore === "number" && item.totalScore >= 0)
  );
  const totalJobs = validHistory.length;

  const avgRiskScore =
    totalJobs > 0
      ? Math.round(
          validHistory.reduce((acc, curr) => {
            const s = curr.skor !== undefined && curr.skor >= 0 ? curr.skor : curr.totalScore || 0;
            return acc + s;
          }, 0) / totalJobs
        )
      : 0;

  const totalRedFlags = validHistory.reduce((acc, curr) => {
    const flagsCount = curr.red_flags?.length || curr.redFlags?.length || 0;
    return acc + flagsCount;
  }, 0);

  const ghostJobsCount = validHistory.filter((item) => {
    const s = item.skor !== undefined && item.skor >= 0 ? item.skor : item.totalScore || 0;
    return s >= 67 || item.kategori === "Tinggi" || item.classification === "GHOST JOB";
  }).length;

  const filteredJobs = validHistory.filter((job) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const pers = (job.perusahaan || job.companyName || "").toLowerCase();
    const pos = (job.posisi || job.jobTitle || "").toLowerCase();
    const kat = (job.kategori || "").toLowerCase();
    return pers.includes(q) || pos.includes(q) || kat.includes(q);
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f9fa] dark:bg-slate-950 p-4 sm:p-6 lg:p-8 transition-colors">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Dashboard Riwayat Pemeriksaan
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">
              Pantau dan audit lowongan kerja untuk mengidentifikasi indikasi ghost job di LinkedIn dan Instagram.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {totalJobs > 0 && onClearAllHistory && (
              <>
                {isConfirmingClear ? (
                  <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-xl">
                    <span className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                      Hapus semua?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClearAllHistory();
                        setIsConfirmingClear(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 cursor-pointer"
                    >
                      Ya
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingClear(false)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClear(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-rose-400 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:text-rose-600 font-semibold text-xs shadow-2xs transition-all cursor-pointer"
                    title="Hapus seluruh riwayat pemeriksaan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus riwayat</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onNewScan}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm shadow-teal-900/15 transition-all cursor-pointer active:scale-95"
            >
              <Search className="w-4 h-4" />
              <span>Periksa Loker Baru</span>
            </button>
          </div>
        </div>

        {/* 4 Stat Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all text-center">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Total Pemeriksaan
              </span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3 flex items-center justify-center">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                {totalJobs}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Total lowongan yang diaudit
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all text-center">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Rata-rata Skor Risiko
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${
                  avgRiskScore <= 33
                    ? "bg-[#e6f4ea] text-[#34a853] border-[#34a853]/20"
                    : avgRiskScore <= 66
                    ? "bg-[#fef7e0] text-[#b06000] border-[#fbbc04]/30"
                    : "bg-[#fce8e6] text-[#c5221f] border-[#ea4335]/30"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3 flex items-baseline justify-center gap-1">
              <span
                className={`text-4xl font-extrabold tracking-tight tabular-nums ${
                  avgRiskScore <= 33
                    ? "text-[#137333] dark:text-emerald-400"
                    : avgRiskScore <= 66
                    ? "text-[#b06000] dark:text-amber-400"
                    : "text-[#c5221f] dark:text-rose-400"
                }`}
              >
                {totalJobs > 0 ? avgRiskScore : 0}
              </span>
              <span className="text-xl font-bold text-slate-500 dark:text-slate-400">
                /100
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {totalJobs === 0
                ? "Belum ada data evaluasi"
                : avgRiskScore <= 33
                ? "Kategori Rendah (0–33)"
                : avgRiskScore <= 66
                ? "Kategori Sedang (34–66)"
                : "Kategori Tinggi (67–100)"}
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs flex flex-col justify-between hover:border-[#fbbc04]/40 transition-all text-center">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sinyal Red Flags
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#fef7e0] text-[#b06000] flex items-center justify-center border border-[#fbbc04]/30 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3 flex items-center justify-center">
              <span className="text-4xl font-extrabold text-[#b06000] dark:text-amber-400 tracking-tight tabular-nums">
                {totalRedFlags}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Total sinyal peringatan terdeteksi
            </p>
          </div>

          {/* Card 4 */}
          <div
            title="Menghitung jumlah lowongan dengan skor risiko total keseluruhan ≥67 (bukan skor per sub-dimensi)"
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs flex flex-col justify-between hover:border-[#ea4335]/40 transition-all text-center"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Indikasi Risiko Tinggi
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#fce8e6] text-[#c5221f] flex items-center justify-center border border-[#ea4335]/30 shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3 flex items-center justify-center">
              <span className="text-4xl font-extrabold text-[#c5221f] dark:text-rose-400 tracking-tight tabular-nums">
                {ghostJobsCount}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Lowongan berskor total &ge;67
            </p>
          </div>
        </div>

        {/* Scanned Jobs List Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Daftar Riwayat Lowongan ({filteredJobs.length})
            </h2>

            {totalJobs > 0 && (
              <div className="relative w-52 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari perusahaan / posisi..."
                  aria-label="Cari riwayat lowongan"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-teal-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Loading, Error, Empty, or Filtered Empty States */}
          {isLoadingHistory ? (
            <div className="space-y-2.5 animate-pulse" aria-live="polite" aria-busy="true">
              {[1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-3 w-64 rounded bg-slate-200 dark:bg-slate-800" />
                  </div>
                  <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
                </div>
              ))}
            </div>
          ) : historyError ? (
            <div
              role="alert"
              className="bg-rose-50/75 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800 p-6 sm:p-8 text-center space-y-3"
            >
              <div className="w-11 h-11 rounded-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 mx-auto flex items-center justify-center text-rose-600 dark:text-rose-400">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                Gagal Memuat Riwayat Pemeriksaan
              </h3>
              <p className="text-xs sm:text-sm text-rose-800 dark:text-rose-200 max-w-md mx-auto">
                {historyError}
              </p>
              {onRetryLoadHistory && (
                <button
                  type="button"
                  onClick={onRetryLoadHistory}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Muat Ulang Riwayat</span>
                </button>
              )}
            </div>
          ) : totalJobs === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 sm:p-10 text-center space-y-3">
              <EmptyDashboardIllustration />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Belum Ada Riwayat Pemeriksaan
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Mulai periksa lowongan kerja pertama Anda dengan menempelkan teks iklan LinkedIn atau mengunggah poster Instagram.
              </p>
              <button
                type="button"
                onClick={onNewScan}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Periksa Loker Sekarang</span>
              </button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                Tidak ada lowongan yang cocok dengan pencarian &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Pencarian</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredJobs.map((job) => {
                const s = job.skor !== undefined && job.skor >= 0 ? job.skor : job.totalScore || 0;
                const kat = job.kategori || (s <= 33 ? "Rendah" : s <= 66 ? "Sedang" : "Tinggi");

                let badgeStyle = "bg-[#e6f4ea] text-[#137333] border-[#34a853]";
                if (kat === "Tinggi" || s >= 67) {
                  badgeStyle = "bg-[#fce8e6] text-[#c5221f] border-[#ea4335]";
                } else if (kat === "Sedang" || s >= 34) {
                  badgeStyle = "bg-[#fef7e0] text-[#b06000] border-[#fbbc04]";
                }

                const companyName = job.perusahaan || job.companyName || "Tidak disebutkan";
                const jobTitle = job.posisi || job.jobTitle || "Tidak disebutkan";
                const dateText =
                  job.tanggal ||
                  new Date(job.timestamp).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                const platform = job.jenisInput || "LinkedIn";

                const savedThumb = job.inputDetails?.images?.[0]?.dataUrl;
                const savedPhotoCount = job.inputDetails?.images?.length || 0;

                return (
                  <div
                    key={job.id}
                    onClick={() => onSelectJob(job)}
                    className="w-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 transition-all shadow-2xs hover:shadow-xs cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {savedThumb && (
                        <img
                          src={savedThumb}
                          alt={`Poster ${companyName}`}
                          className="w-11 h-11 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800"
                        />
                      )}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors">
                            {companyName}
                          </h3>
                          <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                            &bull; {jobTitle}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            <span>Platform: {platform}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>{dateText}</span>
                          </span>
                          {savedPhotoCount > 0 && (
                            <span className="text-teal-700 dark:text-teal-400 font-semibold">
                              &bull; {savedPhotoCount} Foto tersimpan
                            </span>
                          )}
                          {job.red_flags && job.red_flags.length > 0 && (
                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                              &bull; {job.red_flags.length} Red Flag
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badgeStyle}`}
                      >
                        <span className="font-mono">{s}</span>
                        <span>&bull;</span>
                        <span>Indikasi risiko {kat}</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBreakdownJob(job);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-xs font-semibold transition-colors cursor-pointer"
                        title="Lihat breakdown 5 dimensi dalam modal"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">5 Dimensi</span>
                      </button>

                      {onDeleteJob && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteJob(job.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                          title="Hapus lowongan dari riwayat"
                          aria-label={`Hapus ${jobTitle} dari riwayat`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-teal-700 dark:group-hover:text-teal-300 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AnalysisBreakdownModal
        isOpen={Boolean(breakdownJob)}
        onClose={() => setBreakdownJob(null)}
        analysis={breakdownJob}
      />
    </div>
  );
};
