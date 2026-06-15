/**
 * Fila offline de batidas de ponto — agora sobre o outbox (IndexedDB), com
 * chave de idempotência: o id nasce no aparelho ANTES do primeiro envio, e o
 * retry usa a mesma chave, então o servidor nunca duplica (Portaria 671).
 * A fila legada em localStorage é migrada no primeiro uso.
 */
import { ApiError } from "./client";
import { pontosApi, type BaterPontoInput, type PontoRegistro } from "./pontos";
import type { ItemOutbox } from "../offline/db";
import { contarPendentes, enfileirar } from "../offline/outbox";
import { erroDefinitivo, processarFila, registrarEnviador } from "../offline/motor";
import { migrarFilaLegadaPonto } from "../offline/migrar-fila-ponto";

const ENTIDADE = "ponto";

registrarEnviador(ENTIDADE, async (item: ItemOutbox) => {
  await pontosApi.bater(item.payload as BaterPontoInput, item.id);
});

// Serializa migrações concorrentes; re-checa a cada uso (getItem nulo é
// barato) — a migração é idempotente, então repetir não duplica.
let migracao: Promise<number> | null = null;
function garantirMigracao(): Promise<number> {
  migracao ??= migrarFilaLegadaPonto()
    .catch(() => 0)
    .finally(() => {
      migracao = null;
    });
  return migracao;
}

function offline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export async function pendentes(): Promise<number> {
  await garantirMigracao();
  return contarPendentes(ENTIDADE);
}

/**
 * Bate o ponto; se offline/sem rede, enfileira para sincronizar depois.
 * Quando sincroniza na hora, devolve o `registro` selado pelo servidor
 * (NSR + hash) — necessário para emitir o CRPT. Offline não tem NSR ainda.
 */
export async function baterComFila(
  input: BaterPontoInput,
): Promise<{ sincronizado: boolean; registro?: PontoRegistro }> {
  await garantirMigracao();
  const id = crypto.randomUUID();
  if (offline()) {
    await enfileirar(ENTIDADE, input, id);
    return { sincronizado: false };
  }
  try {
    const registro = await pontosApi.bater(input, id);
    return { sincronizado: true, registro };
  } catch (e) {
    // 4xx de validação é erro do usuário — propaga para a tela.
    if (e instanceof ApiError && erroDefinitivo(e)) throw e;
    // Falha de rede ou 5xx/408/429: o servidor PODE ter gravado — enfileira
    // com a MESMA chave; se gravou, o reenvio vira replay, não duplica.
    await enfileirar(ENTIDADE, input, id);
    return { sincronizado: false };
  }
}

/** Tenta reenviar a fila. Retorna quantas batidas foram sincronizadas. */
export async function sincronizar(): Promise<number> {
  await garantirMigracao();
  const r = await processarFila();
  return r.enviados;
}
