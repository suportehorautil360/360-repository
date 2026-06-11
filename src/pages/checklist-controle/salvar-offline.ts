/**
 * Helpers do fluxo de salvamento offline do checklist do operador.
 *
 * O save do checklist precisa sobreviver a três cenários de campo:
 * - localStorage cheio (históricos com foto base64 estouram a cota de ~5MB);
 * - sem rede: a promise de escrita do Firestore só resolve com ack do
 *   servidor, então aguardá-la trava a UI em "Salvando..." para sempre;
 * - documento acima do limite de 1 MiB do Firestore, que é rejeitado em
 *   silêncio na sincronização posterior.
 */

/**
 * Grava o histórico local podando para `max` entradas e, se a cota do
 * localStorage estourar, reduz pela metade até caber. Nunca lança: o
 * histórico local é conveniência, não pode abortar o save real.
 */
export function salvarHistoricoLocal(
  key: string,
  rows: unknown[],
  max = 20,
): void {
  let lista = rows.slice(0, max);
  for (;;) {
    try {
      localStorage.setItem(key, JSON.stringify(lista));
      return;
    } catch {
      if (lista.length <= 1) return;
      lista = lista.slice(0, Math.ceil(lista.length / 2));
    }
  }
}

/**
 * Espera o ack do servidor para uma escrita do Firestore, sem nunca travar a
 * UI: offline devolve "pendente" na hora (a mutação já está persistida no
 * IndexedDB e sincroniza sozinha); online aguarda no máximo `timeoutMs`.
 * Rejeição da escrita (ex.: security rules) é propagada.
 */
export function esperarAckComTimeout(
  escrita: Promise<unknown>,
  online: boolean,
  timeoutMs: number,
): Promise<"sincronizado" | "pendente"> {
  if (!online) return Promise.resolve("pendente");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve("pendente"), timeoutMs);
    escrita.then(
      () => {
        clearTimeout(timer);
        resolve("sincronizado");
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Tamanho aproximado (bytes UTF-8 do JSON) que o doc ocupará no Firestore. */
export function tamanhoDocBytes(payload: unknown): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

/**
 * Tenta o `encode` (ex.: canvas.toDataURL com qualidade decrescente) até o
 * resultado caber no orçamento de bytes. Devolve null se nem a menor
 * qualidade couber — o chamador decide bloquear ou pedir nova captura.
 */
export function comprimirAteOrcamento(
  encode: (qualidade: number) => string,
  orcamentoBytes: number,
  qualidades: number[] = [0.7, 0.55, 0.4],
): string | null {
  for (const q of qualidades) {
    const resultado = encode(q);
    if (resultado.length <= orcamentoBytes) return resultado;
  }
  return null;
}
