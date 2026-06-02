import { describe, expect, it } from "vitest";
import { toCSV } from "./export-utils";

describe("toCSV", () => {
  it("usa ; como separador e \\r\\n entre linhas", () => {
    const csv = toCSV({
      colunas: ["A", "B"],
      linhas: [
        ["1", "2"],
        ["3", "4"],
      ],
    });
    expect(csv).toBe("A;B\r\n1;2\r\n3;4");
  });

  it("escapa células com separador, aspas ou quebra de linha", () => {
    const csv = toCSV({
      colunas: ["Nome", "Obs"],
      linhas: [["Fulano; Silva", 'diz "oi"'], ["linha\nquebrada", 10]],
    });
    expect(csv).toBe(
      'Nome;Obs\r\n"Fulano; Silva";"diz ""oi"""\r\n"linha\nquebrada";10',
    );
  });
});
