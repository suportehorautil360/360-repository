import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DadosPrefeitura } from "../../../lib/hu360";

const getDocs = vi.fn();
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  getDocs: (...args: unknown[]) => getDocs(...args),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({})),
}));
vi.mock("../../../lib/firebase/firebase", () => ({ db: {} }));

import { AbastecimentoSection } from "./AbastecimentoSection";

const dados = {
  prefeituraModulo: {
    controleAbastecimento: { limiteCreditoSemanalReais: 0 },
  },
} as unknown as DadosPrefeitura;

function snap(docs: Record<string, unknown>[]) {
  return { docs: docs.map((d, i) => ({ id: `id-${i}`, data: () => d })) };
}

beforeEach(() => getDocs.mockReset());

describe("AbastecimentoSection — dados incompletos do Firestore", () => {
  it("renderiza um abastecimento sem 'litros' sem quebrar a tela", async () => {
    // Ordem das queries no loadDados: postos, equipamentos, abastecimentos, créditos.
    getDocs
      .mockResolvedValueOnce(snap([])) // postos
      .mockResolvedValueOnce(snap([])) // equipamentos
      .mockResolvedValueOnce(
        snap([
          {
            id: "a1",
            data: "2026-06-01",
            veiculo: "Trator",
            motorista: "João",
            postoNome: "Posto X",
            combustivel: "Diesel S10",
            // litros AUSENTE de propósito (registro legado/incompleto)
            valorTotal: "R$ 100,00",
            km: 1000,
            cupomFiscal: "123",
            secretaria: "Infra",
          },
        ]),
      ) // abastecimentos
      .mockResolvedValueOnce(snap([])); // créditos

    render(
      <MemoryRouter>
        <AbastecimentoSection dados={dados} prefeituraId="pref-1" />
      </MemoryRouter>,
    );

    // Sem o guard, a linha estoura ao formatar `litros` undefined e nada
    // renderiza. Com o fix, a linha aparece (litros vira "0").
    await waitFor(() =>
      expect(screen.getByText("João")).toBeInTheDocument(),
    );
  });
});
