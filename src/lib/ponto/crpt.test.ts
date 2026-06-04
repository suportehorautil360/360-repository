import { describe, expect, it } from "vitest";
import { montarCRPT, podeEmitirCRPT } from "./crpt";
import type { PontoRegistro } from "../api/pontos";

const registro: PontoRegistro = {
  id: "r1",
  name: "João da Silva",
  prefeituraId: "p1",
  tipo: "entrada",
  timestampOriginal: "2026-05-25T13:05:00.000Z", // 10:05 em São Paulo
  registro: "original",
  nsr: 42,
  hash: "a".repeat(64),
  cpf: "12345678901",
};

const empresa = {
  razaoSocial: "Transportes ABC Ltda.",
  cnpj: "12.345.678/0001-90",
  caepf: "",
  cidade: "Três Lagoas",
  estado: "MS",
  emailAlertas: "x@y.com",
};

describe("montarCRPT", () => {
  it("preenche empregador, trabalhador, marcação, NSR e hash", () => {
    const c = montarCRPT(registro, empresa);
    expect(c.empregador.razaoSocial).toBe("Transportes ABC Ltda.");
    expect(c.empregador.cnpj).toBe("12.345.678/0001-90");
    expect(c.empregador.municipio).toBe("Três Lagoas / MS");
    expect(c.trabalhador.nome).toBe("João da Silva");
    expect(c.trabalhador.cpf).toBe("123.456.789-01");
    expect(c.marcacao.tipo).toBe("Entrada");
    expect(c.marcacao.data).toBe("25/05/2026");
    expect(c.marcacao.hora).toBe("10:05:00");
    expect(c.nsr).toBe("42");
    expect(c.hash).toBe("a".repeat(64));
    expect(c.repP).toContain("REP-P");
  });

  it("não quebra sem empresa nem CPF (mostra 'Não informado')", () => {
    const semDados: PontoRegistro = { ...registro, cpf: null };
    const c = montarCRPT(semDados, null);
    expect(c.empregador.razaoSocial).toBe("Não informado");
    expect(c.empregador.cnpj).toBe("Não informado");
    expect(c.empregador.municipio).toBe("Não informado");
    expect(c.trabalhador.cpf).toBe("Não informado");
  });

  it("usa CAEPF quando não há CNPJ", () => {
    const c = montarCRPT(registro, {
      ...empresa,
      cnpj: "",
      caepf: "12.345.678/901",
    });
    expect(c.empregador.cnpj).toBe("12.345.678/901");
  });

  it("podeEmitirCRPT exige NSR e hash (batida selada)", () => {
    expect(podeEmitirCRPT(registro)).toBe(true);
    expect(podeEmitirCRPT({ nsr: undefined, hash: "x" })).toBe(false);
    expect(podeEmitirCRPT({ nsr: 1, hash: undefined })).toBe(false);
  });
});
