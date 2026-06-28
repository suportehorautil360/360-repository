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
      nomeFantasia: "Oficina Teste",
      razaoSocial: "Mecânica LTDA",
      cidadeUf: "Campinas/SP",
      linhasAtuacao: ["Linha Amarela"],
      categoriasServico: ["Mecânica Geral"],
      status: "Ativa",
    }),
  })),
}));
vi.mock("../../../lib/firebase/firebase", () => ({ db: {} }));

import { OficinaDetalhePage } from "./OficinaDetalhePage";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/parceiros/oficina/oficina-1"]}>
      <Routes>
        <Route
          path="/admin/parceiros/oficina/:oficinaId"
          element={<OficinaDetalhePage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OficinaDetalhePage", () => {
  it("mostra a oficina e cria acesso por e-mail", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Oficina Teste" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Acessos/i }));

    await user.type(
      await screen.findByPlaceholderText("Ex.: João Mecânico"),
      "Mecânico 1",
    );
    await user.type(
      screen.getByPlaceholderText("operador@oficina.com.br"),
      "mecanico@oficina.com.br",
    );
    await user.type(
      screen.getByPlaceholderText("Mínimo 4 caracteres"),
      "1234",
    );
    await user.click(screen.getByRole("button", { name: /Criar acesso/i }));

    await waitFor(() =>
      expect(adicionarUsuario).toHaveBeenCalledWith(
        expect.objectContaining({
          usuario: "mecanico@oficina.com.br",
          email: "mecanico@oficina.com.br",
          vinculo: "oficina",
          officinaId: "oficina-1",
          prefeituraId: "pref-1",
        }),
      ),
    );
  });
});
