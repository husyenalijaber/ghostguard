import React from "react";
import { KategoriRisiko } from "../types";

interface SpeedometerGaugeProps {
  score: number; // 0 - 100, or -1 for error
  kategori?: KategoriRisiko | string;
}

export const SpeedometerGauge: React.FC<SpeedometerGaugeProps> = ({
  score,
  kategori,
}) => {
  const isError = score === -1 || kategori === "Error";
  const effectiveRisk = isError ? 0 : Math.min(100, Math.max(0, Math.round(score || 0)));

  const isRendah = !isError && effectiveRisk <= 33;
  const isSedang = !isError && effectiveRisk > 33 && effectiveRisk <= 66;
  const isTinggi = !isError && effectiveRisk > 66;

  const cx = 150;
  const cy = 135;

  const angleDeg = isError ? 90 : 180 - (effectiveRisk / 100) * 180;
  const angleRad = (angleDeg * Math.PI) / 180;

  const needleLength = 76;
  const needleTipX = cx + needleLength * Math.cos(angleRad);
  const needleTipY = cy - needleLength * Math.sin(angleRad);

  return (
    <div className="w-full flex flex-col items-center">
      {/* SVG Semicircle Gauge */}
      <div className="relative w-full max-w-[280px] h-[155px] flex items-center justify-center">
        <svg viewBox="0 0 300 160" className="w-full h-full overflow-visible">
          <defs>
            <filter id="pivot-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#202124" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Background Track */}
          <path
            d="M 50 135 A 90 90 0 0 1 250 135"
            fill="none"
            className="stroke-[#f1f3f4] dark:stroke-slate-800"
            strokeWidth="20"
            strokeLinecap="round"
          />

          {/* Green Zone: 0 - 33% */}
          <path
            d="M 60 135 A 90 90 0 0 1 105 57.1"
            fill="none"
            stroke="#34a853"
            strokeWidth="18"
            strokeLinecap="round"
            className="transition-all duration-300"
          />

          {/* Yellow Zone: 34 - 66% */}
          <path
            d="M 105 57.1 A 90 90 0 0 1 195 57.1"
            fill="none"
            stroke="#fbbc04"
            strokeWidth="18"
            className="transition-all duration-300"
          />

          {/* Red Zone: 67 - 100% */}
          <path
            d="M 195 57.1 A 90 90 0 0 1 240 135"
            fill="none"
            stroke="#ea4335"
            strokeWidth="18"
            strokeLinecap="round"
            className="transition-all duration-300"
          />

          {/* Needle Pointer */}
          {!isError && (
            <line
              x1={cx}
              y1={cy}
              x2={needleTipX}
              y2={needleTipY}
              className="stroke-[#202124] dark:stroke-slate-100 transition-all duration-700 ease-out"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}

          {/* Pivot Circle */}
          <circle
            cx={cx}
            cy={cy}
            r="8"
            className="fill-[#202124] dark:fill-slate-100"
            filter="url(#pivot-shadow)"
          />
          <circle cx={cx} cy={cy} r="3.5" className="fill-white dark:fill-slate-900" />
        </svg>
      </div>

      {/* Label under gauge */}
      <div className="text-center mt-1 mb-4">
        <h4 className="text-base font-bold text-[#202124] dark:text-white">Skor 0–100</h4>
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium mt-0.5">
          {isError ? (
            <span className="font-bold text-[#ea4335]">Status: Error</span>
          ) : (
            <>
              <span>Skor Risiko:</span>
              <span className="font-bold text-[#202124] dark:text-white tabular-nums font-mono text-sm">
                {effectiveRisk}/100
              </span>
              <span className="text-slate-700 dark:text-slate-300">
                (Indikasi risiko {isRendah ? "Rendah" : isSedang ? "Sedang" : "Tinggi"})
              </span>
            </>
          )}
        </div>
      </div>

      {/* 3 Status Boxes */}
      <div className="grid grid-cols-3 gap-2 w-full pt-1">
        <div
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center border transition-all ${
            isRendah
              ? "bg-[#e6f4ea] border-[#34a853] text-[#137333] shadow-xs font-bold ring-2 ring-[#34a853]/25"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-80"
          }`}
        >
          <span className="text-xs font-bold">Rendah</span>
          <span className="text-[10px] tabular-nums">(0–33)</span>
        </div>

        <div
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center border transition-all ${
            isSedang
              ? "bg-[#fef7e0] border-[#fbbc04] text-[#b06000] shadow-xs font-bold ring-2 ring-[#fbbc04]/35"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-80"
          }`}
        >
          <span className="text-xs font-bold">Sedang</span>
          <span className="text-[10px] tabular-nums">(34–66)</span>
        </div>

        <div
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center border transition-all ${
            isTinggi
              ? "bg-[#fce8e6] border-[#ea4335] text-[#c5221f] shadow-xs font-bold ring-2 ring-[#ea4335]/30"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-80"
          }`}
        >
          <span className="text-xs font-bold">Tinggi</span>
          <span className="text-[10px] tabular-nums">(67–100)</span>
        </div>
      </div>
    </div>
  );
};
