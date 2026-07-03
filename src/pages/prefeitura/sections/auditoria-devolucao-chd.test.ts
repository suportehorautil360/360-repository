import { describe, expect, it } from "vitest";
import {
  chdDocParaLinha,
  filtrarLinhasChd,
  labelStatusChd,
  linhaChdParaTela,
} from "./auditoria-devolucao-model";

describe("chdDocParaLinha", () => {
  it("mapeia documento CHD para linha da tabela", () => {
    const linha = chdDocParaLinha(
      {
        id: "chd-1",
        number: "CHD-2026-001",
        oficinaId: "of-1",
        solicitacaoOsId: "sol-1",
        identification: {
          os: "OS-2026-047",
          date: "2026-06-10",
          brandModel: "Sany SY215",
          platePrefix: "ABC-1234",
          hourMeter: "6.890,2",
        },
        parts: { items: [{}, {}] },
        services: { items: [{}] },
        status: "enviado",
        createdAt: "2026-06-10T14:00:00.000Z",
      },
      new Map([["of-1", "Mecânica Diesel"]]),
    );

    expect(linha).toMatchObject({
      number: "CHD-2026-001",
      osProtocolo: "OS-2026-047",
      oficinaNome: "Mecânica Diesel",
      qtdPecas: 2,
      qtdServicos: 1,
    });
    expect(linhaChdParaTela(linha).equipamentoLabel).toContain("ABC-1234");
    expect(labelStatusChd("aceito")).toBe("Aceito");
  });
});

describe("filtrarLinhasChd", () => {
  const linhas = [
    chdDocParaLinha(
      {
        id: "1",
        number: "CHD-1",
        oficinaId: "of-a",
        identification: { date: "2026-06-01", brandModel: "Eq A" },
        status: "enviado",
        createdAt: "2026-06-01",
      },
      new Map([["of-a", "Oficina A"]]),
    ),
    chdDocParaLinha(
      {
        id: "2",
        number: "CHD-2",
        oficinaId: "of-b",
        identification: { date: "2026-06-15", brandModel: "Eq B" },
        status: "aceito",
        createdAt: "2026-06-15",
      },
      new Map([["of-b", "Oficina B"]]),
    ),
  ];

  it("filtra por oficina e período", () => {
    const filtradas = filtrarLinhasChd(linhas, {
      dataInicio: "2026-06-10",
      dataFim: "2026-06-20",
      oficinaId: "of-b",
      equipamento: "todos",
      statusOs: "todos",
    });
    expect(filtradas).toHaveLength(1);
    expect(filtradas[0]?.number).toBe("CHD-2");
  });
});
