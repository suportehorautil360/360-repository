/**
 * Upload das fotos do checklist para o Supabase Storage via backend
 * (POST /uploads/checklist-fotos). Online, as fotos saem do doc do Firestore
 * (base64 estourava o limite de 1 MiB) e viram URLs públicas.
 */
import { ApiError, BASE_URL } from "../../../lib/api/client";

const EXTENSAO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function dataUrlParaBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Não é um data URL base64.");
  const [, mime, b64] = match;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export type FotoChecklist = { nome: string; dataUrl: string };

/**
 * Sobe as fotos e devolve as URLs públicas na mesma ordem. Aborta em
 * `timeoutMs` para nunca prender o save do checklist numa rede instável —
 * quem chama trata o erro mantendo o base64 (comportamento antigo).
 */
export async function uploadChecklistFotos(
  checklistId: string,
  fotos: FotoChecklist[],
  timeoutMs = 20_000,
): Promise<string[]> {
  const form = new FormData();
  form.append("checklistId", checklistId);
  for (const foto of fotos) {
    const blob = dataUrlParaBlob(foto.dataUrl);
    const ext = EXTENSAO[blob.type] ?? "jpg";
    form.append("fotos", new File([blob], `${foto.nome}.${ext}`, { type: blob.type }));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}/uploads/checklist-fotos`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ApiError(res.status, `Upload de fotos falhou (${res.status}).`);
    }
    const json = (await res.json()) as { data?: string[] };
    if (!Array.isArray(json.data) || json.data.length !== fotos.length) {
      throw new Error("Resposta inesperada do upload de fotos.");
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}
