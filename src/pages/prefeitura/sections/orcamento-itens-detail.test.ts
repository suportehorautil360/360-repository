import { describe, expect, it } from "vitest";
import {
  calcularSubtotaisOrcamento,
  resolverSecoesOrcamento,
} from "./orcamento-itens-detail";
import type { ItemOrdemOrcamento } from "./orcamentos-aprovacoes-model";

describe("resolverSecoesOrcamento", () => {
  it("separa peças, serviços e deslocamento", () => {
    const itens: ItemOrdemOrcamento[] = [
      {
        descricao: "TESTE DE OS",
        valor: 150,
        category: "part",
        codigo: "HONDA",
        marca: "1",
        quantidade: 3,
        valorUnitario: 50,
      },
      {
        descricao: "VOU RESOLVER",
        valor: 240,
        category: "service",
        tipoHora: "normal",
        horas: 8,
        valorHora: 30,
      },
      {
        descricao: "Deslocamento",
        valor: 0,
        category: "travel",
        km: 0,
        valorPorKm: 0,
        horasViagem: 0,
        valorHoraViagem: 0,
        taxas: 0,
      },
    ];

    const secoes = resolverSecoesOrcamento(itens);
    const subtotais = calcularSubtotaisOrcamento(secoes);

    expect(secoes.pecas).toHaveLength(1);
    expect(secoes.pecas[0]).toMatchObject({
      codigo: "HONDA",
      descricao: "TESTE DE OS",
      total: 150,
    });
    expect(secoes.servicos).toHaveLength(1);
    expect(secoes.servicos[0]).toMatchObject({
      descricao: "VOU RESOLVER",
      total: 240,
    });
    expect(subtotais).toMatchObject({
      pecas: 150,
      servicos: 240,
      deslocamento: 0,
      total: 390,
    });
  });

  it("trata itens legados como serviço", () => {
    const secoes = resolverSecoesOrcamento([
      { descricao: "Mão de obra", valor: 450 },
    ]);

    expect(secoes.servicos).toHaveLength(1);
    expect(secoes.servicos[0].total).toBe(450);
  });
});
