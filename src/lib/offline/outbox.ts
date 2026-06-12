/** Operações da fila de escritas offline (ver db.ts e a spec offline-outbox). */
import { offlineDb, type ItemOutbox } from "./db";

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 30 * 60_000;

/**
 * Timestamp estritamente crescente: duas batidas no mesmo milissegundo não
 * podem embaralhar a ordem de envio (o ledger do ponto é sequencial — NSR).
 */
let ultimoTs = 0;
function agoraMonotonico(): string {
  const t = Math.max(Date.now(), ultimoTs + 1);
  ultimoTs = t;
  return new Date(t).toISOString();
}

export async function enfileirar(
  entity: string,
  payload: unknown,
  id: string = crypto.randomUUID(),
): Promise<ItemOutbox> {
  const agora = agoraMonotonico();
  const item: ItemOutbox = {
    id,
    entity,
    action: "create",
    payload,
    status: "PENDING",
    createdAt: agora,
    retryCount: 0,
    proximaTentativaEm: agora,
  };
  await offlineDb.sync_queue.put(item);
  return item;
}

/** Itens prontos para envio (PENDING e fora do backoff), em ordem de criação. */
export async function listarDevidos(agora = new Date()): Promise<ItemOutbox[]> {
  const fila = await offlineDb.sync_queue
    .where("status")
    .equals("PENDING")
    .sortBy("createdAt");
  const limite = agora.toISOString();
  return fila.filter((i) => i.proximaTentativaEm <= limite);
}

/** Conta tudo que ainda não foi confirmado (inclui NEEDS_ATTENTION). */
export async function contarPendentes(entity?: string): Promise<number> {
  const todos = await offlineDb.sync_queue.toArray();
  return entity ? todos.filter((i) => i.entity === entity).length : todos.length;
}

export async function marcarEnviando(id: string): Promise<void> {
  await offlineDb.sync_queue.update(id, { status: "SENDING" });
}

/** Servidor confirmou — sai da fila. */
export async function concluir(id: string): Promise<void> {
  await offlineDb.sync_queue.delete(id);
}

/** Erro definitivo (validação): sai do envio automático, fica visível. */
export async function marcarAtencao(id: string, erro: string): Promise<void> {
  await offlineDb.sync_queue.update(id, {
    status: "NEEDS_ATTENTION",
    lastError: erro,
  });
}

/** Erro transitório: volta a PENDING com backoff exponencial. */
export async function registrarFalha(id: string, erro: string): Promise<void> {
  const item = await offlineDb.sync_queue.get(id);
  if (!item) return;
  const retryCount = item.retryCount + 1;
  const espera = Math.min(BACKOFF_BASE_MS * 2 ** (retryCount - 1), BACKOFF_MAX_MS);
  await offlineDb.sync_queue.update(id, {
    status: "PENDING",
    retryCount,
    lastError: erro,
    proximaTentativaEm: new Date(Date.now() + espera).toISOString(),
  });
}
