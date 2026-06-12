/** Operações da fila de escritas offline (ver db.ts e a spec offline-outbox). */
import { offlineDb, type ItemOutbox } from "./db";

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 30 * 60_000;

/**
 * Timestamp estritamente crescente: duas batidas no mesmo milissegundo não
 * podem embaralhar a ordem de envio (o ledger do ponto é sequencial — NSR).
 * Limite conhecido: a ordem entre recargas da página depende do relógio do
 * aparelho (regressão de relógio reordena; sequência persistida fica p/ depois).
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
  const item: ItemOutbox = {
    id,
    entity,
    action: "create",
    payload,
    status: "PENDING",
    // createdAt monotônico só ordena; o "devido" vem do relógio real, senão
    // uma rajada no mesmo ms empurraria itens novos para o futuro.
    createdAt: agoraMonotonico(),
    retryCount: 0,
    proximaTentativaEm: new Date(Date.now()).toISOString(),
  };
  // `add` (não `put`): id duplicado é erro — nunca sobrescrever um item da fila.
  await offlineDb.sync_queue.add(item);
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
  return entity
    ? offlineDb.sync_queue.where("entity").equals(entity).count()
    : offlineDb.sync_queue.count();
}

/**
 * Claim atômico do item: só transiciona PENDING → SENDING e devolve se este
 * chamador venceu. A garantia vale dentro de um ciclo: recuperarPresos() de
 * outra aba pode devolver um envio em voo a PENDING (ver recuperarPresos).
 */
export async function marcarEnviando(id: string): Promise<boolean> {
  const ganhos = await offlineDb.sync_queue
    .where("id")
    .equals(id)
    .and((i) => i.status === "PENDING")
    .modify({ status: "SENDING" });
  return ganhos > 0;
}

/** Servidor confirmou — sai da fila. */
export async function concluir(id: string): Promise<void> {
  await offlineDb.sync_queue.delete(id);
}

/**
 * Erro definitivo (validação): sai do envio automático, fica visível.
 * Só atua em item SENDING (reivindicado por este ciclo) — não atropela
 * transições concorrentes de outra aba.
 */
export async function marcarAtencao(id: string, erro: string): Promise<void> {
  await offlineDb.sync_queue
    .where("id")
    .equals(id)
    .and((i) => i.status === "SENDING")
    .modify({ status: "NEEDS_ATTENTION", lastError: erro });
}

/**
 * Erro transitório: volta a PENDING com backoff exponencial.
 * Só atua em item SENDING — nunca ressuscita NEEDS_ATTENTION nem
 * sobrescreve transições feitas por outra aba.
 */
export async function registrarFalha(id: string, erro: string): Promise<void> {
  await offlineDb.sync_queue
    .where("id")
    .equals(id)
    .and((i) => i.status === "SENDING")
    .modify((i) => {
      i.retryCount += 1;
      const espera = Math.min(
        BACKOFF_BASE_MS * 2 ** (i.retryCount - 1),
        BACKOFF_MAX_MS,
      );
      i.status = "PENDING";
      i.lastError = erro;
      i.proximaTentativaEm = new Date(Date.now() + espera).toISOString();
    });
}

/**
 * Devolve para PENDING todo item em SENDING — tanto os presos por crash/reload
 * quanto, entre abas, um envio em voo de outro ciclo (não há como distinguir).
 * Reenfileirar um envio vivo é aceitável: o id é a chave de idempotência no
 * servidor, então duplicado vira replay. Evolução futura: carimbar `claimedAt`
 * e só recuperar claims velhos (guarda de staleness).
 */
export async function recuperarPresos(): Promise<number> {
  const agora = new Date().toISOString();
  return offlineDb.sync_queue
    .where("status")
    .equals("SENDING")
    .modify({ status: "PENDING", proximaTentativaEm: agora });
}
