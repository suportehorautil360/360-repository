/**
 * Fila offline do workflow de checklist (runs/answers no NestJS).
 *
 * O envio era best-effort: backend fora do ar ou operador sem rede =
 * respostas "Não" perdidas para sempre (só o registro legado do Firestore
 * sobrevivia). Mesmo padrão da fila de pontos: sem rede enfileira em
 * localStorage e reenvia quando a conexão volta.
 */
import { ApiError } from "../../../lib/api/client";
import {
  checklistsApi,
  type CriarChecklistRunInput,
  type ResponderChecklistInput,
} from "./checklists-api";

export type WorkflowPendente = {
  /** Dedup: um checklist gera no máximo um run pendente. */
  checklistId: string;
  run: CriarChecklistRunInput;
  respostas: ResponderChecklistInput[];
};

const KEY = "hu360-checklist-workflow-fila";

function ler(): WorkflowPendente[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WorkflowPendente[]) : [];
  } catch {
    return [];
  }
}

function gravar(fila: WorkflowPendente[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(fila));
  } catch {
    /* cota cheia — ignora */
  }
}

function enfileirar(item: WorkflowPendente): void {
  gravar([...ler().filter((p) => p.checklistId !== item.checklistId), item]);
}

function offline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function pendentesWorkflow(): number {
  return ler().length;
}

async function enviar(item: WorkflowPendente): Promise<void> {
  const run = await checklistsApi.iniciar(item.run);
  for (const resposta of item.respostas) {
    await checklistsApi.responder(run.id, resposta);
  }
}

/**
 * Envia o workflow; sem rede (ou erro de rede), enfileira para depois.
 * Rejeição explícita do backend (ApiError) descarta o item — repetir não
 * resolveria e o registro legado do Firestore já foi salvo.
 * Devolve true quando sincronizou agora.
 */
export async function enviarWorkflowComFila(
  item: WorkflowPendente,
): Promise<boolean> {
  if (offline()) {
    enfileirar(item);
    return false;
  }
  try {
    await enviar(item);
    return true;
  } catch (e) {
    if (e instanceof ApiError) {
      console.warn("[Checklist] Workflow rejeitado pelo backend:", e.message);
      return false;
    }
    enfileirar(item);
    return false;
  }
}

/** Tenta reenviar a fila. Retorna quantos workflows foram sincronizados. */
export async function sincronizarWorkflows(): Promise<number> {
  const fila = ler();
  if (fila.length === 0 || offline()) return 0;
  const restantes: WorkflowPendente[] = [];
  let enviados = 0;
  for (const item of fila) {
    try {
      await enviar(item);
      enviados++;
    } catch (e) {
      if (e instanceof ApiError) {
        console.warn("[Checklist] Workflow rejeitado pelo backend:", e.message);
      } else {
        restantes.push(item);
      }
    }
  }
  gravar(restantes);
  return enviados;
}
