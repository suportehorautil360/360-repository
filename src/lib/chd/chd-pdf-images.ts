import type { ChdDocCompleto } from "../api/checklist-devolucao";

export type ImagemPdfCarregada = {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
};

function formatFromDataUrl(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  if (dataUrl.includes("image/png")) return "PNG";
  if (dataUrl.includes("image/webp")) return "WEBP";
  return "JPEG";
}

export function formatImagemPdf(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  return formatFromDataUrl(dataUrl);
}

export function coletarUrlsFotosChd(chd: ChdDocCompleto): string[] {
  const urls = new Set<string>();

  for (const item of Object.values(chd.generalState ?? {})) {
    const url = item?.photo?.trim();
    if (url) urls.add(url);
  }

  for (const part of chd.parts?.items ?? []) {
    if (part.newPhoto?.trim()) urls.add(part.newPhoto.trim());
    if (part.replacedPhoto?.trim()) urls.add(part.replacedPhoto.trim());
  }

  return [...urls];
}

async function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao ler imagem."));
    reader.readAsDataURL(blob);
  });
}

async function carregarViaCanvas(url: string): Promise<ImagemPdfCarregada | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 1;
        canvas.height = img.naturalHeight || 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL("image/jpeg", 0.9),
          widthPx: canvas.width,
          heightPx: canvas.height,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function carregarImagemPdf(
  url: string,
): Promise<ImagemPdfCarregada | null> {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:image")) {
    return carregarViaCanvas(trimmed);
  }

  try {
    const response = await fetch(trimmed, { mode: "cors", credentials: "omit" });
    if (!response.ok) {
      return carregarViaCanvas(trimmed);
    }
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      return null;
    }
    const dataUrl = await blobParaDataUrl(blob);
    return carregarViaCanvas(dataUrl);
  } catch {
    return carregarViaCanvas(trimmed);
  }
}

export async function carregarMapaImagensChd(
  urls: string[],
): Promise<Map<string, ImagemPdfCarregada | null>> {
  const map = new Map<string, ImagemPdfCarregada | null>();
  await Promise.all(
    urls.map(async (url) => {
      map.set(url, await carregarImagemPdf(url));
    }),
  );
  return map;
}

export function dimensaoImagemPdf(
  img: ImagemPdfCarregada,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  const ratio = img.widthPx / Math.max(img.heightPx, 1);
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  return { w, h };
}
