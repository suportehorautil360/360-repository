import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { DadosPrefeitura } from "../../../lib/hu360";

// A tela busca via abastecimentosApi.listarPorPeriodo (backend NestJS).
// Mockamos o client HTTP (e não a api de abastecimentos) de propósito: o
// guard contra `liters` ausente vive em normalizarItemLista, e mockar acima
// dele deixaria o teste sem cobrir exatamente o que ele protege.
const get = vi.fn();
vi.mock("@/lib/api/client", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

import { AbastecimentoSection } from "./AbastecimentoSection";

const dados = {
  prefeituraModulo: {
    controleAbastecimento: { limiteCreditoSemanalReais: 0 },
  },
} as unknown as DadosPrefeitura;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AbastecimentoSection — dados incompletos do backend", () => {
  it("renderiza um abastecimento sem 'litros' sem quebrar a tela", async () => {
    get.mockResolvedValue({
      data: [
        {
          id: "a1",
          dateTime: "01/06/26 08:00",
          vehicle: { name: "Trator", plate: "ABC-1234", type: "Pesado" },
          origin: "Posto X",
          postoId: "p1",
          // liters AUSENTE de propósito (registro legado/incompleto)
          value: 100,
          reading: "1.000 km",
          local: "Posto X",
          createdAt: "2026-06-01T08:00:00Z",
        },
      ],
    });

    render(<AbastecimentoSection dados={dados} prefeituraId="pref-sem-litros" />);

    // A linha aparece e `liters` ausente vira 0 na normalização.
    expect(await screen.findByText("Trator")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(
      screen.queryByText("Nenhum abastecimento encontrado."),
    ).not.toBeInTheDocument();
  });
});
