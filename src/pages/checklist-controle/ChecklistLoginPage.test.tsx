/**
 * Tela de login do operador — mensagens no cenário offline e fluxo chassi.
 * Offline sem credencial guardada, o Firestore pode responder "vazio" do
 * cache (nao-encontrado): a mensagem precisa explicar a regra do offline,
 * não dizer que o cadastro não existe.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const autenticar = vi.fn();
const autenticarPorChassi = vi.fn();
vi.mock("../../lib/funcionarios/funcionarios", () => ({
  funcionariosApi: {
    autenticar: (...a: unknown[]) => autenticar(...a),
    autenticarPorChassi: (...a: unknown[]) => autenticarPorChassi(...a),
  },
}));
vi.mock("firebase/firestore", () => ({ getDoc: vi.fn(), doc: vi.fn() }));
vi.mock("../../lib/firebase/firebase", () => ({ db: {} }));

import { ChecklistLoginPage } from "./ChecklistLoginPage";

const SESSION_KEY = "hu360-operador-session";

function setOnline(v: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(v);
}

async function submeterLogin() {
  render(
    <MemoryRouter>
      <ChecklistLoginPage />
    </MemoryRouter>,
  );
  // Garante que está na aba CPF (padrão quando localStorage vazio)
  fireEvent.change(screen.getByLabelText(/cpf ou login/i), {
    target: { value: "390.533.447-05" },
  });
  fireEvent.change(screen.getByLabelText(/senha/i), {
    target: { value: "segredo1" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  autenticar.mockReset();
  autenticarPorChassi.mockReset();
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

describe("ChecklistLoginPage — aba chassi", () => {
  it("chassi válido → abre modal nome → cria sessão modoLogin=chassi", async () => {
    autenticarPorChassi.mockResolvedValue({
      ok: true,
      empresaId: "e1",
      empresaNome: "Emp 1",
      idMaquina: "m1",
      chassi: "ABC",
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ChecklistLoginPage />
      </MemoryRouter>,
    );

    // Navega para aba chassi via userEvent (dispara mousedown → Radix muda aba)
    await user.click(screen.getByRole("tab", { name: /chassi/i }));

    // Aguarda o conteúdo da aba chassi aparecer
    const inputChassi = await screen.findByPlaceholderText(/9BWZZZ/i);

    // Preenche o chassi (minúsculas → deve normalizar para uppercase)
    await user.type(inputChassi, "abc");

    // Submete — clica no botão "Entrar" do form chassi
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    // Aguarda o modal abrir
    await screen.findByRole("dialog");

    // Preenche o nome no modal
    await user.type(screen.getByPlaceholderText(/joão/i), "Zé");
    await user.click(
      screen.getByRole("button", { name: /entrar no checklist/i }),
    );

    // Verifica que a sessão foi gravada no localStorage
    await waitFor(() => {
      const raw = localStorage.getItem(SESSION_KEY);
      expect(raw).not.toBeNull();
      const { session } = JSON.parse(raw!);
      expect(session.modoLogin).toBe("chassi");
      expect(session.nomeInformado).toBe("Zé");
      expect(session.idCliente).toBe("e1");
    });
  });

  it("chassi não encontrado mostra mensagem de erro", async () => {
    autenticarPorChassi.mockResolvedValue({
      ok: false,
      motivo: "nao-encontrado",
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ChecklistLoginPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: /chassi/i }));

    const inputChassi = await screen.findByPlaceholderText(/9BWZZZ/i);
    await user.type(inputChassi, "XYZ999");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    await waitFor(() =>
      expect(screen.getByText(/chassi não encontrado/i)).toBeTruthy(),
    );
  });
});
