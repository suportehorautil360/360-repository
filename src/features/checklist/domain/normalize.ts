/** Normalização de chassi e modelo para comparação (funções puras). */

/** Remove espaços e deixa em maiúsculas (ex.: comparar chassis). */
export function normalizeChassis(s: string): string {
  return s.replace(/\s+/g, "").toUpperCase();
}

/** Colapsa espaços e deixa em minúsculas (ex.: comparar modelos). */
export function normalizeModelo(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}
