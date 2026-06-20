/**
 * Migração única: aparelhos em campo podem ter batidas pendentes na fila
 * legada (localStorage `hu360-ponto-fila`). No primeiro boot da versão nova,
 * importamos tudo para o outbox e removemos a chave — sem perda e sem
 * duplicata (id determinístico por conteúdo tolera boot interrompido).
 */
import type { BaterPontoInput } from "../api/pontos";
import { enfileirar } from "./outbox";

const CHAVE_LEGADA = "hu360-ponto-fila";

/**
 * Id determinístico por conteúdo: reexecutar a migração (boot interrompido)
 * gera os MESMOS ids, então o `add` do outbox rejeita o duplicado local e,
 * no servidor, a mesma Idempotency-Key vira replay — nunca batida dupla.
 */
async function idDeterministico(batida: BaterPontoInput): Promise<string> {
  const dados = new TextEncoder().encode(JSON.stringify(batida));
  const hash = await crypto.subtle.digest("SHA-256", dados);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `mig-ponto-${hex.slice(0, 40)}`;
}

/** Remove a chave legada; sem acesso ao storage, tenta de novo no próximo boot. */
function removerChaveLegada(): void {
  try {
    localStorage.removeItem(CHAVE_LEGADA);
  } catch {
    /* sem acesso ao storage — tenta de novo no próximo boot */
  }
}

/**
 * Lê e parseia a fila legada; null se ausente, corrompida ou se o JSON não
 * for um array (ex.: `"abc"` é iterável e viraria um item por caractere!).
 * Chave corrompida/não-array seria reparseada para sempre — remove já.
 */
function lerFilaLegada(): BaterPontoInput[] | null {
  try {
    const raw = localStorage.getItem(CHAVE_LEGADA);
    if (!raw) return null;
    const fila = JSON.parse(raw) as unknown;
    if (Array.isArray(fila)) return fila as BaterPontoInput[];
  } catch {
    /* corrompida (ou storage inacessível) — cai na remoção abaixo */
  }
  removerChaveLegada();
  return null;
}

/** Importa a fila legada para o outbox. Retorna quantas batidas entraram NESTA execução. */
export async function migrarFilaLegadaPonto(): Promise<number> {
  const fila = lerFilaLegada();
  if (!fila) return 0;
  let importadas = 0;
  for (const batida of fila) {
    try {
      await enfileirar("ponto", batida, await idDeterministico(batida));
      importadas += 1;
    } catch (e) {
      // Duplicado (Dexie `add` com id já existente): batida já importada num
      // boot anterior interrompido — segue sem contar.
      if ((e as Error).name !== "ConstraintError") throw e; // chave fica; retry no próximo boot
    }
  }
  removerChaveLegada();
  return importadas;
}
