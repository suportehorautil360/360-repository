import { describe, expect, it } from "vitest";
import {
  filtrarOficinasElegiveis,
  oficinaAtendeSegmento,
  resolveSegmentoEquipamento,
  type OficinaDirecionamento,
} from "./direcionamento-os";
import type { EquipRow } from "./equipamentos/equipamentos-api";

const eqBase: EquipRow = {
  id: "1",
  descricao: "Escavadeira CAT",
  marca: "Caterpillar",
  modelo: "320",
  chassis: "",
  placa: "",
  linha: "Linha Amarela",
  tipo: "Escavadeira",
  ano: "",
  obra: "",
  status: "ativo",
  medicaoAtual: 1000,
  intervaloRevisao: 500,
  ultimaRevisao: 500,
  unidadeRevisao: "h",
};

const oficinas: OficinaDirecionamento[] = [
  { id: "1", nome: "A", especialidade: "Amarela" },
  {
    id: "2",
    nome: "B",
    especialidade: "Amarela",
    segmentosAtuacao: ["Máquinas linha amarela"],
  },
  {
    id: "3",
    nome: "C",
    especialidade: "Amarela",
    segmentosAtuacao: ["Carro leve"],
  },
];

describe("resolveSegmentoEquipamento", () => {
  it("identifica máquinas linha amarela", () => {
    expect(resolveSegmentoEquipamento(eqBase)).toBe("Máquinas linha amarela");
  });
});

describe("filtrarOficinasElegiveis", () => {
  it("filtra por segmento e linha sem fallback", () => {
    const result = filtrarOficinasElegiveis(
      oficinas,
      "Linha Amarela",
      "Máquinas linha amarela",
    );
    expect(result.map((o) => o.id)).toEqual(["2"]);
  });

  it("deriva linha a partir do segmento quando linhas não cadastradas", () => {
    const result = filtrarOficinasElegiveis(
      [
        {
          id: "4",
          nome: "D",
          especialidade: "Amarela",
          segmentosAtuacao: ["Máquinas linha amarela"],
        },
      ],
      "Linha Amarela",
      "Máquinas linha amarela",
    );
    expect(result.map((o) => o.id)).toEqual(["4"]);
  });

  it("retorna vazio quando linha não combina", () => {
    expect(filtrarOficinasElegiveis(oficinas, "Linha Verde")).toEqual([]);
  });
});

describe("oficinaAtendeSegmento", () => {
  it("rejeita oficina legada sem segmentos quando equipamento tem segmento", () => {
    expect(oficinaAtendeSegmento([], "Carro leve")).toBe(false);
  });
});
