import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck, AlertCircle } from "lucide-react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export const TURNSTILE_SITE_KEY = (
  import.meta.env.VITE_TURNSTILE_SITE_KEY || ""
).trim();

interface TurnstileWidgetProps {
  onTokenChange: (token: string | null) => void;
  resetSignal: number;
  isDark?: boolean;
  disabled?: boolean;
}

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="challenges.cloudflare.com/turnstile"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile load error")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat verifikasi Turnstile."));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  onTokenChange,
  resetSignal,
  isDark = false,
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || disabled) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore cleanup error
          }
          widgetIdRef.current = null;
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: isDark ? "dark" : "light",
          callback: (token: string) => onTokenChangeRef.current(token),
          "expired-callback": () => onTokenChangeRef.current(null),
          "error-callback": () => onTokenChangeRef.current(null),
        });
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            "Verifikasi keamanan Turnstile gagal dimuat. Muat ulang halaman bila masalah berlanjut."
          );
          onTokenChangeRef.current(null);
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [isDark, disabled]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || resetSignal === 0) return;
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        // ignore
      }
    }
    onTokenChangeRef.current(null);
  }, [resetSignal]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
        <span>Verifikasi keamanan anti-bot</span>
      </div>
      <div ref={containerRef} className="min-h-[65px]" />
      {loadError && (
        <p className="text-xs text-rose-700 dark:text-rose-300 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{loadError}</span>
        </p>
      )}
    </div>
  );
};
