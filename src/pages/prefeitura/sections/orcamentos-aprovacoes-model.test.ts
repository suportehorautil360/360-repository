import { describe, expect, it } from "vitest";
import {
  podeAprovarOrcamento,
  prontoParaAprovar,
  type OrdemOrcamento,
  type SolicitacaoOrcamento,
} from "./orcamentos-aprovacoes-model";

const solBase: SolicitacaoOrcamento = {
  id: "sol-1",
  protocolo: "OS-1",
  equipamento: "Eq",
  linha: "Geral",
  operador: "Op",
  relato: "x",
  status: "em_orcamento",
  criadoEm: null,
};

const ordBase: OrdemOrcamento = {
  id: "ord-1",
  protocolo: "ORC-1",
  solicitacaoOsId: "sol-1",
  operador: "Oficina A",
  equipamento: "Eq",
  defeito: "x",
  itens: [],
  valorTotal: 100,
  status: "em_pregao",
  criadoEm: null,
};

describe("podeAprovarOrcamento", () => {
  it("permite em_pregao enquanto O.S. não está aprovada", () => {
    expect(podeAprovarOrcamento(solBase, ordBase)).toBe(true);
  });

  it("bloqueia se O.S. já aprovada", () => {
    expect(
      podeAprovarOrcamento({ ...solBase, status: "aprovado" }, ordBase),
    ).toBe(false);
  });

  it("bloqueia orçamento já recusado", () => {
    expect(
      podeAprovarOrcamento(solBase, { ...ordBase, status: "recusado" }),
    ).toBe(false);
  });
});

describe("prontoParaAprovar", () => {
  it("detecta card com orçamento em pregão", () => {
    expect(prontoParaAprovar(solBase, [ordBase])).toBe(true);
  });
});
