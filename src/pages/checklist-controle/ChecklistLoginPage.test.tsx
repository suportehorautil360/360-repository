/**
 * Tela de login do operador — mensagens no cenário offline.
 * Offline sem credencial guardada, o Firestore pode responder "vazio" do
 * cache (nao-encontrado): a mensagem precisa explicar a regra do offline,
 * não dizer que o cadastro não existe.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const autenticar = vi.fn();
vi.mock("../../lib/funcionarios/funcionarios", () => ({
  funcionariosApi: { autenticar: (...a: unknown[]) => autenticar(...a) },
}));
vi.mock("firebase/firestore", () => ({ getDoc: vi.fn(), doc: vi.fn() }));
vi.mock("../../lib/firebase/firebase", () => ({ db: {} }));

import { ChecklistLoginPage } from "./ChecklistLoginPage";

function setOnline(v: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(v);
}

async function submeterLogin() {
  render(
    <MemoryRouter>
      <ChecklistLoginPage />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText(/cpf ou login/i), {
    target: { value: "390.533.447-05" },
  });
  fireEvent.change(screen.getByLabelText(/senha/i), {
    target: { value: "segredo1" },
  });
  fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  autenticar.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("ChecklistLoginPage — offline sem credencial guardada", () => {
  it("query vazia do cache (nao-encontrado) explica a regra do offline", async () => {
    setOnline(false);
    autenticar.mockResolvedValue({ ok: false, motivo: "nao-encontrado" });
    await submeterLogin();
    await waitFor(() =>
      expect(
        screen.getByText(/já ter feito login neste aparelho/i),
      ).toBeTruthy(),
    );
  });

  it("consulta lançando erro offline também explica a regra", async () => {
    setOnline(false);
    autenticar.mockRejectedValue(new Error("unavailable"));
    await submeterLogin();
    await waitFor(() =>
      expect(
        screen.getByText(/já ter feito login neste aparelho/i),
      ).toBeTruthy(),
    );
  });

  it("com rede, nao-encontrado continua com a mensagem original", async () => {
    setOnline(true);
    autenticar.mockResolvedValue({ ok: false, motivo: "nao-encontrado" });
    await submeterLogin();
    await waitFor(() =>
      expect(screen.getByText(/não encontrado/i)).toBeTruthy(),
    );
  });
});
