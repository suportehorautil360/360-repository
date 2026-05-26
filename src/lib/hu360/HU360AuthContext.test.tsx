import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HU360AuthProvider } from "./HU360AuthContext";
import { HU360Provider, useHU360Auth } from ".";
import { SESSION_KEY } from "./storage";

vi.mock("../firebase/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  query: vi.fn(),
  where: vi.fn(),
}));

function AuthHarness() {
  const auth = useHU360Auth();

  return (
    <div>
      <span data-testid="usuario">{auth.user?.usuario ?? "sem usuario"}</span>
      <button
        type="button"
        onClick={() => auth.loginPorUsuario("admin", { persist: false })}
      >
        Login em memória
      </button>
      <button type="button" onClick={() => auth.loginPorUsuario("admin")}>
        Login persistente
      </button>
    </div>
  );
}

function renderAuthHarness() {
  return render(
    <HU360Provider>
      <HU360AuthProvider>
        <AuthHarness />
      </HU360AuthProvider>
    </HU360Provider>,
  );
}

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("HU360AuthProvider.loginPorUsuario", () => {
  it("permite login em memória sem gravar hu360_session", async () => {
    renderAuthHarness();

    await userEvent.click(screen.getByRole("button", { name: /memória/i }));

    expect(screen.getByTestId("usuario")).toHaveTextContent("admin");
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("mantém persistência por padrão para os fluxos que usam loginPorUsuario", async () => {
    renderAuthHarness();

    await userEvent.click(screen.getByRole("button", { name: /persistente/i }));

    expect(screen.getByTestId("usuario")).toHaveTextContent("admin");
    expect(localStorage.getItem(SESSION_KEY)).toContain('"usuario":"admin"');
  });
});
