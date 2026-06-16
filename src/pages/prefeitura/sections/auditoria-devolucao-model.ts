export interface OrdemDevolucaoRaw {
  id: string;
  protocolo: string;
  solicitacaoOsId: string | null;
  equipamento: string;
  defeito: string;
  oficinaNome?: string;
  oficinaId?: string;
  valorTotal: number;
  status: string;
  criadoEm: { seconds: number } | null;
}

export interface SolicitacaoOsRaw {
  id: string;
  protocolo: string;
  linha: string;
  equipamento: string;
}

export interface LinhaAuditoriaDevolucao {
  osId: string;
  equipamento: string;
  classificacao: string;
  protocolo: string;
  oficina: string;
  defeito: string;
  valor: number;
  dataIso: string;
  status: string;
}

export const STATUS_OS_OPCOES = [
  { value: "todos", label: "Todos" },
  { value: "aprovado", label: "Aprovado" },
  { value: "aguardando_orcamento", label: "Aguardando Orçamento" },
  { value: "concluido", label: "Concluído" },
] as const;

const STATUS_LABEL_EXTRA: Record<string, string> = {
  aguardando_aprovacao: "Aguardando aprovação",
  recusado: "Recusado",
};

export function labelStatusOs(status: string): string {
  return (
    STATUS_OS_OPCOES.find((s) => s.value === status)?.label ??
    STATUS_LABEL_EXTRA[status] ??
    status.replace(/_/g, " ")
  );
}

export const FORMATO_OPCOES = [
  { value: "csv", label: "CSV (Excel)" },
] as const;

export function fmtDataBr(iso: string): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function timestampParaIso(ts: { seconds: number } | null): string {
  if (!ts?.seconds) return "";
  const d = new Date(ts.seconds * 1000);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function montarLinhasAuditoria(
  ordens: OrdemDevolucaoRaw[],
  solicitacoes: SolicitacaoOsRaw[],
): LinhaAuditoriaDevolucao[] {
  const solPorId = new Map(solicitacoes.map((s) => [s.id, s]));

  return ordens
    .map((o) => {
      const sol = o.solicitacaoOsId
        ? solPorId.get(o.solicitacaoOsId)
        : undefined;
      return {
        osId: o.id,
        equipamento: o.equipamento || sol?.equipamento || "—",
        classificacao: sol?.linha?.trim() || "—",
        protocolo: o.protocolo || sol?.protocolo || "—",
        oficina: o.oficinaNome?.trim() || "—",
        defeito: o.defeito?.trim() || "—",
        valor: Number(o.valorTotal) || 0,
        dataIso: timestampParaIso(o.criadoEm),
        status: o.status,
      };
    })
    .sort((a, b) => b.dataIso.localeCompare(a.dataIso));
}

export interface FiltrosAuditoriaDevolucao {
  dataInicio: string;
  dataFim: string;
  oficinaId: string;
  equipamento: string;
  statusOs: string;
}

export function filtrarLinhasAuditoria(
  linhas: LinhaAuditoriaDevolucao[],
  filtros: FiltrosAuditoriaDevolucao,
): LinhaAuditoriaDevolucao[] {
  return linhas.filter((r) => {
    if (filtros.dataInicio && r.dataIso && r.dataIso < filtros.dataInicio) {
      return false;
    }
    if (filtros.dataFim && r.dataIso && r.dataIso > filtros.dataFim) {
      return false;
    }
    if (
      filtros.equipamento &&
      filtros.equipamento !== "todos" &&
      r.equipamento !== filtros.equipamento
    ) {
      return false;
    }
    if (
      filtros.statusOs &&
      filtros.statusOs !== "todos" &&
      r.status !== filtros.statusOs
    ) {
      return false;
    }
    return true;
  });
}

export function filtrarPorOficina(
  linhas: LinhaAuditoriaDevolucao[],
  ordens: OrdemDevolucaoRaw[],
  oficinaId: string,
): LinhaAuditoriaDevolucao[] {
  if (!oficinaId || oficinaId === "todas") return linhas;
  const ids = new Set(
    ordens.filter((o) => o.oficinaId === oficinaId).map((o) => o.id),
  );
  return linhas.filter((r) => ids.has(r.osId));
}

export function linhasParaCsv(linhas: LinhaAuditoriaDevolucao[]) {
  return {
    colunas: [
      "OS",
      "Equipamento",
      "Classificação",
      "Protocolo",
      "Oficina",
      "Defeito",
      "Valor",
      "Data",
      "Status",
    ],
    linhas: linhas.map((r) => [
      r.protocolo,
      r.equipamento,
      r.classificacao,
      r.protocolo,
      r.oficina,
      r.defeito,
      fmtBRL(r.valor),
      fmtDataBr(r.dataIso),
      labelStatusOs(r.status),
    ]),
  };
}
