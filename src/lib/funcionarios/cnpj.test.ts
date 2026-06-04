import { describe, expect, it } from "vitest";
import { cnpjValido, formatarCnpj, limparCnpj } from "./cnpj";

describe("cnpj", () => {
  it("limpa para só dígitos", () => {
    expect(limparCnpj("11.222.333/0001-81")).toBe("11222333000181");
  });

  it("formata 14 dígitos", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("aceita CNPJ válido", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita tamanho errado, repetidos e dígito verificador inválido", () => {
    expect(cnpjValido("123")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(cnpjValido("11222333000180")).toBe(false);
  });
});
