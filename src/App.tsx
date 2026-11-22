import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { GhostJobDetectorView, ToastNoticePayload } from "./components/GhostJobDetectorView";
import { DashboardView } from "./components/DashboardView";
import { LandingPage } from "./components/LandingPage";
import { AnalysisResult } from "./types";
import { useDarkMode } from "./hooks/useDarkMode";
import {
  ShieldCheck,
  History,
  X,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";

const HISTORY_STORAGE_KEY = "ghostguard_analyses_history";

interface ToastItem extends ToastNoticePayload {
  id: string;
}

export default function App() {
  const [hasEnteredWorkspace, setHasEnteredWorkspace] = useState(false);

  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<AnalysisResult | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [chatSessionKey, setChatSessionKey] = useState<number>(1);
  const [currentView, setCurrentView] = useState<"dashboard" | "chat">("dashboard");

  // Dark Mode & Global Toast Stack
  const { isDark, toggleDarkMode } = useDarkMode();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const pushToast = useCallback((notice: ToastNoticePayload) => {
    const id = "toast-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev.slice(-2), { ...notice, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadHistory = useCallback(() => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleanHistory = parsed.filter(
            (item) =>
              item.id !== "sample-1" &&
              item.id !== "sample-2" &&
              item.id !== "sample-3" &&
              item.skor !== -1
          );
          setHistory(cleanHistory);
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(cleanHistory));
          setIsLoadingHistory(false);
          return;
        }
      }
      setHistory([]);
    } catch {
      setHistory([]);
      setHistoryError("Gagal membaca riwayat pemeriksaan dari penyimpanan peramban.");
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const saveHistory = (newHistory: AnalysisResult[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
    } catch {
      // If image thumbnails exceed browser localStorage quota (~5MB),
      // prune saved image previews from the oldest entries first so all text/scores stay saved.
      const fallbackHistory = newHistory.map((item) => ({
        ...item,
        inputDetails: item.inputDetails ? { ...item.inputDetails } : undefined,
      }));
      for (let i = fallbackHistory.length - 1; i >= 0; i--) {
        if (fallbackHistory[i].inputDetails?.images?.length) {
          delete fallbackHistory[i].inputDetails!.images;
          try {
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(fallbackHistory));
            return;
          } catch {
            // Continue stripping older image previews
          }
        }
      }
    }
  };

  const handleStartCheck = () => {
    setSelectedHistoryItem(null);
    setCurrentView("dashboard");
    setHasEnteredWorkspace(true);
  };

  const handleNewCheck = () => {
    setSelectedHistoryItem(null);
    setCurrentView("chat");
    setChatSessionKey((prev) => prev + 1);
  };

  const handleSelectHistoryItem = (item: AnalysisResult) => {
    setSelectedHistoryItem(item);
    setCurrentView("chat");
    setIsMobileSidebarOpen(false);
  };

  const handleDeleteHistory = (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    saveHistory(updated);
    if (selectedHistoryItem?.id === id) {
      setSelectedHistoryItem(null);
    }
    pushToast({
      type: "info",
      title: "Riwayat dihapus",
      message: "Item pemeriksaan telah dihapus dari riwayat.",
    });
  };

  const handleClearAllHistory = () => {
    saveHistory([]);
    setSelectedHistoryItem(null);
    pushToast({
      type: "info",
      title: "Semua riwayat dibersihkan",
      message: "Daftar riwayat pemeriksaan kini kosong.",
    });
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {!hasEnteredWorkspace ? (
          <motion.div
            key="landing-page"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <LandingPage
              onStartCheck={handleStartCheck}
              isDark={isDark}
              onToggleDarkMode={toggleDarkMode}
            />
          </motion.div>
        ) : (
          <motion.div
            key="app-workspace"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            className="h-screen w-screen overflow-hidden bg-[#f8f9fa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-row font-sans antialiased transition-colors"
          >
            {/* Desktop Sidebar */}
            <div className="hidden lg:flex h-full shrink-0">
              <Sidebar
                currentView={currentView}
                onSelectView={(v) => setCurrentView(v)}
                history={history}
                selectedHistoryId={selectedHistoryItem?.id}
                onSelectHistoryItem={handleSelectHistoryItem}
                onDeleteHistoryItem={handleDeleteHistory}
                onNewCheck={handleNewCheck}
                onGoHome={() => setHasEnteredWorkspace(false)}
              />
            </div>

            {/* Mobile Drawer Backdrop and Sidebar */}
            {isMobileSidebarOpen && (
              <div className="fixed inset-0 z-50 flex lg:hidden">
                <div
                  className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
                  onClick={() => setIsMobileSidebarOpen(false)}
                />
                <div className="relative z-10 w-72 bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col">
                  <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      Menu &amp; Riwayat
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <Sidebar
                      currentView={currentView}
                      onSelectView={(v) => {
                        setCurrentView(v);
                        setIsMobileSidebarOpen(false);
                      }}
                      history={history}
                      selectedHistoryId={selectedHistoryItem?.id}
                      onSelectHistoryItem={handleSelectHistoryItem}
                      onDeleteHistoryItem={handleDeleteHistory}
                      onNewCheck={() => {
                        handleNewCheck();
                        setIsMobileSidebarOpen(false);
                      }}
                      onGoHome={() => {
                        setHasEnteredWorkspace(false);
                        setIsMobileSidebarOpen(false);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Main Workspace Container */}
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
              <Header
                currentView={currentView}
                onSelectView={(v) => setCurrentView(v)}
                onToggleSidebar={() => setIsMobileSidebarOpen(true)}
                isDark={isDark}
                onToggleDarkMode={toggleDarkMode}
              />

              <main className="flex-1 min-h-0 w-full flex flex-col overflow-hidden pb-14 sm:pb-0">
                <AnimatePresence mode="wait">
                  {currentView === "dashboard" ? (
                    <motion.div
                      key="dashboard-view"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="w-full h-full flex flex-col flex-1 min-h-0 overflow-hidden"
                    >
                      <DashboardView
                        history={history}
                        onSelectJob={(job) => {
                          setSelectedHistoryItem(job);
                          setCurrentView("chat");
                        }}
                        onNewScan={handleNewCheck}
                        onDeleteJob={handleDeleteHistory}
                        onClearAllHistory={handleClearAllHistory}
                        isLoadingHistory={isLoadingHistory}
                        historyError={historyError}
                        onRetryLoadHistory={loadHistory}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="chat-view"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="w-full h-full flex flex-col flex-1 min-h-0 overflow-hidden"
                    >
                      <GhostJobDetectorView
                        key={chatSessionKey}
                        initialTab="linkedin"
                        onSaveToHistory={(result) => saveHistory([result, ...history])}
                        selectedHistoryItem={selectedHistoryItem}
                        onClearSelectedHistory={() => setSelectedHistoryItem(null)}
                        onNotify={pushToast}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </main>

              {/* Mobile Fixed Bottom Navigation Bar */}
              <nav
                aria-label="Navigasi Bawah Ponsel"
                className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1 flex sm:hidden items-center justify-around shadow-lg no-print"
              >
                <button
                  type="button"
                  onClick={() => setCurrentView("dashboard")}
                  className={`flex flex-col items-center justify-center min-h-[44px] min-w-[56px] px-2 py-1 rounded-xl transition-all cursor-pointer ${
                    currentView === "dashboard"
                      ? "text-teal-800 dark:text-teal-300 font-bold bg-teal-50 dark:bg-teal-950/60"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="text-[10px] mt-0.5">Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={handleNewCheck}
                  className={`flex flex-col items-center justify-center min-h-[44px] min-w-[56px] px-2 py-1 rounded-xl transition-all cursor-pointer ${
                    currentView === "chat"
                      ? "text-teal-800 dark:text-teal-300 font-bold bg-teal-50 dark:bg-teal-950/60"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[10px] mt-0.5">Deteksi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="flex flex-col items-center justify-center min-h-[44px] min-w-[56px] px-2 py-1 rounded-xl transition-all cursor-pointer relative text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="relative">
                    <History className="w-4 h-4" />
                    {history.length > 0 && (
                      <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-teal-700 text-white font-extrabold text-[8px]">
                        {history.length}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] mt-0.5">Riwayat</span>
                </button>
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Floating Toast Notification Container */}
      <div
        aria-live="polite"
        className="fixed bottom-16 sm:bottom-5 right-4 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto p-3.5 rounded-2xl border shadow-xl flex items-start gap-3 backdrop-blur-md ${
                toast.type === "success"
                  ? "bg-white/95 dark:bg-slate-900/95 border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-white"
                  : toast.type === "error"
                  ? "bg-white/95 dark:bg-slate-900/95 border-rose-300 dark:border-rose-800 text-slate-900 dark:text-white"
                  : "bg-white/95 dark:bg-slate-900/95 border-teal-300 dark:border-teal-800 text-slate-900 dark:text-white"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : toast.type === "error" ? (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold">{toast.title}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                  {toast.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Tutup notifikasi"
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
