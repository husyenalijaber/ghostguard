import { AttachedImage, SavedInputImage } from "../types";

/**
 * Compresses an attached image into a lightweight JPEG data URL suitable for
 * persisting in browser localStorage history while keeping poster text legible.
 */
export async function compressAttachedImageForHistory(
  img: AttachedImage,
  maxDimension = 840,
  quality = 0.65
): Promise<SavedInputImage> {
  const sourceDataUrl = `data:${img.mimeType};base64,${img.base64}`;

  if (typeof document === "undefined") {
    return { name: img.name, dataUrl: sourceDataUrl };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (dataUrl: string) => {
      if (settled) return;
      settled = true;
      resolve({ name: img.name, dataUrl });
    };

    const fallbackTimer = setTimeout(() => {
      finish(sourceDataUrl);
    }, 3000);

    const probe = new Image();
    probe.onload = () => {
      clearTimeout(fallbackTimer);
      try {
        const { naturalWidth, naturalHeight } = probe;
        if (!naturalWidth || !naturalHeight) {
          finish(sourceDataUrl);
          return;
        }

        const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
        const targetW = Math.max(1, Math.round(naturalWidth * scale));
        const targetH = Math.max(1, Math.round(naturalHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finish(sourceDataUrl);
          return;
        }

        // Fill white background before JPEG export in case source PNG/WEBP has transparency
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(probe, 0, 0, targetW, targetH);

        const compressedUrl = canvas.toDataURL("image/jpeg", quality);
        finish(
          compressedUrl && compressedUrl.length < sourceDataUrl.length
            ? compressedUrl
            : sourceDataUrl
        );
      } catch {
        finish(sourceDataUrl);
      }
    };
    probe.onerror = () => {
      clearTimeout(fallbackTimer);
      finish(sourceDataUrl);
    };
    probe.src = sourceDataUrl;
  });
}
