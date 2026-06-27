import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

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
    data: () => ({
      prefeituraId: "pref-1",
      nomeFantasia: "Posto Teste",
      razaoSocial: "Teste LTDA",
      cidadeUf: "São Paulo/SP",
      bandeira: "Ipiranga",
      status: "Ativa",
    }),
  })),
}));
vi.mock("../../../lib/firebase/firebase", () => ({ db: {} }));
vi.mock("../../../lib/api/user-posto", () => ({
  userPostoApi: { enviarBoasVindas: vi.fn(async () => {}) },
}));

import { PostoDetalhePage } from "./PostoDetalhePage";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/parceiros/posto/posto-1"]}>
      <Routes>
        <Route
          path="/admin/parceiros/posto/:postoId"
          element={<PostoDetalhePage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PostoDetalhePage", () => {
  it("mostra o posto e cria acesso por e-mail", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Posto Teste" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Acessos/i }));

    await user.type(
      await screen.findByPlaceholderText("Ex.: Maria Silva"),
      "Caixa 1",
    );
    await user.type(
      screen.getByPlaceholderText("operador@posto.com.br"),
      "caixa@posto.com.br",
    );
    await user.type(
      screen.getByPlaceholderText("Mínimo 4 caracteres"),
      "1234",
    );
    await user.click(
      screen.getByRole("button", { name: /Criar acesso e enviar boas-vindas/i }),
    );

    await waitFor(() =>
      expect(adicionarUsuario).toHaveBeenCalledWith(
        expect.objectContaining({
          usuario: "caixa@posto.com.br",
          email: "caixa@posto.com.br",
          vinculo: "posto",
          postoId: "posto-1",
          prefeituraId: "pref-1",
        }),
      ),
    );
  });
});
