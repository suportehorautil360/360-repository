/** Reabastecimentos do comboio — GET /reabastecimentos/:prefeituraId */
import { api } from "./client";

export type ReabastecimentoSourceType =
  | "gasStation"
  | "farmTank"
  | "distributor";

export interface ReabastecimentoListaApi {
  id: string;
  dateTime: string;
  sourceType: ReabastecimentoSourceType;
  receivedLiters: number;
  invoiceNumber: string;
  createdAt: string;
}

export interface CargaComboioTela {
  id: string;
  data: string;
  dataIso: string;
  litros: number;
  origem: string;
  sourceType: ReabastecimentoSourceType | null;
  notaFiscal: string;
}

const ORIGEM_POR_TIPO: Record<ReabastecimentoSourceType, string> = {
  gasStation: "Posto",
  farmTank: "Tanque fazenda",
  distributor: "Distribuidora",
};

function origemDeSourceType(
  sourceType: ReabastecimentoSourceType | undefined,
): string {
  if (!sourceType) return "—";
  return ORIGEM_POR_TIPO[sourceType] ?? "—";
}

function notaFiscalApi(invoiceNumber: string): string {
  const nf = invoiceNumber.trim();
  if (!nf) return "—";
  return /^nf\s/i.test(nf) ? nf : `NF ${nf}`;
}

function dataIsoDeItem(item: ReabastecimentoListaApi): string {
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

export function reabastecimentoListaParaTela(
  item: ReabastecimentoListaApi,
): CargaComboioTela {
  const litros = Number(item.receivedLiters);
  return {
    id: item.id,
    data: item.dateTime,
    dataIso: dataIsoDeItem(item),
    litros: Number.isFinite(litros) ? litros : 0,
    origem: origemDeSourceType(item.sourceType),
    sourceType: item.sourceType ?? null,
    notaFiscal: notaFiscalApi(item.invoiceNumber ?? ""),
  };
}

export function filtrarReabastecimentosPorPeriodo(
  itens: CargaComboioTela[],
  inicio: string,
  fim: string,
): CargaComboioTela[] {
  return itens.filter((item) => {
    if (!item.dataIso) return true;
    if (inicio && item.dataIso < inicio) return false;
    if (fim && item.dataIso > fim) return false;
    return true;
  });
}

export const reabastecimentosApi = {
  async listar(prefeituraId: string): Promise<CargaComboioTela[]> {
    const r = await api.get<{ data: ReabastecimentoListaApi[] }>(
      `/reabastecimentos/${prefeituraId}`,
    );
    return (r.data ?? []).map(reabastecimentoListaParaTela);
  },
};
