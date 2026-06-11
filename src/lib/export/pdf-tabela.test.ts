import { describe, expect, it } from "vitest";
import { gerarPDFTabela } from "./pdf-tabela";

describe("gerarPDFTabela", () => {
  it("gera um PDF não-vazio a partir de um dataset", () => {
    const doc = gerarPDFTabela({
      titulo: "Espelho de ponto — Edmar",
      subtitulo: "CPF 002.514.491-06 · junho de 2026",
      colunas: ["Dia", "Entrada", "Saída", "Saldo"],
      linhas: [["02/06/2026", "08:37", "—", "-09:00"]],
      totais: ["TOTAIS", "", "", "-09:00"],
    });
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("pagina quando há muitas linhas", () => {
    const linhas = Array.from({ length: 80 }, (_, i) => [
      `dia ${i}`,
      "08:00",
      "17:00",
      "+00:00",
    ]);
    const doc = gerarPDFTabela({
      titulo: "Muitas linhas",
      colunas: ["Dia", "Entrada", "Saída", "Saldo"],
      linhas,
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
