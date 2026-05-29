import { describe, expect, it } from "vitest";
import { cpfValido, formatarCpf, limparCpf } from "./cpf";

describe("limparCpf", () => {
  it("remove pontuação e espaços", () => {
    expect(limparCpf("529.982.247-25")).toBe("52998224725");
    expect(limparCpf(" 529 982 247 25 ")).toBe("52998224725");
  });
});

describe("formatarCpf", () => {
  it("formata cpf completo", () => {
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
  });
  it("formata parciais enquanto digita", () => {
    expect(formatarCpf("529")).toBe("529");
    expect(formatarCpf("529982")).toBe("529.982");
    expect(formatarCpf("529982247")).toBe("529.982.247");
  });
  it("ignora dígitos além de 11", () => {
    expect(formatarCpf("5299822472599")).toBe("529.982.247-25");
  });
});

describe("cpfValido", () => {
  it("aceita CPF com dígitos verificadores corretos", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });
  it("rejeita CPF com dígito verificador errado", () => {
    expect(cpfValido("529.982.247-24")).toBe(false);
  });
  it("rejeita repetidos e tamanhos inválidos", () => {
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("123")).toBe(false);
    expect(cpfValido("")).toBe(false);
  });
});
