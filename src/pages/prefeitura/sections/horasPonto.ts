/** Cálculo de horas trabalhadas/previstas a partir das batidas e da escala. */
import type { PontoRegistro, TipoPonto } from "../../../lib/api/pontos";
import type { Escala } from "../../../lib/api/escala";

function horaParaMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Minuto local do dia (0–1439) de um ISO. */
function minutoLocal(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Minutos trabalhados no dia: manhã (entrada→almoço) + tarde (volta→saída).
 * Sem as marcas de almoço, usa entrada→saída menos o almoço da escala.
 */
export function minutosTrabalhados(
  batidasDia: PontoRegistro[],
  almocoMinutos: number,
): number {
  const t: Partial<Record<TipoPonto, number>> = {};
  for (const b of batidasDia) t[b.tipo] = minutoLocal(b.timestampOriginal);
  const { entrada, almoco, volta, saida } = t;

  if (entrada != null && almoco != null && volta != null && saida != null) {
    return Math.max(0, almoco - entrada + (saida - volta));
  }
  if (entrada != null && saida != null) {
    return Math.max(0, saida - entrada - almocoMinutos);
  }
  return 0;
}

/** Minutos previstos para o dia, conforme a escala (0 se não for dia útil). */
export function minutosPrevistos(escala: Escala | null, diaIso: string): number {
  if (!escala) return 0;
  const dow = new Date(`${diaIso}T12:00:00`).getDay();
  if (!escala.diasSemana.includes(dow)) return 0;
  return Math.max(
    0,
    horaParaMin(escala.fim) - horaParaMin(escala.inicio) - escala.almocoMinutos,
  );
}

/** Formata minutos como "HH:MM" (com sinal para negativos). */
export function fmtMin(min: number): string {
  const sinal = min < 0 ? "-" : "";
  const abs = Math.abs(Math.round(min));
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `${sinal}${h}:${m}`;
}
