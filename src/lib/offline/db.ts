/**
 * Banco offline do operador (IndexedDB via Dexie) — spec offline-outbox
 * (docs/superpowers/specs/2026-06-12-offline-outbox-design.md).
 * `sync_queue` guarda toda escrita feita no campo até o servidor confirmar.
 * Item confirmado é removido (não existe status SYNCED persistido).
 */
import Dexie, { type Table } from "dexie";

export type StatusOutbox = "PENDING" | "SENDING" | "NEEDS_ATTENTION";

export interface ItemOutbox {
  /** uuid gerado no aparelho — vai ao servidor como Idempotency-Key. */
  id: string;
  entity: string;
  action: "create";
  payload: unknown;
  status: StatusOutbox;
  createdAt: string;
  retryCount: number;
  /** Instante a partir do qual pode tentar de novo (backoff exponencial). */
  proximaTentativaEm: string;
  lastError?: string;
}

class OfflineDb extends Dexie {
  sync_queue!: Table<ItemOutbox, string>;

  constructor() {
    super("hu360-offline");
    this.version(1).stores({
      sync_queue: "id, status, entity, createdAt",
    });
  }
}

export const offlineDb = new OfflineDb();
