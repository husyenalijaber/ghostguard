import { jsPDF } from "jspdf";
import { AnalysisResult } from "../types";

/**
 * Sanitize filename strings
 */
function sanitizeFileName(str: string): string {
  return (str || "Loker")
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .slice(0, 30);
}

/**
 * Helper to download blob/dataURL
 */
function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export Analysis Result as a clean, professionally styled PDF
 */
export function exportAnalysisAsPDF(analysis: AnalysisResult): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const scoreVal = analysis.skor !== undefined && analysis.skor >= 0 ? analysis.skor : analysis.totalScore || 0;
  const katVal = analysis.kategori || (scoreVal <= 33 ? "Rendah" : scoreVal <= 66 ? "Sedang" : "Tinggi");
  const perusahaanVal = analysis.perusahaan || analysis.companyName || "Tidak disebutkan";
  const posisiVal = analysis.posisi || analysis.jobTitle || "Tidak disebutkan";
  const penjelasanVal = analysis.penjelasan || analysis.mainReason || "-";
  const redFlagsList = analysis.red_flags || analysis.redFlags || [];

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // Slate 900 #0f172a
  doc.rect(margin, y, contentWidth, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("GHOSTGUARD INDONESIA", margin + 6, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  doc.text(
    "Laporan Hasil Analisis Risiko Ghost Job Posting",
    margin + 6,
    y + 16
  );

  const dateStr =
    analysis.tanggal ||
    new Date(analysis.timestamp || Date.now()).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  doc.setFontSize(8);
  doc.text(`Tanggal: ${dateStr}`, pageWidth - margin - 6, y + 13, {
    align: "right",
  });

  y += 28;

  // 2. Job & Company Details
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(posisiVal, margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Perusahaan: ${perusahaanVal}`, margin, y);
  y += 8;

  // 3. Verdict & Score Card (0-33 Rendah, 34-66 Sedang, 67-100 Tinggi)
  const isRendah = katVal === "Rendah" || scoreVal <= 33;
  const isSedang = !isRendah && (katVal === "Sedang" || scoreVal <= 66);

  let bgR = 252, bgG = 232, bgB = 230;
  let borderR = 234, borderG = 67, borderB = 53;
  let textR = 197, textG = 34, textB = 31;

  if (isRendah) {
    bgR = 230; bgG = 244; bgB = 234;
    borderR = 52; borderG = 168; borderB = 83;
    textR = 19; textG = 115; textB = 51;
  } else if (isSedang) {
    bgR = 254; bgG = 247; bgB = 224;
    borderR = 251; borderG = 188; borderB = 4;
    textR = 176; textG = 96; textB = 0;
  }

  doc.setFillColor(bgR, bgG, bgB);
  doc.setDrawColor(borderR, borderG, borderB);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(textR, textG, textB);
  doc.text(`Indikasi risiko ${katVal}`, margin + 5, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Sumber Input: ${analysis.jenisInput || "LinkedIn"}`, margin + 5, y + 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(textR, textG, textB);
  doc.text(`${scoreVal}/100`, pageWidth - margin - 6, y + 11, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Skor Risiko Ghost Job", pageWidth - margin - 6, y + 18, { align: "right" });

  y += 31;

  // 4. Penjelasan
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Penjelasan:", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const splitReason = doc.splitTextToSize(penjelasanVal, contentWidth);
  doc.text(splitReason, margin, y);
  y += splitReason.length * 4.5 + 5;

  // 5. Evaluasi 5 Dimensi Berbobot (0-100)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Evaluasi 5 Dimensi Risiko (Skala 0–100):", margin, y);
  y += 5;

  const dim = analysis.dimensi_skor || {
    deskripsi: 0,
    identitas: 0,
    konsistensi: 0,
    kompensasi: 0,
    proses: 0,
  };

  const criteriaList = [
    { label: "Deskripsi Pekerjaan (Bobot 25%)", val: dim.deskripsi },
    { label: "Identitas Perusahaan (Bobot 20%)", val: dim.identitas },
    { label: "Konsistensi Persyaratan (Bobot 20%)", val: dim.konsistensi },
    { label: "Transparansi Kompensasi (Bobot 20%)", val: dim.kompensasi },
    { label: "Proses Rekrutmen (Bobot 15%)", val: dim.proses },
  ];

  criteriaList.forEach((crit) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, y, contentWidth, 7, 1, 1, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(crit.label, margin + 3, y + 4.8);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`${crit.val} / 100`, pageWidth - margin - 3, y + 4.8, { align: "right" });

    y += 8.5;
  });

  y += 4;

  // 6. Red Flags Section
  if (redFlagsList.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(197, 34, 31);
    doc.text("Red Flags Terdeteksi:", margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    redFlagsList.slice(0, 8).forEach((flag) => {
      const splitFlag = doc.splitTextToSize(`• ${flag}`, contentWidth - 4);
      doc.text(splitFlag, margin + 2, y);
      y += splitFlag.length * 4.2;
    });
    y += 4;
  }

  // Footer Disclaimer (Section F.1)
  const footerY = 280;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    "Hasil ini adalah alat bantu berdasarkan isi iklan, bukan bukti bahwa perusahaan melakukan ghost job.",
    margin,
    footerY
  );

  const filename = `GhostGuard_Analisis_${sanitizeFileName(perusahaanVal)}_${sanitizeFileName(posisiVal)}.pdf`;
  doc.save(filename);
}

/**
 * Export Analysis Result as a crisp PNG image
 */
export async function exportAnalysisAsImage(
  analysis: AnalysisResult
): Promise<void> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const scoreVal = analysis.skor !== undefined && analysis.skor >= 0 ? analysis.skor : analysis.totalScore || 0;
  const katVal = analysis.kategori || (scoreVal <= 33 ? "Rendah" : scoreVal <= 66 ? "Sedang" : "Tinggi");
  const perusahaanVal = analysis.perusahaan || analysis.companyName || "Tidak disebutkan";
  const posisiVal = analysis.posisi || analysis.jobTitle || "Tidak disebutkan";
  const penjelasanVal = analysis.penjelasan || analysis.mainReason || "-";
  const redFlagsList = analysis.red_flags || analysis.redFlags || [];

  const width = 1200;
  const baseHeight = 1260;
  const height = baseHeight + redFlagsList.length * 50;

  canvas.width = width;
  canvas.height = height;

  // Background
  ctx.fillStyle = "#F8F9FA";
  ctx.fillRect(0, 0, width, height);

  // Top header bar (Slate 900)
  ctx.fillStyle = "#0F172A";
  ctx.fillRect(0, 0, width, 130);

  // Header Text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("GHOSTGUARD INDONESIA", 50, 62);

  ctx.fillStyle = "#E2E8F0";
  ctx.font = "18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Ringkasan Hasil Analisis Risiko Ghost Job Posting", 50, 96);

  const dateStr =
    analysis.tanggal ||
    new Date(analysis.timestamp || Date.now()).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  ctx.textAlign = "right";
  ctx.fillStyle = "#CBD5E1";
  ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`Tanggal: ${dateStr}`, width - 50, 72);
  ctx.fillText(`Sumber: ${analysis.jenisInput || "LinkedIn"}`, width - 50, 98);
  ctx.textAlign = "left";

  let currentY = 170;

  // Job Info Card
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#DADCE0";
  ctx.lineWidth = 2;
  roundRect(ctx, 50, currentY, width - 100, 120, 16, true, true);

  ctx.fillStyle = "#202124";
  ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(posisiVal, 80, currentY + 48);

  ctx.fillStyle = "#3C4043";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`Perusahaan: ${perusahaanVal}`, 80, currentY + 86);

  currentY += 150;

  // Category & Score Banner
  const isRendah = katVal === "Rendah" || scoreVal <= 33;
  const isSedang = !isRendah && (katVal === "Sedang" || scoreVal <= 66);

  let statusBg = "#FCE8E6";
  let statusBorder = "#EA4335";
  let statusText = "#C5221F";

  if (isRendah) {
    statusBg = "#E6F4EA";
    statusBorder = "#34A853";
    statusText = "#137333";
  } else if (isSedang) {
    statusBg = "#FEF7E0";
    statusBorder = "#FBBC04";
    statusText = "#B06000";
  }

  ctx.fillStyle = statusBg;
  ctx.strokeStyle = statusBorder;
  ctx.lineWidth = 3;
  roundRect(ctx, 50, currentY, width - 100, 120, 16, true, true);

  ctx.fillStyle = statusText;
  ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`Indikasi risiko ${katVal}`, 80, currentY + 55);

  ctx.fillStyle = "#3C4043";
  ctx.font = "17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Skala Risiko: 0-33 Rendah | 34-66 Sedang | 67-100 Tinggi", 80, currentY + 90);

  ctx.textAlign = "right";
  ctx.fillStyle = statusText;
  ctx.font = "bold 52px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`${scoreVal}`, width - 150, currentY + 66);

  ctx.fillStyle = "#5F6368";
  ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("/100", width - 85, currentY + 66);
  ctx.textAlign = "left";

  currentY += 150;

  // Penjelasan Box
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#DADCE0";
  ctx.lineWidth = 1.5;
  roundRect(ctx, 50, currentY, width - 100, 140, 16, true, true);

  ctx.fillStyle = "#202124";
  ctx.font = "bold 19px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Penjelasan:", 75, currentY + 35);

  ctx.fillStyle = "#3C4043";
  ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  wrapText(ctx, penjelasanVal, 75, currentY + 65, width - 150, 24);

  currentY += 170;

  // 5 Dimensi Berbobot
  ctx.fillStyle = "#202124";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Evaluasi 5 Dimensi Risiko (Skala 0–100):", 50, currentY);
  currentY += 20;

  const dim = analysis.dimensi_skor || {
    deskripsi: 0,
    identitas: 0,
    konsistensi: 0,
    kompensasi: 0,
    proses: 0,
  };

  const dims = [
    { label: "Deskripsi Pekerjaan (Bobot 25%)", score: dim.deskripsi },
    { label: "Identitas Perusahaan (Bobot 20%)", score: dim.identitas },
    { label: "Konsistensi Persyaratan (Bobot 20%)", score: dim.konsistensi },
    { label: "Transparansi Kompensasi (Bobot 20%)", score: dim.kompensasi },
    { label: "Proses Rekrutmen (Bobot 15%)", score: dim.proses },
  ];

  dims.forEach((d) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#DADCE0";
    ctx.lineWidth = 1;
    roundRect(ctx, 50, currentY, width - 100, 50, 12, true, true);

    ctx.fillStyle = "#202124";
    ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(d.label, 75, currentY + 31);

    const barWidth = 160;
    const barX = width - 290;
    ctx.fillStyle = "#E2E8F0";
    roundRect(ctx, barX, currentY + 18, barWidth, 14, 7, true, false);

    const fillWidth = Math.min(barWidth, (d.score / 100) * barWidth);
    ctx.fillStyle = d.score <= 33 ? "#34A853" : d.score <= 66 ? "#FBBC04" : "#EA4335";
    roundRect(ctx, barX, currentY + 18, fillWidth, 14, 7, true, false);

    ctx.textAlign = "right";
    ctx.fillStyle = "#202124";
    ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`${d.score}/100`, width - 75, currentY + 31);
    ctx.textAlign = "left";

    currentY += 60;
  });

  currentY += 20;

  // Red Flags List
  if (redFlagsList.length > 0) {
    ctx.fillStyle = "#C5221F";
    ctx.font = "bold 19px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Red Flags Terdeteksi:", 50, currentY);
    currentY += 25;

    redFlagsList.forEach((flag) => {
      ctx.fillStyle = "#FCE8E6";
      ctx.strokeStyle = "#EA4335";
      roundRect(ctx, 50, currentY, width - 100, 42, 10, true, true);

      ctx.fillStyle = "#202124";
      ctx.font = "15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`• ${flag}`, 75, currentY + 26);

      currentY += 50;
    });
  }

  // Footer Disclaimer (Section F.1)
  const footerY = height - 40;
  ctx.fillStyle = "#3C4043";
  ctx.font = "15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(
    "Hasil ini adalah alat bantu berdasarkan isi iklan, bukan bukti bahwa perusahaan melakukan ghost job.",
    50,
    footerY
  );

  const dataUrl = canvas.toDataURL("image/png");
  const filename = `GhostGuard_Analisis_${sanitizeFileName(perusahaanVal)}_${sanitizeFileName(posisiVal)}.png`;
  triggerDownload(dataUrl, filename);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill = true,
  stroke = true
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let curY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, curY);
      line = words[n] + " ";
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, curY);
}
