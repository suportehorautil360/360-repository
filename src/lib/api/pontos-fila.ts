/**
 * Fila offline de batidas de ponto. Quando não há rede, a batida (com a foto
 * base64) fica em localStorage e é reenviada quando a conexão volta.
 *
 * Limitações conhecidas (MVP): localStorage tem ~5MB (poucas dezenas de fotos);
 * batidas na fila não aparecem nos slots até sincronizar; erro de servidor
 * (4xx/5xx) mantém o item para nova tentativa.
 */
import { ApiError } from "./client";
import { pontosApi, type BaterPontoInput } from "./pontos";

const KEY = "hu360-ponto-fila";

function ler(): BaterPontoInput[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BaterPontoInput[]) : [];
  } catch {
    return [];
  }
}

function gravar(fila: BaterPontoInput[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(fila));
  } catch {
    /* cota cheia — ignora */
  }
}

function offline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function pendentes(): number {
  return ler().length;
}

/** Bate o ponto; se offline/sem rede, enfileira para sincronizar depois. */
export async function baterComFila(
  input: BaterPontoInput,
): Promise<{ sincronizado: boolean }> {
  if (offline()) {
    gravar([...ler(), input]);
    return { sincronizado: false };
  }
  try {
    await pontosApi.bater(input);
    return { sincronizado: true };
  } catch (e) {
    // Erro do servidor não é offline — propaga para o usuário ver.
    if (e instanceof ApiError) throw e;
    gravar([...ler(), input]);
    return { sincronizado: false };
  }
}

/** Tenta reenviar a fila. Retorna quantas batidas foram sincronizadas. */
export async function sincronizar(): Promise<number> {
  const fila = ler();
  if (fila.length === 0 || offline()) return 0;
  const restantes: BaterPontoInput[] = [];
  let enviadas = 0;
  for (const item of fila) {
    try {
      await pontosApi.bater(item);
      enviadas++;
    } catch {
      restantes.push(item);
    }
  }
  gravar(restantes);
  return enviadas;
}
