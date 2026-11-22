export interface AttachedImage {
  id: string;
  base64: string;
  mimeType: string;
  name: string;
  size: number;
  previewUrl: string;
}

export interface AnalyzePayload {
  jobPostingText?: string;
  imageBase64?: string;
  imageMimeType?: string;
  images?: Array<{ base64: string; mimeType: string; name?: string }>;
  jobUrl?: string;
  sourceType?: "LinkedIn" | "Instagram";
}

export interface DimensiSkor {
  deskripsi: number; // Bobot 25%
  identitas: number; // Bobot 20%
  konsistensi: number; // Bobot 20%
  kompensasi: number; // Bobot 20%
  proses: number; // Bobot 15%
}

export type KategoriRisiko = "Rendah" | "Sedang" | "Tinggi" | "Error";
export type JobClassification = "LEGITIMATE" | "MENCURIGAKAN" | "GHOST JOB" | "SCAM";
export type JobVerdict = "SCAM" | "GHOST JOB" | "MENCURIGAKAN" | "LEGITIMATE";
export type RiskLevel = "KRITIS" | "TINGGI" | "SEDANG" | "RENDAH";

export interface CriterionScore {
  name: string;
  score: number;
  note: string;
}

export interface ScamIndicator {
  title: string;
  category: string;
  severity: "kritis" | "tinggi" | "sedang";
  explanation: string;
}

export interface SavedInputImage {
  name: string;
  dataUrl: string;
}

export interface SavedInputDetails {
  text?: string;
  images?: SavedInputImage[];
}

export interface AnalysisResult {
  id: string;
  timestamp: number;

  // New Thesis Specification Fields
  jenisInput: "LinkedIn" | "Instagram";
  tanggal: string; // misal: "12 Nov 2026, 15:30"
  perusahaan: string;
  posisi: string;
  skor: number; // 0-100, atau -1 jika Error
  kategori: KategoriRisiko;
  dimensi_skor: DimensiSkor;
  red_flags: string[];
  penjelasan: string;
  pesanKhusus?: string;
  promptInjectionWarning?: boolean;
  promptInjectionMessage?: string;

  // Core & Backwards Compatibility Fields
  jobTitle: string;
  companyName: string;
  totalScore: number;
  classification: JobClassification;
  classificationLabel?: string;
  verdict?: JobVerdict;
  confidenceScore?: number;
  riskLevel?: RiskLevel;
  scamIndicators?: ScamIndicator[];
  mainReason: string;
  applicantAdvice: string[];
  redFlags?: string[];
  greenFlags?: string[];
  exactMarkdown: string;
  originalInput: string;
  inputDetails?: SavedInputDetails;
  analysisDurationMs?: number;
  scores: {
    c1: CriterionScore;
    c2: CriterionScore;
    c3: CriterionScore;
    c4: CriterionScore;
    c5: CriterionScore;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}
