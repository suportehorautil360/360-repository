/** Postos da prefeitura — GET /postos/:prefeituraId */
import { api } from "./client";

export interface PostoListaApi {
  id: string;
  code: string;
  name: string;
  endereco: string;
  precoPorLitro: number | null;
  precoPorLitroLabel: string;
  abastecimentos: number;
  totalLitros: number;
  totalLitrosLabel: string;
  totalGasto: number;
  totalGastoLabel: string;
  createdAt?: string;
}

export interface PostoTela {
  id: string;
  nome: string;
  codigo: string;
  endereco: string;
  precoLitroLabel: string;
  abastecimentos: number;
  litrosLabel: string;
  gastoLabel: string;
  totalGasto: number;
  totalLitros: number;
}

function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function postoListaParaTela(item: PostoListaApi): PostoTela {
  const totalLitros = Number(item.totalLitros) || 0;
  const totalGasto = Number(item.totalGasto) || 0;

  return {
    id: item.id,
    nome: item.name,
    codigo: item.code,
    endereco: item.endereco,
    precoLitroLabel: item.precoPorLitroLabel?.trim() || "—",
    abastecimentos: Number(item.abastecimentos) || 0,
    litrosLabel: item.totalLitrosLabel?.trim() || `${totalLitros} L`,
    gastoLabel: item.totalGastoLabel?.trim() || fmtMoeda(totalGasto),
    totalGasto,
    totalLitros,
  };
}

export function calcularKpisPostos(postos: PostoTela[]) {
  return {
    totalPostos: postos.length,
    totalAbastecimentos: postos.reduce((s, p) => s + p.abastecimentos, 0),
    totalGasto: postos.reduce((s, p) => s + p.totalGasto, 0),
  };
}

export const postosApi = {
  async listar(prefeituraId: string): Promise<PostoTela[]> {
    const r = await api.get<{ data: PostoListaApi[] }>(
      `/postos/${prefeituraId}`,
    );
    return (r.data ?? []).map(postoListaParaTela);
  },
};
