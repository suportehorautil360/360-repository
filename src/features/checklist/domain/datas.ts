/** Funções puras de data (sem React, sem efeitos colaterais). */

/** Carimbo do início do dia local no formato `YYYY-MM-DD`. */
export function startOfLocalDayIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Verifica se um ISO cai no mesmo dia local que `dayStamp` (`YYYY-MM-DD`). */
export function isSameLocalDay(iso: string, dayStamp: string): boolean {
  if (!iso) return false;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return false;
  return startOfLocalDayIso(t) === dayStamp;
}

/** Data por extenso em pt-BR com a primeira letra maiúscula. */
export function dataLongaPtBr(d: Date): string {
  const raw = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
