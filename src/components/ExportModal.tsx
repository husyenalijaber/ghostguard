import React, { useState } from "react";
import {
  X,
  FileDown,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Building,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { AnalysisResult } from "../types";
import { exportAnalysisAsPDF, exportAnalysisAsImage } from "../utils/exportUtils";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: AnalysisResult | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  analysis,
}) => {
  const [exportingType, setExportingType] = useState<"pdf" | "image" | null>(
    null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !analysis) return null;

  const handleExportPDF = async () => {
    try {
      setExportingType("pdf");
      setSuccessMessage(null);
      // Small delay for UI smoothness
      await new Promise((r) => setTimeout(r, 200));
      exportAnalysisAsPDF(analysis);
      setSuccessMessage("Dokumen PDF berhasil diunduh ke perangkat Anda!");
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      console.error("Gagal mengekspor PDF:", err);
    } finally {
      setExportingType(null);
    }
  };

  const handleExportImage = async () => {
    try {
      setExportingType("image");
      setSuccessMessage(null);
      await new Promise((r) => setTimeout(r, 200));
      await exportAnalysisAsImage(analysis);
      setSuccessMessage("Gambar PNG audit berhasil diunduh ke perangkat Anda!");
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      console.error("Gagal mengekspor Gambar:", err);
    } finally {
      setExportingType(null);
    }
  };

  const scoreVal = analysis.skor !== undefined && analysis.skor >= 0 ? analysis.skor : analysis.totalScore || 0;
  const katVal = analysis.kategori || (scoreVal <= 33 ? "Rendah" : scoreVal <= 66 ? "Sedang" : "Tinggi");
  const perusahaanVal = analysis.perusahaan || analysis.companyName || "Tidak disebutkan";
  const posisiVal = analysis.posisi || analysis.jobTitle || "Tidak disebutkan";

  return (
    <div
      id="export-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="export-modal-container"
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                Ekspor Hasil Analisis
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Simpan hasil analisis GhostGuard dalam format PDF atau gambar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal ekspor"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup Jendela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 space-y-4 text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
          {/* Target Job Quick Summary Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {posisiVal}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  katVal === "Rendah"
                    ? "bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#137333] dark:text-emerald-300 border-[#34a853] dark:border-emerald-700"
                    : katVal === "Sedang"
                    ? "bg-[#fef7e0] dark:bg-amber-950/60 text-[#b06000] dark:text-amber-300 border-[#fbbc04] dark:border-amber-700"
                    : "bg-[#fce8e6] dark:bg-rose-950/60 text-[#c5221f] dark:text-rose-300 border-[#ea4335] dark:border-rose-700"
                }`}
              >
                Indikasi risiko {katVal}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                {perusahaanVal}
              </span>
              <span className="text-slate-400 dark:text-slate-600">•</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Skor Risiko: {scoreVal}/100
              </span>
            </div>
          </div>

          {/* Success Toast / Alert */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Option 1: PDF Export */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-slate-950/50 transition-all space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/60 shrink-0 mt-0.5">
                  <FileDown className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                    Laporan Lengkap Dokumen PDF (.pdf)
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Dokumen standar A4 berisi skor risiko, kategori, rincian 5 dimensi berbobot, daftar red flags, dan penjelasan analisis.
                  </p>
                </div>
              </div>
            </div>

            <button
              id="btn-export-pdf"
              type="button"
              disabled={exportingType !== null}
              onClick={handleExportPDF}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 disabled:opacity-50 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              {exportingType === "pdf" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membuat Berkas PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Unduh Dokumen PDF (.pdf)</span>
                </>
              )}
            </button>
          </div>

          {/* Option 2: Image Export */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-slate-950/50 transition-all space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                    Ringkasan Gambar (.png)
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Visual ringkasan hasil analisis beresolusi tinggi untuk disimpan di perangkat Anda.
                  </p>
                </div>
              </div>
            </div>

            <button
              id="btn-export-png"
              type="button"
              disabled={exportingType !== null}
              onClick={handleExportImage}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 active:scale-98 disabled:opacity-50 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              {exportingType === "image" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membuat Gambar...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  <span>Unduh Gambar (.png)</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Semua proses ekspor dilakukan secara lokal langsung di peramban Anda.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
