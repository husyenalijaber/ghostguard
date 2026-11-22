import React from "react";
import {
  Menu,
  ShieldCheck,
  LayoutDashboard,
  Moon,
  Sun,
} from "lucide-react";

interface HeaderProps {
  currentView: "dashboard" | "chat";
  onSelectView: (view: "dashboard" | "chat") => void;
  onToggleSidebar?: () => void;
  isDark?: boolean;
  onToggleDarkMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  onToggleSidebar,
  isDark = false,
  onToggleDarkMode,
}) => {
  return (
    <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs sticky top-0 z-30 shrink-0 select-none transition-colors">
      <div className="w-full px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Left Section: Mobile Menu + Concise View Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer lg:hidden shrink-0"
              title="Buka Menu"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Compact Segmented View Switcher */}
          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => onSelectView("dashboard")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                currentView === "dashboard"
                  ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs"
                  : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <LayoutDashboard
                className={`w-3.5 h-3.5 ${
                  currentView === "dashboard"
                    ? "text-teal-700 dark:text-teal-400"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              />
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView("chat")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                currentView === "chat"
                  ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs"
                  : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ShieldCheck
                className={`w-3.5 h-3.5 ${
                  currentView === "chat"
                    ? "text-teal-700 dark:text-teal-400"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              />
              <span>Deteksi</span>
            </button>
          </div>
        </div>

        {/* Right Section: Dark Mode Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {onToggleDarkMode && (
            <button
              type="button"
              onClick={onToggleDarkMode}
              title={isDark ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
              aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Mode Terang</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700 shrink-0" />
                  <span>Mode Gelap</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
