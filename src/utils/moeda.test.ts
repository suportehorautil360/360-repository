import { describe, expect, it } from "vitest";
import { digitosParaCentavos, formatBRL, parseValorBR } from "./moeda";

describe("formatBRL", () => {
  it("formata reais como moeda BRL", () => {
    const s = formatBRL(2120);
    expect(s).toContain("R$");
    expect(s).toContain("2.120,00");
  });

  it("trata 0 / NaN como R$ 0,00", () => {
    expect(formatBRL(0)).toContain("0,00");
    expect(formatBRL(Number.NaN)).toContain("0,00");
  });

  it("formata centavos", () => {
    expect(formatBRL(1234.56)).toContain("1.234,56");
  });
});

describe("parseValorBR", () => {
  it("converte texto de moeda em número", () => {
    expect(parseValorBR("R$ 1.234,56")).toBe(1234.56);
    expect(parseValorBR("2.120")).toBe(2120);
  });

  it("retorna 0 para vazio ou inválido", () => {
    expect(parseValorBR("")).toBe(0);
    expect(parseValorBR("abc")).toBe(0);
  });
});

describe("digitosParaCentavos", () => {
  it("interpreta só os dígitos como centavos", () => {
    expect(digitosParaCentavos("R$ 12,34")).toBe(1234);
    expect(digitosParaCentavos("1")).toBe(1);
    expect(digitosParaCentavos("")).toBe(0);
  });
});
