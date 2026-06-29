import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock("./client", async (orig) => {
  const actual = await orig<typeof import("./client")>();
  return { ...actual, api: { ...actual.api, get: getMock } };
});

import { consumoCustoApi } from "./consumoCusto";

beforeEach(() => {
  getMock.mockReset();
});

describe("consumoCustoApi", () => {
  it("exibe métricas do back sem recalcular no front", async () => {
    getMock.mockResolvedValue({
      data: {
        titulo: "Consumo & Custo por Veículo",
        periodo: { label: "01/06/2026 — 30/06/2026" },
        calculo: {
          titulo: "Como o consumo e o custo são calculados",
          formulaConsumo:
            "Consumo = litros do abastecimento ÷ (leitura atual − leitura anterior)",
          formulaCusto:
            "Quando há preço por litro, o gasto = litros × preço/l e o custo unitário = consumo médio × preço/l.",
        },
        veiculos: [
          {
            equipmentId: "eq-1",
            nome: "Frota Teste",
            placa: "ABC-1234",
            tipo: "Carro Leve",
            unidadeMedicao: "km",
            consumoMedio: {
              rotulo: "MÉDIO L/KM",
              valor: 0.15,
              valorExibicao: "0,15 L/km",
            },
            custoMedio: {
              rotulo: "CUSTO /KM",
              valor: 0.8985,
              valorExibicao: "R$ 0,90/km",
            },
            totalDestaque: {
              tipo: "gasto",
              valorExibicao: "R$ 269,55",
            },
            totais: {
              litrosExibicao: "45,000 L",
              gastoExibicao: "R$ 269,55",
            },
            historicoIntervalos: [
              {
                periodoLabel: "01/06/2026 → 15/06/2026",
                distanciaLabel: "300 km",
                consumoLabel: "0,15 L/km",
                custoLabel: "R$ 0,90/km",
              },
            ],
            historicoAbastecimentos: [],
          },
        ],
      },
    });

    const tela = await consumoCustoApi.listarPorPeriodo(
      "pref-1",
      "2026-06-01",
      "2026-06-30",
    );

    expect(getMock).toHaveBeenCalledWith(
      expect.stringContaining("/movimentacoes/consumo-custo/pref-1"),
    );

    const veiculo = tela.veiculos[0];
    expect(veiculo.consumoValor).toBe("0,15");
    expect(veiculo.consumoLabel).toBe("0,15 L/km");
    expect(veiculo.custoValor).toBe("0,90");
    expect(veiculo.intervalos).toHaveLength(1);
    expect(veiculo.intervalos[0].consumoLabel).toBe("0,15 L/km");
  });

  it("mantém consumo — quando o back não calcula intervalo", async () => {
    getMock.mockResolvedValue({
      data: {
        veiculos: [
          {
            equipmentId: "eq-solo",
            nome: "Veículo único",
            unidadeMedicao: "km",
            consumoMedio: { valor: null, valorExibicao: "—" },
            custoMedio: { valor: null, valorExibicao: "—" },
            historicoIntervalos: [],
            historicoAbastecimentos: [{ litros: 80 }],
          },
        ],
      },
    });

    const tela = await consumoCustoApi.listarPorPeriodo(
      "pref-1",
      "2026-06-01",
      "2026-06-30",
    );

    expect(tela.veiculos[0].consumoValor).toBe("—");
    expect(tela.veiculos[0].consumoLabel).toBe("—");
  });
});
