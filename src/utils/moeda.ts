/**
 * Helpers canônicos de moeda BRL — fonte única para formatação e parsing.
 * Alvo da issue #18 (unificar fmtBRL/parseValorBR espalhados pelas telas).
 */

/** Número (reais) → "R$ 1.234,56". */
export function formatBRL(reais: number): string {
  return (reais || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Texto com moeda (ex.: "R$ 1.234,56") → número em reais. 0 quando inválido. */
export function parseValorBR(valor: string): number {
  if (!valor) return 0;
  const limpo = valor
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

/** Só os dígitos de um texto, interpretados como centavos. */
export function digitosParaCentavos(raw: string): number {
  const d = raw.replace(/\D/g, "");
  return d ? parseInt(d, 10) : 0;
}
