import { describe, expect, it } from "vitest";
import {
  isBloqueado,
  isVencido,
  maintenanceUnitDe,
  revisaoEm,
  revisaoRestante,
  textoLeitura,
  textoRevisao,
  textoVencimento,
  unidadeDe,
  type VeiculoFrota,
} from "./types";

function veiculo(over: Partial<VeiculoFrota> = {}): VeiculoFrota {
  return {
    id: "v1",
    placa: "CAR-001",
    nome: "HB20 2021",
    marca: "Hyundai",
    tipo: "carro",
    ano: 2021,
    medicaoAtual: 12000,
    intervaloRevisao: 10000,
    ultimaRevisao: 0,
    obra: "Disponível",
    status: "ativo",
    ...over,
  };
}

describe("unidade por tipo", () => {
  it("usa horímetro (h) para máquina e km para o resto", () => {
    expect(unidadeDe("maquina")).toBe("h");
    expect(unidadeDe("carro")).toBe("km");
    expect(unidadeDe("caminhao")).toBe("km");
    expect(unidadeDe("van")).toBe("km");
  });

  it("traduz para a unidade do backend (maintenanceUnit)", () => {
    expect(maintenanceUnitDe("maquina")).toBe("hours");
    expect(maintenanceUnitDe("carro")).toBe("km");
  });
});

describe("limite e restante de revisão", () => {
  it("limite = última revisão + intervalo", () => {
    expect(revisaoEm(veiculo({ ultimaRevisao: 850, intervaloRevisao: 250 }))).toBe(
      1100,
    );
  });

  it("restante positivo quando dentro do prazo", () => {
    const v = veiculo({
      tipo: "maquina",
      ultimaRevisao: 850,
      intervaloRevisao: 250,
      medicaoAtual: 860,
    });
    expect(revisaoRestante(v)).toBe(240);
    expect(isVencido(v)).toBe(false);
    expect(isBloqueado(v)).toBe(false);
  });

  it("restante <= 0 marca como vencido e bloqueado", () => {
    const v = veiculo({ ultimaRevisao: 0, intervaloRevisao: 10000, medicaoAtual: 12000 });
    expect(revisaoRestante(v)).toBe(-2000);
    expect(isVencido(v)).toBe(true);
    expect(isBloqueado(v)).toBe(true);
  });

  it("status 'bloqueado' do backend também bloqueia, mesmo no prazo", () => {
    const v = veiculo({ medicaoAtual: 100, status: "bloqueado" });
    expect(isVencido(v)).toBe(false);
    expect(isBloqueado(v)).toBe(true);
  });
});

describe("textos formatados", () => {
  it("mostra '<n> rest.' quando no prazo", () => {
    const v = veiculo({
      tipo: "maquina",
      ultimaRevisao: 850,
      intervaloRevisao: 250,
      medicaoAtual: 860,
    });
    expect(textoRevisao(v)).toBe("240 h rest.");
  });

  it("mostra '+<excesso>' quando vencida", () => {
    const v = veiculo({ ultimaRevisao: 0, intervaloRevisao: 10000, medicaoAtual: 10500 });
    expect(textoRevisao(v)).toBe("+500 km");
  });

  it("textoLeitura usa a unidade do tipo", () => {
    expect(textoLeitura(veiculo({ tipo: "maquina", medicaoAtual: 860 }))).toBe(
      "860 h",
    );
  });

  it("textoVencimento resume tipo, marca, leitura e excesso", () => {
    const v = veiculo({ ultimaRevisao: 0, intervaloRevisao: 10000, medicaoAtual: 10500 });
    const txt = textoVencimento(v);
    expect(txt).toContain("Carro · Hyundai");
    expect(txt).toContain("KM atual:");
    expect(txt).toContain("Excesso:");
    expect(txt).toContain("500 km");
  });
});
