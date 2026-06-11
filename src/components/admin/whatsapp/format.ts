/** Formatadores puros do Hub WhatsApp. `agora` é injetável p/ testes. */

export function formatarDuracao(
  desdeIso: string | null,
  agora: Date = new Date(),
): string {
  if (!desdeIso) return "—";
  const ms = agora.getTime() - new Date(desdeIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  const dias = Math.floor(min / 1440);
  const horas = Math.floor((min % 1440) / 60);
  const mins = min % 60;
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${mins}min`;
  return `${mins}min`;
}

export function tempoRelativo(
  iso: string | null,
  agora: Date = new Date(),
): string {
  if (!iso) return "—";
  const ms = agora.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const seg = Math.floor(ms / 1000);
  if (seg < 60) return `há ${seg}s`;
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min}min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas}h`;
  return `há ${Math.floor(horas / 24)}d`;
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
