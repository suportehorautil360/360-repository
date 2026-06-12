/**
 * Migração única: aparelhos em campo podem ter batidas pendentes na fila
 * legada (localStorage `hu360-ponto-fila`). No primeiro boot da versão nova,
 * importamos tudo para o outbox e removemos a chave — sem perda.
 */
import type { BaterPontoInput } from "../api/pontos";
import { enfileirar } from "./outbox";

const CHAVE_LEGADA = "hu360-ponto-fila";

/** Lê e parseia a fila legada; null se ausente ou corrompida. */
function lerFilaLegada(): BaterPontoInput[] | null {
  try {
    const raw = localStorage.getItem(CHAVE_LEGADA);
    if (!raw) return null;
    return JSON.parse(raw) as BaterPontoInput[];
  } catch {
    return null;
  }
}

export async function migrarFilaLegadaPonto(): Promise<number> {
  const fila = lerFilaLegada();
  if (!fila) return 0;
  for (const batida of fila) {
    await enfileirar("ponto", batida);
  }
  try {
    localStorage.removeItem(CHAVE_LEGADA);
  } catch {
    /* sem acesso ao storage — tenta de novo no próximo boot */
  }
  return fila.length;
}
