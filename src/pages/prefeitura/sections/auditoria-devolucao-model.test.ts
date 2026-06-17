import { describe, expect, it } from "vitest";
import {
  fmtValorExportAuditoria,
  formatarObservacaoAuditoria,
  linhaAuditoriaParaTela,
  montarDestinoAuditoria,
  type LinhaAuditoriaDevolucao,
} from "./auditoria-devolucao-model";
const linhaBase: LinhaAuditoriaDevolucao = {
  osId: "sol-1",
  equipamento: "Sany",
  classificacao: "Linha Amarela",
  protocolo: "OS-2026-001",
  oficina: "Oficina A",
  defeito: "Vazamento no sistema hidráulico",
  valor: 200,
  dataIso: "2026-06-05",
  status: "aguardando_orcamento",
};

describe("montarDestinoAuditoria", () => {
  it("combina protocolo e equipamento", () => {
    expect(montarDestinoAuditoria(linhaBase)).toBe("OS-2026-001 — Sany");
  });
});

describe("fmtValorExportAuditoria", () => {
  it("formata valor positivo com prefixo +", () => {
    expect(fmtValorExportAuditoria(200)).toMatch(/^\+ R\$\s200,00$/);
  });

  it("retorna traço quando valor é zero", () => {
    expect(fmtValorExportAuditoria(0)).toBe("—");
  });
});

describe("formatarObservacaoAuditoria", () => {
  it("quebra relato preventivo em título e itens", () => {
    const relato =
      "Manutenção preventiva — Ciclo 1\n\n" +
      "• Fluidos — Óleo do Motor: Inspecionar (SAE 15W-40)\n" +
      "• Filtros — Filtro de Óleo: Trocar (Cartucho)";

    const fmt = formatarObservacaoAuditoria(relato);

    expect(fmt.ehLista).toBe(true);
    expect(fmt.titulo).toBe("Manutenção preventiva — Ciclo 1");
    expect(fmt.itens).toHaveLength(2);
    expect(fmt.exportText).toContain("\n• Fluidos — Óleo do Motor");
  });

  it("aceita bullets inline separados por espaço", () => {
    const fmt = formatarObservacaoAuditoria(
      "• Item A • Item B • Item C",
    );

    expect(fmt.itens).toEqual(["Item A", "Item B", "Item C"]);
    expect(fmt.exportText).toBe("• Item A\n• Item B\n• Item C");
  });

  it("separa título preventivo de itens inline", () => {
    const fmt = formatarObservacaoAuditoria(
      "Manutenção preventiva — Ciclo 1 • Fluidos — Óleo: Inspecionar • Filtros — Filtro: Trocar",
    );

    expect(fmt.titulo).toBe("Manutenção preventiva — Ciclo 1");
    expect(fmt.itens).toHaveLength(2);
    expect(fmt.exportText).toContain("Manutenção preventiva — Ciclo 1\n• Fluidos");
  });
});

describe("linhaAuditoriaParaTela", () => {
  it("mapeia colunas no padrão de exportação", () => {
    expect(linhaAuditoriaParaTela(linhaBase)).toMatchObject({
      dataLabel: "05/06/2026",
      tipoLabel: "Aguardando Orçamento",
      destino: "OS-2026-001 — Sany",
      valorLabel: expect.stringMatching(/^\+ R\$\s200,00$/),
      responsavel: "Oficina A",
      observacao: "Vazamento no sistema hidráulico",
      observacaoFmt: {
        resumo: "Vazamento no sistema hidráulico",
        ehLista: false,
      },
    });
  });
});