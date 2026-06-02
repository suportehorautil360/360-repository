/**
 * Modelo de apresentação da tela de Alocação. Funções puras (sem rede),
 * derivadas das frentes (com suas alocações) e da lista de equipamentos.
 */
import type { Frente } from "../frentes/frentes-api";
import type { EquipRow } from "../equipamentos/equipamentos-api";

export interface AlocacaoRow {
  allocationId: string;
  vehicleId: string;
  equipamento: string;
  placa: string;
  tipo: string;
  frenteNome: string;
  desde: string;
  funcao: string;
  status: string;
}

export interface AlocacaoView {
  alocados: AlocacaoRow[];
  disponiveis: EquipRow[];
}

/**
 * Achata as alocações de todas as frentes numa tabela e calcula os
 * equipamentos disponíveis (sem nenhuma alocação ativa).
 */
export function montarAlocacoes(
  frentes: Frente[],
  equipamentos: EquipRow[],
): AlocacaoView {
  const eqPorId = new Map(equipamentos.map((e) => [e.id, e]));
  const alocadosIds = new Set<string>();
  const alocados: AlocacaoRow[] = [];

  for (const frente of frentes) {
    for (const al of frente.equipamentos) {
      alocadosIds.add(al.vehicleId);
      const eq = eqPorId.get(al.vehicleId);
      alocados.push({
        allocationId: al.allocationId,
        vehicleId: al.vehicleId,
        equipamento: eq?.descricao || al.nome,
        placa: al.placa || eq?.placa || "—",
        tipo: eq?.tipo ?? "",
        frenteNome: frente.nome,
        desde: al.desde || "—",
        funcao: al.funcao || "—",
        status: "Ativa",
      });
    }
  }

  alocados.sort((a, b) => a.equipamento.localeCompare(b.equipamento, "pt-BR"));

  const disponiveis = equipamentos
    .filter((e) => !alocadosIds.has(e.id))
    .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));

  return { alocados, disponiveis };
}
