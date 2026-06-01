/** Abastecimentos da prefeitura — módulo `abastecimentos` do back-360-. */
import { api } from "./client";

export interface Abastecimento {
  id: string;
  data: string; // YYYY-MM-DD
  veiculo: string;
  placa: string;
  combustivel: string;
  litros: number;
  /** Valor total em número (parseado de valorTotal "R$ x"). */
  valor: number;
  status: string;
  km: number;
  postoNome: string;
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
  return {
    id: asStr(d.id),
    data: asStr(d.data),
    veiculo: asStr(d.veiculo),
    placa: asStr(d.placa),
    combustivel: asStr(d.combustivel) || "—",
    litros: Number(d.litros) || 0,
    valor: parseValor(d.valorTotal ?? d.valor),
    status: asStr(d.status).toLowerCase(),
    km: Number(d.km) || 0,
    postoNome: asStr(d.postoNome),
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
