import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Image as ImageIcon,
  AlertOctagon,
  X,
  Loader2,
  RefreshCw,
  Building,
  AlertTriangle,
  CheckCircle2,
  FileDown,
  Info,
  Search,
  Keyboard,
  BarChart3,
  Wrench,
  ShieldAlert,
} from "lucide-react";
import { AnalysisResult, AttachedImage, DimensiSkor, KategoriRisiko } from "../types";
import { SpeedometerGauge } from "./SpeedometerGauge";
import { ExportModal } from "./ExportModal";
import {
  AnalysisBreakdownModal,
  buildFiveDimensionBreakdown,
  getDimensionRiskMeta,
} from "./AnalysisBreakdownModal";
import { TURNSTILE_SITE_KEY, TurnstileWidget } from "./TurnstileWidget";
import { SavedInputPreview } from "./SavedInputPreview";
import { compressAttachedImageForHistory } from "../utils/imagePreview";

export interface ToastNoticePayload {
  type: "success" | "error" | "info";
  title: string;
  message: string;
}

interface GhostJobDetectorViewProps {
  initialTab?: "linkedin" | "instagram";
  onSaveToHistory: (result: AnalysisResult) => void;
  selectedHistoryItem?: AnalysisResult | null;
  onClearSelectedHistory?: () => void;
  onNotify?: (toast: ToastNoticePayload) => void;
}

export const GhostJobDetectorView: React.FC<GhostJobDetectorViewProps> = ({
  initialTab = "linkedin",
  onSaveToHistory,
  selectedHistoryItem,
  onClearSelectedHistory,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<"linkedin" | "instagram">(initialTab);

  // Inputs
  const [linkedinText, setLinkedinText] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const MAX_INSTAGRAM_IMAGES = 5;

  // Status & Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(
    selectedHistoryItem || null
  );

  // Quota & maintenance states
  const [imageQuotaRemaining, setImageQuotaRemaining] = useState<number>(5);
  const [imageQuotaTotal] = useState<number>(5);
  const [publicEnabled, setPublicEnabled] = useState<boolean>(true);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>(
    "Layanan sedang dalam pemeliharaan pengujian."
  );

  // Turnstile & theme states
  const [serverTurnstileRequired, setServerTurnstileRequired] = useState<boolean>(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = useState<number>(0);
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
  );

  // Modals
  const [exportModalAnalysis, setExportModalAnalysis] = useState<AnalysisResult | null>(null);
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);

  // Drag, upload progress, inline errors & preview dimensions
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageDimensionsMap, setImageDimensionsMap] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [showLinkedinInlineValidation, setShowLinkedinInlineValidation] =
    useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const linkedinTextareaRef = useRef<HTMLTextAreaElement>(null);
  const createdUrlsRef = useRef<Set<string>>(new Set());

  const fetchQuota = async () => {
    try {
      const res = await fetch("/api/quota-status", {
        credentials: "include",
      });
      if (res.ok) {
        const rawText = await res.text();
        let data: any = null;
        try {
          data = rawText ? JSON.parse(rawText) : null;
        } catch {
          data = null;
        }
        if (data && typeof data === "object") {
          if (typeof data?.publicEnabled === "boolean") {
            setPublicEnabled(data.publicEnabled);
          }
          if (typeof data?.turnstileRequired === "boolean") {
            setServerTurnstileRequired(data.turnstileRequired);
          }
          if (typeof data?.maintenanceMessage === "string" && data.maintenanceMessage) {
            setMaintenanceMessage(data.maintenanceMessage);
          }
          if (data?.image?.remaining !== undefined) {
            setImageQuotaRemaining(data.image.remaining);
          }
        }
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    fetchQuota();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const updateDark = () => setIsDark(root.classList.contains("dark"));
    updateDark();
    const observer = new MutationObserver(updateDark);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (selectedHistoryItem) {
      setCurrentAnalysis(selectedHistoryItem);
    }
  }, [selectedHistoryItem]);

  useEffect(() => {
    if (!isAnalyzing) {
      setAnalysisProgress(0);
      return;
    }
    const isVisualFlow = activeTab === "instagram" && attachedImages.length > 0;
    setAnalysisProgress(isVisualFlow ? 8 : 12);
    const interval = setInterval(
      () => {
        setAnalysisProgress((prev) => {
          const cap = isVisualFlow ? 96 : 92;
          if (prev >= cap) return cap;
          if (isVisualFlow) {
            if (prev < 40) return Math.min(cap, prev + 4);
            if (prev < 75) return Math.min(cap, prev + 2);
            return Math.min(cap, prev + 1);
          }
          if (prev < 45) return Math.min(cap, prev + 9);
          if (prev < 75) return Math.min(cap, prev + 5);
          return Math.min(cap, prev + 2);
        });
      },
      isVisualFlow ? 1100 : 450
    );
    return () => clearInterval(interval);
  }, [isAnalyzing, activeTab, attachedImages.length]);

  useEffect(() => {
    return () => {
      createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      createdUrlsRef.current.clear();
    };
  }, []);

  const clearAllAttachedImages = () => {
    setAttachedImages((prev) => {
      prev.forEach((img) => {
        if (img.previewUrl) {
          URL.revokeObjectURL(img.previewUrl);
          createdUrlsRef.current.delete(img.previewUrl);
        }
      });
      return [];
    });
    setImageDimensionsMap({});
    setUploadProgress(null);
    setUploadError(null);
  };

  const removeAttachedImage = (id: string) => {
    setAttachedImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
        createdUrlsRef.current.delete(target.previewUrl);
      }
      return prev.filter((img) => img.id !== id);
    });
    setImageDimensionsMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setUploadError(null);
  };

  /**
   * Menyiapkan gambar sebelum dikirim: diperkecil bila sisi terpanjang > 2048 px dan
   * disimpan ulang sebagai JPEG. Penyimpanan ulang membuang metadata (mis. lokasi)
   * dan menjaga total unggahan di bawah batas body permintaan Vercel (4,5 MB).
   */
  const MAX_SISI_KIRIM = 2048;
  const TARGET_BYTE_PER_SLIDE = 700 * 1024;

  const encodeImage = async (
    file: File
  ): Promise<{ base64: string; mimeType: string; size: number; width: number; height: number }> => {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("DECODE_ERROR"));
        el.src = url;
      });
      const w0 = img.naturalWidth;
      const h0 = img.naturalHeight;
      const scale = Math.min(1, MAX_SISI_KIRIM / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * scale));
      const h = Math.max(1, Math.round(h0 * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("CANVAS_ERROR");
      ctx.fillStyle = "#ffffff"; // latar putih untuk PNG transparan
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      let blob: Blob | null = null;
      for (const q of [0.9, 0.82, 0.72, 0.6]) {
        blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
        if (blob && blob.size <= TARGET_BYTE_PER_SLIDE) break;
      }
      if (!blob) throw new Error("ENCODE_ERROR");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("READ_ERROR"));
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob as Blob);
      });
      return { base64: dataUrl.split(",")[1], mimeType: "image/jpeg", size: blob.size, width: w0, height: h0 };
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const readFileAsDataPayload = async (
    file: File
  ): Promise<{ item: AttachedImage; width?: number; height?: number }> => {
    const encoded = await encodeImage(file);
    const previewUrl = URL.createObjectURL(file);
    createdUrlsRef.current.add(previewUrl);
    const id = "img-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    const item: AttachedImage = {
      id,
      base64: encoded.base64,
      mimeType: encoded.mimeType,
      name: file.name || "poster-clipboard.jpg",
      size: file.size,
      previewUrl,
    };
    setImageDimensionsMap((prev) => ({
      ...prev,
      [id]: { width: encoded.width, height: encoded.height },
    }));
    return { item, width: encoded.width, height: encoded.height };
  };

  const handleFilesAdd = async (
    incomingFiles: FileList | File[],
    options?: { fromClipboard?: boolean; switchedFromLinkedIn?: boolean }
  ) => {
    const fileList = Array.from(incomingFiles || []);
    if (fileList.length === 0) return;

    setAnalysisError(null);
    setUploadError(null);

    if (imageQuotaRemaining <= 0) {
      const msg = "Kuota gambar hari ini sudah habis (5 per hari).";
      setUploadError(msg);
      onNotify?.({
        type: "error",
        title: "Kuota gambar habis",
        message: msg,
      });
      return;
    }

    const availableSlots = MAX_INSTAGRAM_IMAGES - attachedImages.length;
    if (availableSlots <= 0) {
      const msg = `Maksimal ${MAX_INSTAGRAM_IMAGES} slide gambar dapat ditumpuk sekaligus. Hapus salah satu jika ingin menambah gambar baru.`;
      setUploadError(msg);
      onNotify?.({
        type: "error",
        title: "Batas maksimal 5 slide tercapai",
        message: msg,
      });
      return;
    }

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    const validToLoad: File[] = [];
    const skippedReasons: string[] = [];

    for (const file of fileList) {
      const normalizedType = (file.type || "").toLowerCase();
      if (!validTypes.includes(normalizedType)) {
        skippedReasons.push(
          `Format "${file.name || "gambar"}" tidak didukung (gunakan PNG/JPG/WEBP).`
        );
        continue;
      }
      if (file.size > 3 * 1024 * 1024) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        skippedReasons.push(
          `Berkas "${file.name || "gambar"}" (${sizeMb} MB) melebihi batas 3 MB per slide.`
        );
        continue;
      }
      if (validToLoad.length >= availableSlots) {
        skippedReasons.push(
          `Maksimal ${MAX_INSTAGRAM_IMAGES} slide gambar sekaligus; sebagian gambar tidak ditambahkan.`
        );
        break;
      }
      validToLoad.push(file);
    }

    if (validToLoad.length === 0) {
      if (skippedReasons.length > 0) {
        setUploadError(skippedReasons[0]);
        onNotify?.({
          type: "error",
          title: "Gambar tidak dapat ditambahkan",
          message: skippedReasons[0],
        });
      }
      return;
    }

    setUploadProgress(25);
    try {
      const loadedItems: AttachedImage[] = [];
      for (let i = 0; i < validToLoad.length; i++) {
        const { item } = await readFileAsDataPayload(validToLoad[i]);
        loadedItems.push(item);
        setUploadProgress(Math.min(95, Math.round(((i + 1) / validToLoad.length) * 90)));
      }
      setUploadProgress(100);
      setTimeout(() => {
        setAttachedImages((prev) => [...prev, ...loadedItems].slice(0, MAX_INSTAGRAM_IMAGES));
        setUploadProgress(null);
        setUploadError(skippedReasons.length > 0 ? skippedReasons[0] : null);
        setAnalysisError(null);

        if (skippedReasons.length > 0) {
          onNotify?.({
            type: "error",
            title: "Sebagian gambar melewati batas",
            message: skippedReasons[0],
          });
        } else if (options?.fromClipboard) {
          onNotify?.({
            type: "info",
            title: "Poster ditambahkan",
            message: options.switchedFromLinkedIn
              ? "Beralih ke tab Poster Instagram dan menempel gambar ke tumpukan slide."
              : `${loadedItems.length} gambar dari clipboard ditambahkan ke tumpukan slide.`,
          });
        }
      }, 180);
    } catch {
      setUploadProgress(null);
      const errMsg = "Gagal membaca salah satu berkas gambar. Silakan coba lagi.";
      setUploadError(errMsg);
      onNotify?.({
        type: "error",
        title: "Gagal memuat gambar",
        message: errMsg,
      });
    }
  };

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (isAnalyzing || currentAnalysis || isBreakdownModalOpen || exportModalAnalysis) {
        return;
      }

      const clipboard = e.clipboardData;
      if (!clipboard) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const isInsideEditable = Boolean(
        activeEl &&
          (activeEl.tagName === "TEXTAREA" ||
            activeEl.tagName === "INPUT" ||
            activeEl.isContentEditable)
      );

      const pastedImageFiles: File[] = [];
      if (clipboard.items && clipboard.items.length > 0) {
        for (let i = 0; i < clipboard.items.length; i++) {
          const item = clipboard.items[i];
          if (item.kind === "file" && item.type.startsWith("image/")) {
            const rawFile = item.getAsFile();
            if (rawFile) {
              const ext = (rawFile.type.split("/")[1] || "png").replace("jpeg", "jpg");
              pastedImageFiles.push(
                rawFile.name
                  ? rawFile
                  : new File([rawFile], `poster-slide-${Date.now()}-${i + 1}.${ext}`, {
                      type: rawFile.type || "image/png",
                    })
              );
            }
          }
        }
      }
      if (pastedImageFiles.length === 0 && clipboard.files && clipboard.files.length > 0) {
        for (let i = 0; i < clipboard.files.length; i++) {
          const f = clipboard.files[i];
          if (f.type.startsWith("image/")) {
            pastedImageFiles.push(f);
          }
        }
      }

      const pastedText = clipboard.getData("text/plain") || "";

      if (activeTab === "instagram") {
        if (pastedImageFiles.length > 0) {
          e.preventDefault();
          handleFilesAdd(pastedImageFiles, { fromClipboard: true });
          return;
        }
        return;
      }

      // activeTab === "linkedin"
      if (pastedText) {
        if (isInsideEditable) {
          return;
        }
        e.preventDefault();
        setLinkedinText((prev) => {
          const next = prev.trim() ? `${prev}\n${pastedText}` : pastedText;
          if (next.trim().length >= 50) {
            setShowLinkedinInlineValidation(false);
          }
          return next.slice(0, 10000);
        });
        setAnalysisError(null);
        linkedinTextareaRef.current?.focus();
        return;
      }

      if (pastedImageFiles.length > 0 && !isInsideEditable) {
        e.preventDefault();
        setActiveTab("instagram");
        setAnalysisError(null);
        setTurnstileToken(null);
        fetchQuota();
        handleFilesAdd(pastedImageFiles, {
          fromClipboard: true,
          switchedFromLinkedIn: true,
        });
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (isAnalyzing || currentAnalysis || isBreakdownModalOpen || exportModalAnalysis) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleAnalyze();
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdd(e.dataTransfer.files);
    }
  };

  const formatTanggalIndonesia = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleAnalyze = async () => {
    if (isAnalyzing) return;
    setAnalysisError(null);

    if (!publicEnabled) {
      setAnalysisError(maintenanceMessage);
      return;
    }

    const isLinkedIn = activeTab === "linkedin";
    const textContent = isLinkedIn ? linkedinText.trim() : "";
    const imagePayloads = !isLinkedIn ? attachedImages : [];
    const hasImages = imagePayloads.length > 0;

    if (isLinkedIn && textContent.length < 50) {
      setShowLinkedinInlineValidation(true);
      setAnalysisError(
        textContent.length === 0
          ? "Mohon tempel teks iklan lowongan kerja LinkedIn terlebih dahulu (min. 50 karakter)."
          : `Teks lowongan masih kurang ${50 - textContent.length} karakter lagi (minimal 50 karakter).`
      );
      return;
    }

    if (textContent.length > 10000) {
      setAnalysisError("Teks iklan melebihi batas maksimal 10.000 karakter.");
      return;
    }

    if (!isLinkedIn && !hasImages) {
      setUploadError("Unggah poster lowongan kerja Instagram terlebih dahulu sebelum menganalisis.");
      setAnalysisError("Mohon unggah poster lowongan kerja Instagram.");
      return;
    }

    if (!isLinkedIn && hasImages && imageQuotaRemaining <= 0) {
      setAnalysisError("Kuota gambar hari ini sudah habis (5 per hari).");
      return;
    }

    const turnstileEnabled = Boolean(TURNSTILE_SITE_KEY) && serverTurnstileRequired;
    if (turnstileEnabled && !turnstileToken) {
      setAnalysisError("Mohon selesaikan verifikasi keamanan anti-bot (Turnstile) terlebih dahulu.");
      return;
    }

    setIsAnalyzing(true);
    const controller = new AbortController();
    const clientTimeoutMs = hasImages ? 75000 : 40000;
    const clientTimeout = setTimeout(() => controller.abort(), clientTimeoutMs);

    try {
      const payload: Record<string, unknown> = {
        sourceType: isLinkedIn ? "LinkedIn" : "Instagram",
      };

      if (turnstileEnabled && turnstileToken) {
        payload.turnstileToken = turnstileToken;
      }

      if (textContent) {
        payload.jobPostingText = textContent;
      }

      if (hasImages) {
        const totalBase64 = imagePayloads.reduce((n, img) => n + img.base64.length, 0);
        if (totalBase64 > 4_000_000) {
          throw new Error(
            "Total ukuran slide terlalu besar untuk dikirim. Kurangi jumlah slide atau gunakan gambar yang lebih kecil."
          );
        }
        payload.images = imagePayloads.map((img) => ({
          base64: img.base64,
          mimeType: img.mimeType,
          name: img.name,
        }));
      }

      let res!: Response;
      let rawResponseText = "";
      let data: any = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        res = await fetch("/api/analyze-job", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        rawResponseText = await res.text();
        data = null;
        try {
          data = rawResponseText ? JSON.parse(rawResponseText) : null;
        } catch {
          data = null;
        }

        const isStartingServerSplash =
          !data && rawResponseText.includes("Starting Server");
        if (!isStartingServerSplash || attempt === 4) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      const isCookieCheckPage =
        rawResponseText.includes("__cookie_check") ||
        rawResponseText.includes("<title>Cookie check</title>");
      const isStartingServerPage = rawResponseText.includes("Starting Server");

      if (!res.ok) {
        fetchQuota();
        throw new Error(
          data?.error ||
            (isStartingServerPage
              ? "Server preview sedang memulai ulang. Tunggu beberapa detik lalu klik Analisis Sekarang kembali."
              : isCookieCheckPage
              ? "Sesi preview AI Studio perlu dibuka di tab baru atau disegarkan agar permintaan API diteruskan ke server."
              : "Analisis gagal. Coba lagi beberapa saat lagi.")
        );
      }

      if (!data || typeof data !== "object") {
        throw new Error(
          isStartingServerPage
            ? "Server preview sedang memulai ulang (Starting Server). Tunggu beberapa detik lalu klik Analisis Sekarang kembali."
            : isCookieCheckPage
            ? "Sesi preview iframe AI Studio dialihkan ke halaman verifikasi sesi (Cookie check). Buka preview di tab baru (Open in new tab) lalu coba analisis lagi."
            : "Analisis gagal. Coba lagi beberapa saat lagi."
        );
      }

      fetchQuota();

      const timestamp = Date.now();
      const tanggalStr = formatTanggalIndonesia(timestamp);

      const dimensi: DimensiSkor = data.dimensi_skor || {
        deskripsi: 0,
        identitas: 0,
        konsistensi: 0,
        kompensasi: 0,
        proses: 0,
      };

      const skor: number = typeof data.skor === "number" ? data.skor : -1;
      const kategori: KategoriRisiko = data.kategori || (skor === -1 ? "Error" : "Sedang");
      const perusahaan: string = data.perusahaan || "Tidak disebutkan";
      const posisi: string = data.posisi || "Tidak disebutkan";
      const redFlags: string[] = Array.isArray(data.red_flags) ? data.red_flags : [];
      const penjelasan: string = data.penjelasan || "";
      const promptInjectionWarning = Boolean(data.promptInjectionWarning);
      const promptInjectionMessage =
        typeof data.promptInjectionMessage === "string"
          ? data.promptInjectionMessage
          : undefined;

      // Thumbnail poster ringan untuk riwayat di Local Storage (tidak dikirim ke server)
      const compressedSavedImages =
        !isLinkedIn && imagePayloads.length > 0
          ? await Promise.all(imagePayloads.map((img) => compressAttachedImageForHistory(img)))
          : [];

      const newResult: AnalysisResult = {
        id: "audit-" + timestamp,
        timestamp,
        jenisInput: isLinkedIn ? "LinkedIn" : "Instagram",
        tanggal: tanggalStr,
        perusahaan,
        posisi,
        skor,
        kategori,
        dimensi_skor: dimensi,
        red_flags: redFlags,
        penjelasan,
        pesanKhusus: data.pesanKhusus,
        promptInjectionWarning,
        promptInjectionMessage,
        jobTitle: posisi,
        companyName: perusahaan,
        totalScore: skor >= 0 ? skor : 0,
        classification: skor >= 67 ? "GHOST JOB" : skor >= 34 ? "MENCURIGAKAN" : "LEGITIMATE",
        classificationLabel: `Indikasi risiko ${kategori}`,
        riskLevel: skor >= 67 ? "TINGGI" : skor >= 34 ? "SEDANG" : "RENDAH",
        redFlags: redFlags,
        mainReason: penjelasan,
        applicantAdvice: [],
        exactMarkdown: "",
        scores: {
          c1: { name: "Deskripsi Pekerjaan (25%)", score: dimensi.deskripsi, note: "" },
          c2: { name: "Identitas Perusahaan (20%)", score: dimensi.identitas, note: "" },
          c3: { name: "Konsistensi Persyaratan (20%)", score: dimensi.konsistensi, note: "" },
          c4: { name: "Transparansi Kompensasi (20%)", score: dimensi.kompensasi, note: "" },
          c5: { name: "Proses Rekrutmen (15%)", score: dimensi.proses, note: "" },
        },
        originalInput: isLinkedIn
          ? "Teks iklan LinkedIn"
          : `Poster (${imagePayloads.length} slide): ${
              imagePayloads.map((img) => img.name).join(", ") || "Postingan Instagram"
            }`,
        // Input disimpan hanya di Local Storage peramban pengguna (riwayat), tidak di server
        inputDetails: {
          text: isLinkedIn ? linkedinText : "",
          ...(compressedSavedImages.length > 0 ? { images: compressedSavedImages } : {}),
        },
      };

      setAnalysisProgress(100);
      setCurrentAnalysis(newResult);

      if (skor >= 0) {
        onSaveToHistory(newResult);
        onNotify?.({
          type: "success",
          title: "Analisis selesai!",
          message: `Skor Risiko ${skor}/100 (Indikasi risiko ${kategori}) untuk ${posisi}.`,
        });
      } else {
        onNotify?.({
          type: "error",
          title: "Input perlu dilengkapi",
          message: data.pesanKhusus || "Teks atau gambar belum dapat dievaluasi.",
        });
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error && err.name === "AbortError"
          ? `Analisis gagal karena batas waktu ${Math.round(clientTimeoutMs / 1000)} detik terlampaui. Silakan coba lagi.`
          : err instanceof Error && err.message
          ? err.message
          : "Analisis gagal. Coba lagi beberapa saat lagi.";
      setAnalysisError(errorMsg);
      onNotify?.({
        type: "error",
        title: "Analisis gagal",
        message: errorMsg,
      });
    } finally {
      clearTimeout(clientTimeout);
      setIsAnalyzing(false);
      if (Boolean(TURNSTILE_SITE_KEY) && serverTurnstileRequired) {
        setTurnstileResetSignal((prev) => prev + 1);
      }
    }
  };

  const handleResetToInput = () => {
    setCurrentAnalysis(null);
    setIsBreakdownModalOpen(false);
    setExportModalAnalysis(null);
    onClearSelectedHistory?.();
    setAnalysisError(null);
    setLinkedinText("");
    setShowLinkedinInlineValidation(false);
    setIsDragging(false);
    setTurnstileToken(null);
    clearAllAttachedImages();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isLinkedinReady = linkedinText.trim().length >= 50 && linkedinText.trim().length <= 10000;
  const isInstagramReady = attachedImages.length > 0;
  const isTurnstileEnabled = Boolean(TURNSTILE_SITE_KEY) && serverTurnstileRequired;
  const isTurnstileBlocked = isTurnstileEnabled && !turnstileToken;

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto p-3 sm:p-6 lg:p-8 pb-20 sm:pb-10 bg-[#f8f9fa] dark:bg-slate-950 transition-colors">
      {/* Outer Window Container */}
      <div className="w-full max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-all">
        {/* Window Title Bar with 3 browser control dots */}
        <div className="w-full bg-slate-50/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 flex items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
              <span className="w-3 h-3 rounded-full bg-[#ea4335] inline-block shadow-2xs" />
              <span className="w-3 h-3 rounded-full bg-[#fbbc04] inline-block shadow-2xs" />
              <span className="w-3 h-3 rounded-full bg-[#34a853] inline-block shadow-2xs" />
            </div>

            <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white ml-1 truncate">
              Deteksi Ghost Job Posting
            </h1>
          </div>
        </div>

        {/* Maintenance Banner when PUBLIC_ENABLED === "false" (Requirement A.4) */}
        {!publicEnabled && (
          <div
            role="status"
            className="w-full px-5 py-3 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center gap-2.5"
          >
            <Wrench className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span>{maintenanceMessage}</span>
          </div>
        )}

        {/* Permanent Small Validation Scope Banner (Requirement D.3) */}
        <div className="w-full px-5 py-2 bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
          <span>
            Divalidasi pada iklan lowongan di Indonesia (LinkedIn dan Instagram). Untuk iklan dari negara lain, hasil belum divalidasi.
          </span>
        </div>

        {/* Dynamic Body: Skeleton Loading OR Input Tabs OR Result Panel */}
        {isAnalyzing ? (
          /* ========================================================= */
          /* SPINNER + LIVE PROGRESS VIEW DURING ANALYSIS              */
          /* ========================================================= */
          <div className="p-5 sm:p-8 flex flex-col gap-6" aria-live="polite" aria-busy="true">
            <div className="p-4 sm:p-5 rounded-2xl bg-teal-50/75 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 text-teal-900 dark:text-teal-200">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0">
                    <Loader2 className="w-5 h-5 animate-spin text-teal-700 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-extrabold">
                      Menganalisis...
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {analysisProgress < 35
                        ? "Membaca struktur iklan lowongan & mengekstrak informasi utama"
                        : analysisProgress < 75
                        ? "Mengevaluasi 5 dimensi risiko ghost job & mendeteksi red flags"
                        : "Menghitung skor risiko 0–100 dan menyusun ringkasan laporan"}
                    </p>
                  </div>
                </div>

                <span className="text-sm font-extrabold font-mono tabular-nums text-teal-800 dark:text-teal-300">
                  {analysisProgress}%
                </span>
              </div>

              <div
                className="w-full h-2.5 rounded-full bg-teal-200/70 dark:bg-slate-800 overflow-hidden"
                role="progressbar"
                aria-valuenow={analysisProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full bg-gradient-to-r from-teal-700 to-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                {[
                  { label: "1. Ekstraksi Konten", threshold: 35 },
                  { label: "2. Audit 5 Dimensi", threshold: 75 },
                  { label: "3. Skor & Rekomendasi", threshold: 95 },
                ].map((stage, idx) => {
                  const done = analysisProgress >= stage.threshold;
                  const active =
                    !done &&
                    (idx === 0 ||
                      analysisProgress >= (idx === 1 ? 35 : 75));
                  return (
                    <div
                      key={stage.label}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                        done
                          ? "bg-white/90 dark:bg-slate-900 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold"
                          : active
                          ? "bg-white dark:bg-slate-900 border-teal-400 dark:border-teal-700 text-teal-900 dark:text-teal-200 font-bold"
                          : "bg-white/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : active ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700 dark:text-teal-400 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-400 dark:border-slate-600 shrink-0" />
                      )}
                      <span className="truncate">{stage.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-pulse">
              <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center gap-4">
                <div className="w-48 h-24 rounded-t-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="grid grid-cols-3 gap-2 w-full">
                  <div className="h-11 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <div className="h-11 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <div className="h-11 rounded-xl bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>

              <div className="lg:col-span-7 space-y-4">
                <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 w-4/6 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="h-5 w-28 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 w-11/12 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            </div>
          </div>
        ) : !currentAnalysis ? (
          /* ========================================================= */
          /* 1 & 2. INPUT TABS VIEW (LinkedIn & Instagram)             */
          /* ========================================================= */
          <div className="p-5 sm:p-8 flex flex-col gap-5">
            {/* Compact Pill Toggle Switcher */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div
                className="inline-flex rounded-full p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                role="tablist"
                aria-label="Pilih sumber iklan lowongan"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "linkedin"}
                  onClick={() => {
                    setActiveTab("linkedin");
                    setAnalysisError(null);
                    setTurnstileToken(null);
                  }}
                  className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    activeTab === "linkedin"
                      ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Teks LinkedIn
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "instagram"}
                  onClick={() => {
                    setActiveTab("instagram");
                    setAnalysisError(null);
                    setTurnstileToken(null);
                    fetchQuota();
                  }}
                  className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    activeTab === "instagram"
                      ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Poster Instagram
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                <Keyboard className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px]">
                    Ctrl+V
                  </kbd>{" "}
                  tempel &middot;{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px]">
                    Ctrl+Enter
                  </kbd>{" "}
                  analisis
                </span>
              </div>
            </div>

            {/* Softened Error Message Toast */}
            {analysisError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-50/75 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{analysisError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAnalysisError(null)}
                  className="p-1 rounded text-rose-700 dark:text-rose-300 hover:bg-black/5 cursor-pointer"
                  title="Tutup pesan kesalahan"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* TAB 1: LINKEDIN INPUT */}
            {activeTab === "linkedin" && (
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  {/* Prominent "X / 50 karakter" Counter & Visual Label Bar */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label
                      htmlFor="linkedin-posting-input"
                      className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200"
                    >
                      Tempel Teks Lowongan LinkedIn
                    </label>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums border transition-colors ${
                        isLinkedinReady
                          ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                          : showLinkedinInlineValidation
                          ? "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {isLinkedinReady && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span>
                        {linkedinText.trim().length} / 50 karakter
                        {linkedinText.length > 9000 && ` (maks. ${linkedinText.length}/10.000)`}
                      </span>
                      {isLinkedinReady && (
                        <span className="text-[11px] font-semibold">· Siap</span>
                      )}
                    </span>
                  </div>

                  <textarea
                    ref={linkedinTextareaRef}
                    id="linkedin-posting-input"
                    rows={8}
                    maxLength={10000}
                    aria-invalid={showLinkedinInlineValidation && !isLinkedinReady}
                    aria-describedby={
                      showLinkedinInlineValidation && !isLinkedinReady
                        ? "linkedin-inline-error"
                        : undefined
                    }
                    value={linkedinText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLinkedinText(val);
                      if (val.trim().length >= 50) {
                        setShowLinkedinInlineValidation(false);
                      }
                      if (analysisError) setAnalysisError(null);
                    }}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        handleAnalyze();
                      }
                    }}
                    placeholder={`Tempel teks iklan lowongan LinkedIn di sini (Ctrl+V)...\n\nContoh isi iklan yang lengkap:\nPosisi: Frontend Developer — PT Teknologi Nusantara\nTugas: Mengembangkan fitur antarmuka aplikasi web menggunakan React & TypeScript.\nKualifikasi: Min. 1 tahun pengalaman, terbiasa menggunakan Git.\nKompensasi: Rp 8.000.000 – Rp 12.000.000 / bulan (Full-time).`}
                    className={`w-full p-4 rounded-xl border bg-slate-50/50 dark:bg-slate-950/60 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 outline-none text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 transition-all resize-y min-h-[190px] ${
                      showLinkedinInlineValidation && !isLinkedinReady
                        ? "border-rose-400 dark:border-rose-600 focus:border-rose-500 focus:ring-rose-500/20"
                        : "border-slate-300 dark:border-slate-700 focus:border-teal-700 focus:ring-teal-700/15"
                    }`}
                  />

                  {showLinkedinInlineValidation && !isLinkedinReady && (
                    <p
                      id="linkedin-inline-error"
                      role="alert"
                      className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {linkedinText.trim().length === 0
                          ? "Teks iklan lowongan tidak boleh kosong (minimal 50 karakter)."
                          : `Kurang ${
                              50 - linkedinText.trim().length
                            } karakter lagi agar analisis akurat (minimal 50 karakter).`}
                      </span>
                    </p>
                  )}
                </div>

                {/* Privacy Disclaimer */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                  <Info className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Jangan mengunggah dokumen yang memuat data pribadi. Teks dan poster dikirim ke Gemini API untuk dianalisis dan tidak disimpan di server.
                  </p>
                </div>

                {/* Turnstile Verification + Primary Action Button */}
                <div className="flex flex-col gap-3 pt-1">
                  {isTurnstileEnabled && publicEnabled && (
                    <div className="flex justify-end">
                      <TurnstileWidget
                        onTokenChange={setTurnstileToken}
                        resetSignal={turnstileResetSignal}
                        isDark={isDark}
                        disabled={!publicEnabled}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {!publicEnabled
                        ? maintenanceMessage
                        : linkedinText.trim().length < 50
                        ? `Masukkan ${50 - linkedinText.trim().length} karakter lagi untuk mengaktifkan analisis.`
                        : isTurnstileBlocked
                        ? "Selesaikan verifikasi keamanan di atas sebelum menganalisis."
                        : "Siap dianalisis — klik tombol atau tekan Ctrl+Enter."}
                    </span>

                    <div
                      className="relative group ml-auto inline-flex"
                      title={
                        !publicEnabled
                          ? maintenanceMessage
                          : !isLinkedinReady
                          ? "Minimal 50 karakter"
                          : isTurnstileBlocked
                          ? "Selesaikan verifikasi Turnstile"
                          : undefined
                      }
                    >
                      {!isLinkedinReady && !isAnalyzing && publicEnabled && (
                        <div
                          id="linkedin-submit-tooltip"
                          role="tooltip"
                          className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap shadow-lg border border-slate-700 z-20"
                        >
                          Minimal 50 karakter
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={
                          isAnalyzing ||
                          !isLinkedinReady ||
                          !publicEnabled ||
                          isTurnstileBlocked
                        }
                        aria-describedby={
                          !isLinkedinReady ? "linkedin-submit-tooltip" : undefined
                        }
                        onClick={handleAnalyze}
                        className="px-8 py-3 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 active:scale-[0.98] disabled:from-slate-400 disabled:to-slate-400 dark:disabled:from-slate-700 dark:disabled:to-slate-700 disabled:opacity-65 disabled:cursor-not-allowed disabled:shadow-none text-white font-bold text-sm transition-all shadow-lg shadow-teal-900/20 flex items-center gap-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Menganalisis...</span>
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4" />
                            <span>Analisis Sekarang</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: INSTAGRAM INPUT */}
            {activeTab === "instagram" && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-7 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
                      uploadError
                        ? "border-rose-400 dark:border-rose-600 bg-rose-50/40 dark:bg-rose-950/30"
                        : isDragging
                        ? "border-teal-700 bg-teal-50/50 dark:bg-teal-950/40"
                        : "border-slate-300 dark:border-slate-700 hover:border-teal-600 bg-slate-50/70 dark:bg-slate-950/50"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFilesAdd(e.target.files);
                        }
                        e.target.value = "";
                      }}
                    />

                    <div
                      className={`w-12 h-12 rounded-full border flex items-center justify-center mb-3 shadow-2xs ${
                        uploadError
                          ? "bg-rose-100 dark:bg-rose-950 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-teal-700 dark:text-teal-400"
                      }`}
                    >
                      <Upload className="w-6 h-6 stroke-[1.75]" />
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {attachedImages.length > 0
                        ? `Tambah slide poster lagi (${attachedImages.length}/${MAX_INSTAGRAM_IMAGES} terpasang)`
                        : "Unggah poster lowongan Instagram"}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Klik, seret beberapa gambar sekaligus, atau tekan Ctrl+V berulang untuk menumpuk slide (maks. {MAX_INSTAGRAM_IMAGES} gambar)
                    </p>
                  </div>

                  {/* Animated Upload Progress Bar */}
                  {uploadProgress !== null && (
                    <div
                      className="p-3 rounded-xl bg-teal-50/80 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 space-y-1.5"
                      aria-live="polite"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-teal-900 dark:text-teal-200">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Memuat berkas poster...</span>
                        </span>
                        <span className="font-mono tabular-nums">{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-teal-200/70 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-teal-600 to-emerald-500 transition-all duration-200 rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Inline Dropzone Validation Error */}
                  {uploadError && (
                    <div
                      role="alert"
                      className="p-3 rounded-xl bg-rose-50/85 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUploadError(null)}
                        aria-label="Tutup peringatan unggahan"
                        className="p-1 rounded hover:bg-black/5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Format & Quota strictly BELOW upload area */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-1 text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      PNG/JPG/WEBP, maks. 3 MB/slide &middot; hingga {MAX_INSTAGRAM_IMAGES} slide per analisis
                    </span>
                    <span
                      className={`font-semibold ${
                        imageQuotaRemaining <= 0
                          ? "text-rose-700 dark:text-rose-400"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      Sisa kuota gambar hari ini: {imageQuotaRemaining} dari {imageQuotaTotal}
                    </span>
                  </div>
                </div>

                {/* Rich Visual Pratinjau Card */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 flex flex-col gap-3.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-teal-700 dark:text-teal-400 shrink-0">
                        <ImageIcon className="w-5 h-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {attachedImages.length > 0
                              ? `Tumpukan Slide Poster (${attachedImages.length}/${MAX_INSTAGRAM_IMAGES})`
                              : "Pratinjau Poster"}
                          </h4>
                          {attachedImages.length > 0 && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${
                                uploadError
                                  ? "bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                                  : "bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                              }`}
                            >
                              {uploadError ? (
                                <>
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Batas Slide ({attachedImages.length}/{MAX_INSTAGRAM_IMAGES})</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Siap Dianalisis</span>
                                </>
                              )}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {attachedImages.length > 0
                            ? `${attachedImages.length} slide · ${(
                                attachedImages.reduce((acc, item) => acc + item.size, 0) /
                                (1024 * 1024)
                              ).toFixed(2)} MB total`
                            : "Belum ada berkas poster yang diunggah (bisa tumpuk hingga 5 slide)"}
                        </p>
                      </div>
                    </div>

                    {attachedImages.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearAllAttachedImages();
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                        title="Hapus semua slide poster"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Hapus Semua</span>
                      </button>
                    )}
                  </div>

                  {/* Stacked Slide Thumbnails Grid */}
                  {attachedImages.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {attachedImages.map((img, idx) => {
                        const dims = imageDimensionsMap[img.id];
                        return (
                          <div
                            key={img.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950/80 p-2.5 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="px-2 py-0.5 rounded-md bg-teal-700 text-white text-[10px] font-extrabold shrink-0">
                                  Slide {idx + 1}
                                </span>
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {img.name}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeAttachedImage(img.id);
                                }}
                                className="p-1 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer shrink-0"
                                title={`Hapus Slide ${idx + 1}`}
                                aria-label={`Hapus Slide ${idx + 1}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-center overflow-hidden rounded-lg bg-white/70 dark:bg-slate-900/60 p-1">
                              <img
                                src={img.previewUrl}
                                alt={`Pratinjau slide ${idx + 1}: ${img.name}`}
                                className="max-h-52 w-auto max-w-full object-contain rounded shadow-2xs"
                              />
                            </div>

                            <p className="text-[11px] text-slate-600 dark:text-slate-400 text-right tabular-nums">
                              {(img.size / (1024 * 1024)).toFixed(2)} MB
                              {dims ? ` · ${dims.width} × ${dims.height} px` : ""}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>

                {/* Privacy Disclaimer */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                  <Info className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Jangan mengunggah dokumen yang memuat data pribadi. Teks dan poster dikirim ke Gemini API untuk dianalisis dan tidak disimpan di server.
                  </p>
                </div>

                {/* Turnstile Verification + Primary Action Button */}
                <div className="flex flex-col gap-3 pt-1">
                  {isTurnstileEnabled && publicEnabled && (
                    <div className="flex justify-end">
                      <TurnstileWidget
                        onTokenChange={setTurnstileToken}
                        resetSignal={turnstileResetSignal}
                        isDark={isDark}
                        disabled={!publicEnabled}
                      />
                    </div>
                  )}

                  <div className="flex justify-end">
                    <div
                      className="relative group inline-flex"
                      title={
                        !publicEnabled
                          ? maintenanceMessage
                          : !isInstagramReady
                          ? "Unggah minimal satu poster lowongan"
                          : isTurnstileBlocked
                          ? "Selesaikan verifikasi Turnstile"
                          : undefined
                      }
                    >
                      {!isInstagramReady && !isAnalyzing && publicEnabled && (
                        <div
                          id="instagram-submit-tooltip"
                          role="tooltip"
                          className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap shadow-lg border border-slate-700 z-20"
                        >
                          Unggah minimal satu poster lowongan
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={
                          isAnalyzing ||
                          !isInstagramReady ||
                          !publicEnabled ||
                          isTurnstileBlocked
                        }
                        aria-describedby={
                          !isInstagramReady ? "instagram-submit-tooltip" : undefined
                        }
                        onClick={handleAnalyze}
                        className="px-8 py-3 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 active:scale-[0.98] disabled:from-slate-400 disabled:to-slate-400 dark:disabled:from-slate-700 dark:disabled:to-slate-700 disabled:opacity-65 disabled:cursor-not-allowed disabled:shadow-none text-white font-bold text-sm transition-all shadow-lg shadow-teal-900/20 flex items-center gap-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Menganalisis...</span>
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4" />
                            <span>Analisis Sekarang</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* 3. PANEL HASIL ANALISIS                                   */
          /* ========================================================= */
          <div className="p-5 sm:p-8 flex flex-col gap-6 animate-in fade-in duration-200">
            {currentAnalysis.skor === -1 ? (
              <div className="p-6 rounded-2xl bg-rose-50/75 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-rose-700 dark:text-rose-400 shadow-xs">
                  <AlertOctagon className="w-7 h-7" />
                </div>
                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-700 text-white inline-block mb-2">
                    Status: Error
                  </span>
                  <h3 className="text-base font-bold text-rose-800 dark:text-rose-200">
                    {currentAnalysis.pesanKhusus || "Analisis Tidak Dapat Dilakukan"}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-2 max-w-lg leading-relaxed">
                    {currentAnalysis.penjelasan}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetToInput}
                  className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Analisis Ulang</span>
                </button>
              </div>
            ) : (
              <>
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap">
                  <div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                      {currentAnalysis.posisi}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                        <Building className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                        {currentAnalysis.perusahaan}
                      </span>
                      <span>&bull;</span>
                      <span>Sumber: {currentAnalysis.jenisInput}</span>
                      <span>&bull;</span>
                      <span>Tanggal: {currentAnalysis.tanggal}</span>
                    </div>
                  </div>

                  {/* Category Badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div
                      className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold border flex items-center gap-1.5 shadow-2xs ${
                        currentAnalysis.kategori === "Rendah"
                          ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200"
                          : currentAnalysis.kategori === "Sedang"
                          ? "bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-200"
                          : "bg-rose-50 dark:bg-rose-950/60 border-rose-400 dark:border-rose-700 text-rose-800 dark:text-rose-200"
                      }`}
                    >
                      {currentAnalysis.kategori === "Rendah" ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Indikasi risiko Rendah</span>
                        </>
                      ) : currentAnalysis.kategori === "Sedang" ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span>Indikasi risiko Sedang</span>
                        </>
                      ) : (
                        <>
                          <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          <span>Indikasi risiko Tinggi</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Prompt Injection Warning Banner (Requirement C.3) */}
                {currentAnalysis.promptInjectionWarning && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5"
                  >
                    <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed font-semibold">
                      {currentAnalysis.promptInjectionMessage ||
                        "Iklan memuat kalimat yang mencoba memengaruhi penilaian. Hasil perlu dibaca hati-hati."}
                    </p>
                  </div>
                )}

                {/* Result Disclaimer (Requirement D.2) */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-medium">
                    Hasil ini adalah alat bantu berdasarkan isi iklan, bukan bukti bahwa perusahaan melakukan ghost job.
                  </p>
                </div>

                {/* Two-column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-5 w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs flex flex-col items-center justify-between">
                    <SpeedometerGauge
                      score={currentAnalysis.skor}
                      kategori={currentAnalysis.kategori}
                    />
                    {(() => {
                      const dims = buildFiveDimensionBreakdown(currentAnalysis);
                      const fmt = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });
                      const total = dims.reduce((acc, d) => acc + d.weightedContribution, 0);
                      return (
                        <div className="w-full mt-1 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[11px] leading-relaxed text-slate-800 dark:text-slate-200">
                          <p className="font-semibold mb-1">Cara skor dihitung</p>
                          <p className="font-mono break-words">
                            Skor = 0,25×D1 + 0,20×D2 + 0,20×D3 + 0,20×D4 + 0,15×D5
                          </p>
                          <p className="font-mono break-words">
                            = {dims.map((d) => fmt(d.weightedContribution)).join(" + ")} = {fmt(total)}
                            {Math.abs(total - currentAnalysis.skor) > 1e-9
                              ? `, dibulatkan menjadi ${currentAnalysis.skor}`
                              : ""}
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="lg:col-span-7 flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Red Flags
                      </h3>

                      {currentAnalysis.red_flags && currentAnalysis.red_flags.length > 0 ? (
                        <ul className="space-y-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                          {currentAnalysis.red_flags.map((flag, idx) => (
                            <li key={idx} className="flex items-start gap-2 leading-relaxed">
                              <span className="text-[#ea4335] font-bold text-base leading-none select-none">
                                &bull;
                              </span>
                              <span>{flag}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          &check; Tidak ditemukan indikasi sinyal red flags mencurigakan pada isi iklan ini.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Penjelasan
                      </h3>
                      <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                        {currentAnalysis.penjelasan}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5 Dimensi Risiko — Detailed Breakdown */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        Rincian 5 Dimensi Risiko Ghost Job
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Skala 0–100 per dimensi (makin tinggi makin berisiko)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBreakdownModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 font-bold text-xs transition-colors cursor-pointer"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Lihat Detail</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {buildFiveDimensionBreakdown(currentAnalysis).map((dim, idx) => {
                      const meta = getDimensionRiskMeta(dim.score);
                      return (
                        <div
                          key={dim.key}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-slate-900 dark:text-white">
                              0{idx + 1}. {dim.label}{" "}
                              <span className="text-slate-600 dark:text-slate-400 font-medium">
                                ({dim.weightPct}%)
                              </span>
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`font-bold ${meta.textClass}`}>
                                {meta.label}
                              </span>
                              <span className="font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                                {dim.score}/100
                              </span>
                            </div>
                          </div>

                          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${meta.barClass}`}
                              style={{ width: `${dim.score}%` }}
                            />
                          </div>

                          <div className="flex items-start justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                            <p className="leading-relaxed">{dim.description}</p>
                            <span className="shrink-0 font-mono tabular-nums font-semibold">
                              +{dim.weightedContribution} pts
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pratinjau input tersimpan (teks LinkedIn atau slide poster) */}
                <SavedInputPreview analysis={currentAnalysis} defaultExpanded={true} />

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsBreakdownModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-300 font-bold text-xs transition-all cursor-pointer"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Rincian 5 Dimensi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportModalAnalysis(currentAnalysis)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-teal-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all cursor-pointer shadow-2xs"
                      title="Unduh laporan analisis dalam format PDF atau Gambar PNG"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Ekspor Laporan (PDF/PNG)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetToInput}
                    className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-xs flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Analisis Ulang</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Rincian 5 Dimensi Modal */}
      <AnalysisBreakdownModal
        isOpen={isBreakdownModalOpen}
        onClose={() => setIsBreakdownModalOpen(false)}
        analysis={currentAnalysis}
        onExport={(analysis) => {
          setIsBreakdownModalOpen(false);
          setExportModalAnalysis(analysis);
        }}
      />

      {/* Export Modal Integration */}
      <ExportModal
        isOpen={!!exportModalAnalysis}
        onClose={() => setExportModalAnalysis(null)}
        analysis={exportModalAnalysis}
      />
    </div>
  );
};
