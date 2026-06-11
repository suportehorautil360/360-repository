import { describe, expect, it } from "vitest";
import { montarAlocacoes } from "./alocacao-model";
import type { Frente } from "../frentes/frentes-api";
import type { EquipRow } from "../equipamentos/equipamentos-api";

function equip(id: string, descricao: string, placa: string): EquipRow {
  return {
    id,
    descricao,
    marca: "",
    modelo: descricao,
    chassis: placa,
    placa,
    linha: "",
    tipo: "Caminhão",
    ano: "",
    obra: "",
    status: "ativo",
    medicaoAtual: 0,
    intervaloRevisao: 0,
    ultimaRevisao: 0,
    unidadeRevisao: "km",
  };
}

function frente(id: string, nome: string, equipamentos: Frente["equipamentos"]): Frente {
  return {
    id,
    nome,
    endereco: "",
    responsavel: "",
    telefone: "",
    email: "",
    status: "Ativa",
    custo: 0,
    inicio: "",
    fim: "",
    criadoEm: "",
    equipamentos,
  };
}

const equipamentos = [
  equip("v1", "Scania R450", "TRK-001"),
  equip("v2", "Komatsu PC210", "MQ-02"),
  equip("v3", "Onix", "CAR-002"),
];

const frentes = [
  frente("wf1", "Rodovia SP-310", [
    {
      allocationId: "a1",
      vehicleId: "v1",
      placa: "TRK-001",
      funcao: "Transporte",
      desde: "10/01/2026",
      nome: "Scania R450",
    },
  ]),
  frente("wf2", "Parque Verde", [
    {
      allocationId: "a2",
      vehicleId: "v2",
      placa: "MQ-02",
      funcao: "Terraplanagem",
      desde: "01/03/2026",
      nome: "Komatsu PC210",
    },
  ]),
];

describe("montarAlocacoes", () => {
  it("achata as alocações das frentes na tabela", () => {
    const { alocados } = montarAlocacoes(frentes, equipamentos);
    expect(alocados).toHaveLength(2);
    const scania = alocados.find((r) => r.vehicleId === "v1")!;
    expect(scania).toMatchObject({
      equipamento: "Scania R450",
      placa: "TRK-001",
      frenteNome: "Rodovia SP-310",
      desde: "10/01/2026",
      funcao: "Transporte",
      status: "Ativa",
    });
  });

  it("calcula os disponíveis (sem nenhuma alocação)", () => {
    const { disponiveis } = montarAlocacoes(frentes, equipamentos);
    expect(disponiveis.map((e) => e.id)).toEqual(["v3"]);
  });

  it("ordena os alocados por nome do equipamento", () => {
    const { alocados } = montarAlocacoes(frentes, equipamentos);
    expect(alocados.map((r) => r.equipamento)).toEqual([
      "Komatsu PC210",
      "Scania R450",
    ]);
  });

  it("sem frentes, todos os equipamentos ficam disponíveis", () => {
    const { alocados, disponiveis } = montarAlocacoes([], equipamentos);
    expect(alocados).toHaveLength(0);
    expect(disponiveis).toHaveLength(3);
  });
});
