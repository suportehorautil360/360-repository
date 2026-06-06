import type { Abastecimento } from "@/lib/api/abastecimentos";
import type { Dataset } from "@/lib/export/export-utils";

export type FiltroOrigem = "todas" | "comboio" | "posto";

/** Filtra por origem (aba) e por busca (placa ou veículo, case-insensitive). */
export function filtrarAbastecimentos(
  rows: Abastecimento[],
  origem: FiltroOrigem,
  busca: string,
): Abastecimento[] {
  const q = busca.trim().toLowerCase();
  return rows.filter((r) => {
    if (origem !== "todas" && r.origem !== origem) return false;
    if (!q) return true;
    return (
      r.placa.toLowerCase().includes(q) || r.veiculo.toLowerCase().includes(q)
    );
  });
}

/** Monta o dataset para exportação CSV (comboio sem valor). */
export function abastecimentosParaCSV(rows: Abastecimento[]): Dataset {
  return {
    colunas: [
      "Data",
      "Hora",
      "Veículo",
      "Placa",
      "Tipo",
      "Origem",
      "Litros",
      "Valor (R$)",
      "Leitura",
      "Unidade",
      "Local",
    ],
    linhas: rows.map((r) => [
      r.data,
      r.hora,
      r.veiculo,
      r.placa,
      r.tipoVeiculo,
      r.origem === "comboio" ? "Comboio" : "Posto",
      r.litros,
      r.origem === "comboio" ? "" : r.valor,
      r.leitura,
      r.leituraUnidade,
      r.local,
    ]),
  };
}
