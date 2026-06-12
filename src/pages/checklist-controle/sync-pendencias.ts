/**
 * Contador de registros salvos offline e ainda não confirmados pelo servidor
 * (checklists e emergências). Eles são escritos pelo SDK do Firestore, que
 * enfileira no IndexedDB e sincroniza sozinho — mas não expõe uma contagem.
 * Mantemos a nossa, para o operador VER que nada se perdeu.
 *
 * Reconciliação: a escrita confirmada chama removerPendente; ao reabrir o app,
 * waitForPendingWrites do SDK confirma o lote e o hook limpa os ids que
 * estavam pendentes (ver useSyncPendencias).
 */
const KEY = "hu360-sync-pendentes";
const EVENTO = "hu360-sync-pendencias";

export type TipoPendencia = "checklist" | "emergencia";
export type Pendencia = { id: string; tipo: TipoPendencia; ts: string };

export function lerPendentes(): Pendencia[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Pendencia[]) : [];
  } catch {
    return [];
  }
}

function gravar(lista: Pendencia[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lista));
  } catch {
    /* cota cheia — o contador some, mas o dado já está na fila do SDK */
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function contarPendentes(): number {
  return lerPendentes().length;
}

export function marcarPendente(id: string, tipo: TipoPendencia): void {
  const atual = lerPendentes();
  if (atual.some((p) => p.id === id)) return;
  gravar([...atual, { id, tipo, ts: new Date().toISOString() }]);
}

export function removerPendente(id: string): void {
  gravar(lerPendentes().filter((p) => p.id !== id));
}

export function removerVarios(ids: string[]): void {
  const set = new Set(ids);
  gravar(lerPendentes().filter((p) => !set.has(p.id)));
}
