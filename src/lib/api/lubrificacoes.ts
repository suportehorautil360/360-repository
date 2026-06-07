/** Lubrificações da prefeitura — módulo `lubrificacoes` do back-360-. */
import { api } from "./client";

/** Item bruto retornado pelo GET /lubrificacoes/:prefeituraId */
export interface LubrificacaoListaApi {
  id: string;
  dateTime: string;
  equipment?: {
    name: string;
    plate: string;
    type?: string;
  };
  vehicle?: {
    name: string;
    plate: string;
    type?: string;
  };
  reading: string;
  greasedPoints?: string[];
  points?: string[];
  pontosEngraxados?: string[];
  operator?: string;
  operatorName?: string;
  comboista?: string;
  createdAt?: string;
}

/** Registro normalizado para a tela de lubrificação. */
export interface LubrificacaoTela {
  id: string;
  data: string;
  equipamento: string;
  identificacao: string;
  leitura: string;
  pontos: string[];
  comboista: string;
  /** YYYY-MM-DD para filtro por período na UI. */
  dataIso: string;
}

function asStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function equipamentoApi(item: LubrificacaoListaApi) {
  return item.equipment ?? item.vehicle;
}

function pontosApi(item: LubrificacaoListaApi): string[] {
  const lista =
    item.greasedPoints ?? item.pontosEngraxados ?? item.points ?? [];
  return Array.isArray(lista) ? lista.map((p) => asStr(p)).filter(Boolean) : [];
}

function comboistaApi(item: LubrificacaoListaApi): string {
  return asStr(item.operator ?? item.operatorName ?? item.comboista) || "—";
}

function dataIsoDeItem(item: LubrificacaoListaApi): string {
  if (item.createdAt) {
    const d = new Date(item.createdAt);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  const m = item.dateTime.match(/^(\d{2})\/(\d{2})/);
  if (!m) return "";
  const ano = new Date().getFullYear();
  return `${ano}-${m[2]}-${m[1]}`;
}

export function lubrificacaoListaParaTela(
  item: LubrificacaoListaApi,
): LubrificacaoTela {
  const eq = equipamentoApi(item);
  return {
    id: item.id,
    data: item.dateTime,
    equipamento: asStr(eq?.name) || "—",
    identificacao: asStr(eq?.plate) || "—",
    leitura: asStr(item.reading) || "—",
    pontos: pontosApi(item),
    comboista: comboistaApi(item),
    dataIso: dataIsoDeItem(item),
  };
}

export function filtrarLubrificacoesPorPeriodo(
  itens: LubrificacaoTela[],
  inicio: string,
  fim: string,
): LubrificacaoTela[] {
  return itens.filter((item) => {
    if (!item.dataIso) return true;
    if (inicio && item.dataIso < inicio) return false;
    if (fim && item.dataIso > fim) return false;
    return true;
  });
}

export const lubrificacoesApi = {
  async listar(prefeituraId: string): Promise<LubrificacaoTela[]> {
    const r = await api.get<{ data: LubrificacaoListaApi[] }>(
      `/lubrificacoes/${prefeituraId}`,
    );
    return (r.data ?? []).map(lubrificacaoListaParaTela);
  },
};
