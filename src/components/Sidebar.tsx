import { GhostGuardLogo } from "./GhostGuardLogo";
import React from "react";
import {
  Shield,
  Plus,
  Trash2,
  LayoutDashboard,
  Lightbulb,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { GoogleColoredGhostGuard } from "./GoogleColoredBrand";
import { AnalysisResult } from "../types";

interface SidebarProps {
  currentView: "dashboard" | "chat";
  onSelectView: (view: "dashboard" | "chat") => void;
  history: AnalysisResult[];
  selectedHistoryId?: string | null;
  onSelectHistoryItem?: (item: AnalysisResult) => void;
  onDeleteHistoryItem?: (id: string) => void;
  onNewCheck?: () => void;
  onGoHome?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  history,
  selectedHistoryId,
  onSelectHistoryItem,
  onDeleteHistoryItem,
  onNewCheck,
  onGoHome,
}) => {
  const handleNewCheckClick = () => {
    onSelectView("chat");
    onNewCheck?.();
  };

  return (
    <aside className="w-64 xl:w-68 bg-gradient-to-b from-slate-50 via-white to-teal-50/35 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 select-none h-full overflow-hidden transition-colors">
      {/* Brand & Navigation */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Brand Header */}
        <button
          type="button"
          onClick={() => onGoHome?.()}
          className="w-full p-4 border-b border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5 shrink-0 text-left hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
          title="Kembali ke Halaman Depan GhostGuard"
        >
          <GhostGuardLogo className="w-8 h-8 rounded-lg mt-0.5" />
          <div className="min-w-0">
            <GoogleColoredGhostGuard size="sm" />
            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium block leading-snug mt-0.5">
              Detektor Ghost Job (LinkedIn &amp; IG)
            </span>
          </div>
        </button>

        {/* Primary Action Button & Navigation */}
        <div className="p-3 shrink-0 space-y-2">
          <button
            type="button"
            onClick={handleNewCheckClick}
            title="Mulai pemeriksaan iklan lowongan baru (Ctrl+N)"
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-white font-bold text-xs transition-all shadow-sm shadow-teal-900/15 cursor-pointer active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          >
            <Plus className="w-4 h-4" />
            <span>Periksa Loker Baru</span>
          </button>

          {/* Navigation Items with Descriptive Tooltips */}
          <div className="space-y-1 pt-1">
            <button
              type="button"
              onClick={() => onSelectView("dashboard")}
              title="Lihat ringkasan statistik dan seluruh riwayat audit Anda"
              className={`group relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                currentView === "dashboard"
                  ? "bg-teal-50/90 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 border border-teal-200/80 dark:border-teal-800 font-bold"
                  : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/70 border border-transparent"
              }`}
            >
              <LayoutDashboard
                className={`w-4 h-4 shrink-0 ${
                  currentView === "dashboard"
                    ? "text-teal-700 dark:text-teal-400"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              />
              <span className="truncate">Dashboard Riwayat</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView("chat")}
              title="Buka halaman input teks LinkedIn & unggah poster Instagram"
              className={`group relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                currentView === "chat"
                  ? "bg-teal-50/90 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 border border-teal-200/80 dark:border-teal-800 font-bold"
                  : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/70 border border-transparent"
              }`}
            >
              <Shield
                className={`w-4 h-4 shrink-0 ${
                  currentView === "chat"
                    ? "text-teal-700 dark:text-teal-400"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              />
              <span className="truncate">Deteksi (LinkedIn &amp; IG)</span>
            </button>
          </div>
        </div>

        {/* Section: Riwayat Analisis OR Quick Tips when Empty */}
        <div className="px-3 pt-2.5 mt-1 border-t border-slate-200/80 dark:border-slate-800 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider shrink-0">
            <span>
              {history.length > 0 ? `Riwayat Analisis (${history.length})` : "Tips Audit Cepat"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 mt-1 scrollbar-thin">
            {history.length === 0 ? (
              <div className="space-y-2 py-1">
                <div className="p-2.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-900 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 dark:text-teal-200">
                    <Lightbulb className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                    <span>Waspada Loker Abadi</span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                    Lowongan tanpa tenggat waktu &amp; deskripsi umum sering menandakan pengumpulan CV semata.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/40 border border-sky-200/70 dark:border-sky-900 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900 dark:text-sky-200">
                    <Sparkles className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400 shrink-0" />
                    <span>Cek Gaji &amp; Syarat</span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                    Bandingkan syarat pengalaman dengan level posisi dan cek kejelasan kompensasi.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Siap Mulai?</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                    Tempel teks iklan LinkedIn atau unggah poster Instagram Anda di kanan.
                  </p>
                </div>
              </div>
            ) : (
              history.map((item) => {
                const s = item.skor !== undefined && item.skor >= 0 ? item.skor : item.totalScore || 0;
                const dotColor =
                  s <= 33 || item.kategori === "Rendah"
                    ? "bg-[#34a853]"
                    : s >= 67 || item.kategori === "Tinggi"
                    ? "bg-[#ea4335]"
                    : "bg-[#fbbc04]";
                const isSelected = selectedHistoryId === item.id;
                const companyName = item.perusahaan || item.companyName || "Tidak disebutkan";
                const jobTitle = item.posisi || item.jobTitle || "Lowongan Kerja";

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectView("chat");
                      onSelectHistoryItem?.(item);
                    }}
                    title={`Buka hasil audit: ${jobTitle} (${companyName})`}
                    className={`group relative flex items-start justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer border ${
                      isSelected && currentView === "chat"
                        ? "bg-teal-50/70 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800 text-slate-900 dark:text-white font-semibold"
                        : "border-transparent hover:bg-slate-100/70 dark:hover:bg-slate-800/60 text-slate-900 dark:text-slate-200"
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">
                          {jobTitle}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 truncate font-medium">
                          <span className="truncate">{companyName}</span>
                          <span>•</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">
                            {s}/100
                          </span>
                        </div>
                      </div>
                    </div>

                    {onDeleteHistoryItem && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteHistoryItem(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 dark:hover:text-rose-400 text-slate-500 rounded transition-opacity shrink-0 cursor-pointer"
                        title="Hapus item ini dari riwayat"
                        aria-label={`Hapus ${jobTitle} dari riwayat`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
