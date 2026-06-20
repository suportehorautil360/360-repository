import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Abastecimento } from "@/lib/api/abastecimentos";

const listar = vi.fn();
vi.mock("@/lib/api/abastecimentos", () => ({
  abastecimentosApi: { listar: (...a: unknown[]) => listar(...a) },
}));
// O componente também resolve nomes de comboio/comboista — mocka vazio.
vi.mock("./equipamentos/equipamentos-api", () => ({
  equipamentosApi: { listar: () => Promise.resolve([]) },
}));
vi.mock("../../../lib/funcionarios/funcionarios", () => ({
  funcionariosApi: { listar: () => Promise.resolve([]) },
}));

import { AbastecimentosListSection } from "./AbastecimentosListSection";

const mk = (p: Partial<Abastecimento>): Abastecimento => ({
  id: "0",
  data: "2026-06-02",
  hora: "08:00",
  origem: "posto",
  veiculo: "",
  placa: "",
  tipoVeiculo: "",
  combustivel: "Diesel",
  litros: 0,
  valor: 0,
  leitura: 0,
  leituraUnidade: "km",
  local: "",
  comboioId: "",
  funcionarioId: "",
  comboio: "",
  comboista: "",
  km: 0,
  postoNome: "",
  status: "",
  ...p,
});

const dados: Abastecimento[] = [
  mk({
    id: "1",
    origem: "comboio",
    veiculo: "Escavadeira CAT 320",
    placa: "ABC-1234",
    litros: 320,
    leitura: 4690,
    leituraUnidade: "h",
    local: "Talhão Norte",
  }),
  mk({
    id: "2",
    origem: "posto",
    veiculo: "Hilux Cabine Dupla",
    placa: "JKL-7B43",
    litros: 50,
    valor: 306,
    leitura: 85260,
    leituraUnidade: "km",
    local: "Posto Trevo",
  }),
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AbastecimentosListSection", () => {
  it("renderiza comboio e posto com origem/valor/leitura corretos", async () => {
    listar.mockResolvedValue(dados);
    render(<AbastecimentosListSection prefeituraId="pref-1" />);

    expect(await screen.findByText("Escavadeira CAT 320")).toBeInTheDocument();
    expect(screen.getByText("Hilux Cabine Dupla")).toBeInTheDocument();
    // comboio: valor "—" (há vários "—" agora: comboio/comboista vazios) e leitura em horas
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText("4.690 h")).toBeInTheDocument();
    // posto: valor em R$ e leitura em km
    expect(screen.getByText("R$ 306,00")).toBeInTheDocument();
    expect(screen.getByText("85.260 km")).toBeInTheDocument();
  });

  it("filtra pela aba Comboio", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    listar.mockResolvedValue(dados);
    render(<AbastecimentosListSection prefeituraId="pref-1" />);
    await screen.findByText("Escavadeira CAT 320");

    await user.click(screen.getByRole("tab", { name: "Comboio" }));
    await waitFor(() =>
      expect(screen.queryByText("Hilux Cabine Dupla")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Escavadeira CAT 320")).toBeInTheDocument();
  });

  it("busca por veículo", async () => {
    listar.mockResolvedValue(dados);
    render(<AbastecimentosListSection prefeituraId="pref-1" />);
    await screen.findByText("Escavadeira CAT 320");

    fireEvent.change(screen.getByPlaceholderText(/buscar por placa/i), {
      target: { value: "hilux" },
    });
    await waitFor(() =>
      expect(
        screen.queryByText("Escavadeira CAT 320"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Hilux Cabine Dupla")).toBeInTheDocument();
  });

  it("mostra empty-state quando não há dados", async () => {
    listar.mockResolvedValue([]);
    render(<AbastecimentosListSection prefeituraId="pref-1" />);
    expect(
      await screen.findByText("Nenhum abastecimento encontrado."),
    ).toBeInTheDocument();
  });
});
