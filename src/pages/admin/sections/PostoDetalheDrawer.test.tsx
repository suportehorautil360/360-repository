import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const adicionarUsuario = vi.fn(async () => ({ ok: true, message: "ok" }));
const listarUsuarios = vi.fn(async () => []);
const resetarSenha = vi.fn(async () => ({ ok: true, message: "ok" }));
const removerUsuario = vi.fn(async () => ({ ok: true, message: "ok" }));

vi.mock("../hooks/access/use-access", () => ({
  useAccess: () => ({ adicionarUsuario, listarUsuarios, resetarSenha, removerUsuario }),
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({
    exists: () => true,
    data: () => ({ prefeituraId: "pref-1" }),
  })),
}));
vi.mock("../../../lib/firebase/firebase", () => ({ db: {} }));

import { PostoDetalheDrawer } from "./PostoDetalheDrawer";

const posto = {
  id: "posto-1",
  nome: "Posto Teste",
  razaoSocial: "Teste LTDA",
  cidadeUf: "São Paulo/SP",
  bandeira: "Ipiranga",
  condicaoPagamento: "",
  limiteCredito: 0,
  ativo: true,
};

describe("PostoDetalheDrawer", () => {
  it("mostra o posto e cria um acesso", async () => {
    render(<PostoDetalheDrawer posto={posto} open onClose={() => {}} />);
    expect(await screen.findByText("Posto Teste")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nome do operador"), {
      target: { value: "Caixa 1" },
    });
    fireEvent.change(screen.getByPlaceholderText("Usuário (login do caixa)"), {
      target: { value: "posto1caixa" },
    });
    fireEvent.change(screen.getByPlaceholderText("Senha (mín. 4)"), {
      target: { value: "1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar acesso" }));

    await waitFor(() =>
      expect(adicionarUsuario).toHaveBeenCalledWith(
        expect.objectContaining({
          usuario: "posto1caixa",
          vinculo: "posto",
          postoId: "posto-1",
          prefeituraId: "pref-1",
        }),
      ),
    );
  });
});
