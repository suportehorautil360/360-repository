/** Abastecimentos da prefeitura — módulo `abastecimentos` do back-360-. */
import { api } from "./client";

export type OrigemAbastecimento = "comboio" | "posto";
export type UnidadeLeitura = "km" | "h";

export interface Abastecimento {
  id: string;
  data: string; // YYYY-MM-DD
  hora: string;
  origem: OrigemAbastecimento;
  veiculo: string;
  placa: string;
  tipoVeiculo: string;
  combustivel: string;
  litros: number;
  /** Valor total em número (0 quando comboio). */
  valor: number;
  leitura: number; // km ou horas
  leituraUnidade: UnidadeLeitura;
  local: string;
  // Compat com consumidores atuais (dashboard, relatórios):
  km: number;
  postoNome: string;
  status: string;
}

/** Converte "R$ 1.234,56" (ou número) em número. */
function parseValor(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string") return 0;
  const limpo = v.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

function asStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function fromDoc(d: Record<string, unknown> & { id?: string }): Abastecimento {
  const origem: OrigemAbastecimento =
    d.origem === "comboio" ? "comboio" : "posto";
  const leituraUnidade: UnidadeLeitura =
    d.leituraUnidade === "h" || (origem === "comboio" && d.leituraUnidade == null)
      ? "h"
      : "km";
  const leitura = Number(d.leitura ?? d.km) || 0;
  const valor =
    origem === "comboio"
      ? 0
      : typeof d.valor === "number"
        ? d.valor
        : parseValor(d.valorTotal ?? d.valor);
  const local = asStr(d.local ?? d.postoNome);
  return {
    id: asStr(d.id),
    data: asStr(d.data),
    hora: asStr(d.hora),
    origem,
    veiculo: asStr(d.veiculo),
    placa: asStr(d.placa),
    tipoVeiculo: asStr(d.tipoVeiculo ?? d.tipo),
    combustivel: asStr(d.combustivel) || "—",
    litros: Number(d.litros) || 0,
    valor,
    leitura,
    leituraUnidade,
    local,
    km: leituraUnidade === "km" ? leitura : 0,
    postoNome: asStr(d.postoNome ?? local),
    status: asStr(d.status).toLowerCase(),
  };
}

export const abastecimentosApi = {
  async listar(prefeituraId: string): Promise<Abastecimento[]> {
    const r = await api.get<{
      data: (Record<string, unknown> & { id?: string })[];
    }>(`/abastecimentos/${prefeituraId}`);
    return (r.data ?? [])
      .map(fromDoc)
      .sort((a, b) => b.data.localeCompare(a.data));
  },
};
