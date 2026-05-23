import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock do Firestore: controlamos o getDocs por teste.
const { getDocsMock } = vi.hoisted(() => ({ getDocsMock: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  getDocs: getDocsMock,
}));
vi.mock("../../../lib/firebase/firebase", () => ({ db: {} }));
vi.mock("../../../utils/hashSenha", () => ({
  hashSenha: vi.fn(async (s: string) => `hash:${s}`),
}));

import { useLogin } from "./use-login";

const navigate = vi.fn();
const login = () => useLogin.getState().handleLogin;

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

beforeEach(() => {
  useLogin.setState({ user: null });
  navigate.mockReset();
  getDocsMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useLogin.handleLogin", () => {
  it("avisa que precisa de internet quando offline e a query falha", async () => {
    setOnline(false);
    getDocsMock.mockRejectedValue(new Error("unavailable"));

    const result = await login()("op1", "1234", navigate);

    expect(result).toEqual({
      error: "Sem conexão. O login exige internet na primeira vez.",
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("mostra falha genérica quando online mas a query dá erro", async () => {
    setOnline(true);
    getDocsMock.mockRejectedValue(new Error("boom"));

    const result = await login()("op1", "1234", navigate);

    expect(result).toEqual({ error: "Falha ao conectar. Tente novamente." });
  });

  it("retorna inválido quando nenhum usuário casa", async () => {
    setOnline(true);
    getDocsMock.mockResolvedValue({ docs: [] });

    const result = await login()("op1", "errada", navigate);

    expect(result).toEqual({ error: "Usuário ou senha inválidos." });
  });

  it("loga e navega para /admin quando o usuário é admin", async () => {
    setOnline(true);
    getDocsMock.mockResolvedValue({
      docs: [
        {
          data: () => ({ id: "u1", usuario: "admin", type: "admin" }),
        },
      ],
    });

    const result = await login()("admin", "1234", navigate);

    expect(result).toEqual({});
    expect(navigate).toHaveBeenCalledWith("/admin");
    expect(useLogin.getState().user?.usuario).toBe("admin");
  });
});
