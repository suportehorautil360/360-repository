/**
 * Fila offline para atualizar `medicaoAtual` do equipamento após checklist de
 * campo. O registro do checklist vai ao Firestore; a medição do equipamento
 * depende do NestJS (`POST /equipamentos/sync-medicao/:id`).
 */
import { ApiError } from "../../../lib/api/client";
import {
  equipamentosApi,
  parseMedicaoTexto,
} from "../../../pages/prefeitura/sections/equipamentos/equipamentos-api";

export type MedicaoPendente = {
  equipamentoId: string;
  leituraTexto: string;
};

const KEY = "hu360-checklist-medicao-fila";

function ler(): MedicaoPendente[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MedicaoPendente[]) : [];
  } catch {
    return [];
  }
}

function gravar(fila: MedicaoPendente[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(fila));
  } catch {
    /* cota cheia — ignora */
  }
}

function enfileirar(item: MedicaoPendente): void {
  const filtrada = ler().filter((p) => p.equipamentoId !== item.equipamentoId);
  gravar([...filtrada, item]);
}

function offline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function pendentesMedicao(): number {
  return ler().length;
}

async function enviar(item: MedicaoPendente): Promise<void> {
  await equipamentosApi.sincronizarMedicaoChecklist(
    item.equipamentoId,
    item.leituraTexto,
  );
}

/**
 * Atualiza a medição do equipamento; sem rede enfileira para depois.
 * Devolve true quando sincronizou agora.
 */
export async function enviarMedicaoComFila(
  equipamentoId: string,
  leituraTexto: string,
): Promise<boolean> {
  const leitura = leituraTexto.trim();
  if (!leitura || parseMedicaoTexto(leitura) == null || !equipamentoId.trim()) {
    return false;
  }

  const item = { equipamentoId: equipamentoId.trim(), leituraTexto: leitura };
  if (offline()) {
    enfileirar(item);
    return false;
  }

  try {
    await enviar(item);
    return true;
  } catch (e) {
    if (e instanceof ApiError) {
      console.warn("[Checklist] Medição rejeitada pelo backend:", e.message);
      return false;
    }
    enfileirar(item);
    return false;
  }
}

/** Tenta reenviar a fila. Retorna quantas medições foram sincronizadas. */
export async function sincronizarMedicoes(): Promise<number> {
  const fila = ler();
  if (fila.length === 0 || offline()) return 0;

  const restantes: MedicaoPendente[] = [];
  let enviados = 0;
  for (const item of fila) {
    try {
      await enviar(item);
      enviados++;
    } catch (e) {
      if (e instanceof ApiError) {
        console.warn("[Checklist] Medição rejeitada pelo backend:", e.message);
      } else {
        restantes.push(item);
      }
    }
  }
  gravar(restantes);
  return enviados;
}
