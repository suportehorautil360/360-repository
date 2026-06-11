import { describe, expect, it } from "vitest";
import {
  datasetCustos,
  datasetFrota,
  mapaAlocacao,
} from "./relatorios-data";
import type { Frente } from "../frentes/frentes-api";
import type { VeiculoFrota } from "../frota/types";
import type { AbastecimentoRegistro } from "../../../../lib/hu360/types";

function veic(p: Partial<VeiculoFrota>): VeiculoFrota {
  return {
    id: "v1",
    placa: "CAR-001",
    nome: "HB20",
    marca: "Hyundai",
    tipo: "carro",
    ano: 2021,
    medicaoAtual: 12000,
    intervaloRevisao: 10000,
    ultimaRevisao: 5000,
    obra: "",
    status: "ativo",
    ...p,
  };
}

const frentes: Frente[] = [
  {
    id: "wf1",
    nome: "Rodovia SP-310",
    endereco: "",
    responsavel: "",
    telefone: "",
    email: "",
    status: "Ativa",
    custo: 0,
    inicio: "",
    fim: "",
    criadoEm: "",
    equipamentos: [
      {
        allocationId: "a1",
        vehicleId: "v1",
        placa: "CAR-001",
        funcao: "Transporte",
        desde: "10/01/2026",
        nome: "HB20",
      },
    ],
  },
];

function abast(p: Partial<AbastecimentoRegistro>): AbastecimentoRegistro {
  return {
    id: "x",
    data: "01/06/2026",
    hora: "10:00",
    veiculo: "HB20",
    placa: "CAR-001",
    motorista: "João",
    secretaria: "",
    postoId: "",
    postoNome: "Posto A",
    litros: 40,
    valorTotal: "R$ 200,00",
    km: 12000,
    combustivel: "Gasolina",
    cupomFiscal: "",
    ...p,
  };
}

describe("mapaAlocacao", () => {
  it("indexa vehicleId → frente/função/desde", () => {
    const m = mapaAlocacao(frentes);
    expect(m.get("v1")).toEqual({
      frente: "Rodovia SP-310",
      funcao: "Transporte",
      desde: "10/01/2026",
    });
  });
});

describe("datasetFrota", () => {
  it("usa a frente da alocação e marca status de revisão", () => {
    const ds = datasetFrota([veic({})], mapaAlocacao(frentes));
    const [linha] = ds.linhas;
    expect(linha[0]).toBe("HB20"); // nome
    expect(linha[7]).toBe("Rodovia SP-310"); // frente (da alocação)
    expect(linha[8]).toBe("Transporte"); // função
    expect(linha[11]).toBe("Em dia"); // 12000 < 5000+10000
  });

  it("cai para 'Disponível' quando sem alocação nem obra", () => {
    const ds = datasetFrota([veic({ id: "v2" })], mapaAlocacao(frentes));
    expect(ds.linhas[0][7]).toBe("Disponível");
  });
});

describe("datasetCustos", () => {
  it("agrupa por frente+placa e soma os valores", () => {
    const ds = datasetCustos(
      [abast({}), abast({ id: "y", valorTotal: "R$ 150,00" })],
      [veic({})],
      mapaAlocacao(frentes),
    );
    expect(ds.linhas).toHaveLength(1);
    const [linha] = ds.linhas;
    expect(linha[0]).toBe("Rodovia SP-310"); // frente
    expect(linha[1]).toBe("CAR-001"); // placa
    expect(linha[2]).toBe(2); // lançamentos
    expect(linha[3]).toContain("350,00"); // total
  });
});
