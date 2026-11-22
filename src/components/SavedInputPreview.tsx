import React, { useState, useEffect } from "react";
import {
  FileText,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { AnalysisResult } from "../types";

interface SavedInputPreviewProps {
  analysis: AnalysisResult;
  defaultExpanded?: boolean;
}

export const SavedInputPreview: React.FC<SavedInputPreviewProps> = ({
  analysis,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    setIsExpanded(defaultExpanded);
    setCopied(false);
    setLightboxIdx(null);
  }, [analysis.id, defaultExpanded]);

  const isInstagram = analysis.jenisInput === "Instagram";
  const savedImages = analysis.inputDetails?.images ?? [];
  const savedText =
    analysis.inputDetails?.text !== undefined
      ? analysis.inputDetails.text
      : !isInstagram
      ? analysis.originalInput || ""
      : "";
  const legacySummary =
    isInstagram && !analysis.inputDetails && analysis.originalInput
      ? analysis.originalInput
      : "";

  const hasAnyContent =
    savedImages.length > 0 || Boolean(savedText.trim()) || Boolean(legacySummary.trim());

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setLightboxIdx(null);
      } else if (e.key === "ArrowLeft" && savedImages.length > 1) {
        setLightboxIdx((prev) =>
          prev === null ? null : (prev - 1 + savedImages.length) % savedImages.length
        );
      } else if (e.key === "ArrowRight" && savedImages.length > 1) {
        setLightboxIdx((prev) =>
          prev === null ? null : (prev + 1) % savedImages.length
        );
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [lightboxIdx, savedImages.length]);

  if (!hasAnyContent) return null;

  const handleCopyText = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = savedText || legacySummary;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const summaryParts: string[] = [];
  if (savedImages.length > 0) {
    summaryParts.push(`${savedImages.length} slide poster`);
  }
  if (savedText.trim()) {
    summaryParts.push(
      isInstagram
        ? `caption (${savedText.trim().length.toLocaleString("id-ID")} karakter)`
        : `${savedText.trim().length.toLocaleString("id-ID")} karakter`
    );
  }
  if (summaryParts.length === 0 && legacySummary) {
    summaryParts.push("ringkasan input lama");
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/35 overflow-hidden">
        {/* Header Bar */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsExpanded((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsExpanded((prev) => !prev);
            }
          }}
          aria-expanded={isExpanded}
          className="w-full px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-teal-700 dark:text-teal-400 shrink-0">
              {isInstagram ? (
                <ImageIcon className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                Input yang Dianalisis ({analysis.jenisInput})
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                {summaryParts.join(" · ")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(savedText.trim() || legacySummary.trim()) && (
              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-teal-600 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                title="Salin teks input ke clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            )}

            <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 dark:text-teal-300">
              <span className="hidden sm:inline">
                {isExpanded ? "Sembunyikan" : "Lihat Input"}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-3 bg-white/70 dark:bg-slate-900/50">
            {/* Uploaded Poster Slides (Instagram) */}
            {savedImages.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Poster Instagram ({savedImages.length} slide) — klik gambar untuk memperbesar
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {savedImages.map((img, idx) => (
                    <button
                      key={`${img.name}-${idx}`}
                      type="button"
                      onClick={() => setLightboxIdx(idx)}
                      className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950/70 p-2 flex flex-col gap-1.5 text-left hover:border-teal-600 transition-colors cursor-zoom-in"
                      title={`Perbesar Slide ${idx + 1}: ${img.name}`}
                    >
                      <div className="flex items-center justify-between gap-1.5 w-full">
                        <span className="px-1.5 py-0.5 rounded bg-teal-700 text-white text-[10px] font-extrabold shrink-0">
                          Slide {idx + 1}
                        </span>
                        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate flex-1">
                          {img.name}
                        </span>
                        <ZoomIn className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-700 dark:group-hover:text-teal-300 shrink-0" />
                      </div>
                      <div className="w-full h-44 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden p-1">
                        <img
                          src={img.dataUrl}
                          alt={`Slide ${idx + 1}: ${img.name}`}
                          className="max-h-full max-w-full object-contain rounded"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Text / Caption */}
            {savedText.trim() ? (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isInstagram ? "Caption / Keterangan Tambahan" : "Teks Iklan Lowongan LinkedIn"}
                </p>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
                  {savedText}
                </div>
              </div>
            ) : legacySummary ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Ringkasan Input Tersimpan
                </p>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {legacySummary}
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-lg px-2.5 py-2 leading-relaxed">
                  Foto poster belum tersimpan pada riwayat lama ini (dianalisis sebelum fitur simpan foto aktif). Lakukan pemeriksaan Instagram baru agar seluruh slide foto ikut tersimpan di riwayat.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox for Saved Poster Slides */}
      {lightboxIdx !== null && savedImages[lightboxIdx] && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Pratinjau Slide ${lightboxIdx + 1}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxIdx(null);
          }}
        >
          <div className="w-full max-w-4xl flex items-center justify-between text-white mb-3 px-1">
            <div className="text-xs sm:text-sm font-bold truncate">
              Slide {lightboxIdx + 1} dari {savedImages.length} &middot;{" "}
              <span className="font-normal text-slate-300">
                {savedImages[lightboxIdx].name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLightboxIdx(null)}
              aria-label="Tutup pratinjau gambar"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative max-w-4xl w-full flex items-center justify-center">
            {savedImages.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIdx(
                    (lightboxIdx - 1 + savedImages.length) % savedImages.length
                  )
                }
                aria-label="Slide sebelumnya"
                className="absolute left-2 sm:left-4 z-10 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white border border-white/20 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <img
              src={savedImages[lightboxIdx].dataUrl}
              alt={`Slide ${lightboxIdx + 1}: ${savedImages[lightboxIdx].name}`}
              className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl bg-white"
            />

            {savedImages.length > 1 && (
              <button
                type="button"
                onClick={() => setLightboxIdx((lightboxIdx + 1) % savedImages.length)}
                aria-label="Slide berikutnya"
                className="absolute right-2 sm:right-4 z-10 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white border border-white/20 cursor-pointer transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
