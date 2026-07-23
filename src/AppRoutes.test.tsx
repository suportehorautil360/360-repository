import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AppRoutes } from "./AppRoutes";
import { useLogin } from "./pages/login/hooks/use-login";

vi.mock("./portal/PostoPortalProvider", () => ({
  PostoPortalProvider: () => <div>Portal posto</div>,
}));
vi.mock("./pages/admin/AdminPage", () => ({
  AdminPage: () => <div>Admin shell</div>,
}));
vi.mock("./pages/admin/AdminLoginPage", () => ({
  AdminLoginPage: () => <div>Login admin</div>,
}));
vi.mock("./pages/admin/sections/DashboardSection", () => ({
  DashboardSection: () => <div>Dashboard admin</div>,
}));
vi.mock("./pages/admin/sections/PortalPostoSection", () => ({
  PortalPostoSection: () => <div>Portal posto admin</div>,
}));
vi.mock("./pages/admin/sections/OficinasPostosSection", () => ({
  OficinasPostosSection: () => <div>Oficinas postos</div>,
}));
vi.mock("./pages/admin/sections/CadastroClientesSection", () => ({
  CadastroClientesSection: () => <div>Cadastro clientes</div>,
}));
vi.mock("./pages/admin/sections/AcessosLoginsSection", () => ({
  AcessosLoginsSection: () => <div>Acessos logins</div>,
}));
vi.mock("./pages/admin/sections/EquipamentosLocacaoSection", () => ({
  EquipamentosLocacaoSection: () => <div>Equipamentos locacao</div>,
}));
vi.mock("./pages/admin/sections/AdminPortalOficinaPage", () => ({
  AdminPortalOficinaPage: () => <div>Admin portal oficina</div>,
}));
vi.mock("./pages/admin/sections/AdminPortalLocacaoPage", () => ({
  AdminPortalLocacaoPage: () => <div>Admin portal locacao</div>,
}));
vi.mock("./pages/admin/sections/AdminPortalPostoPage", () => ({
  AdminPortalPostoPage: () => <div>Admin portal posto</div>,
}));
vi.mock("./pages/oficina/OficinaPage", () => ({
  OficinaPage: () => <div>Oficina</div>,
}));
vi.mock("./pages/locacao/LocacaoPage", () => ({
  LocacaoPage: () => <div>Locacao</div>,
}));
vi.mock("./pages/posto/PostoPage", () => ({
  PostoPage: () => <div>Posto</div>,
}));
vi.mock("./pages/prefeitura/PrefeituraPage", () => ({
  PrefeituraPage: () => <div>Prefeitura</div>,
}));
vi.mock("./pages/prefeitura/PrefeituraLoginPage", () => ({
  PrefeituraLoginPage: () => <div>Login prefeitura</div>,
}));
vi.mock("./pages/login/OperacionalLoginPage", () => ({
  OperacionalLoginPage: () => <div>Login operacional</div>,
}));
vi.mock("./pages/checklist-controle/ChecklistControlePage", () => ({
  ChecklistControlePage: () => <div>Checklist controle</div>,
}));
vi.mock("./pages/checklist-controle/ChecklistLoginPage", () => ({
  ChecklistLoginPage: () => <div>Checklist login</div>,
}));

afterEach(() => {
  useLogin.setState({ user: null });
  window.history.pushState({}, "", "/");
});

describe("AppRoutes", () => {
  it("redireciona a raiz para o dashboard quando há sessão admin persistida", async () => {
    useLogin.setState({
      user: {
        id: "u1",
        usuario: "admin",
        type: "admin",
      },
    });
    window.history.pushState({}, "", "/");

    render(<AppRoutes />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/admin/dashboard");
    });
    expect(await screen.findByText("Admin shell")).toBeInTheDocument();
  });

  it("redireciona a raiz para o login da prefeitura sem sessão", async () => {
    window.history.pushState({}, "", "/");

    render(<AppRoutes />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/login-prefeitura");
    });
    expect(await screen.findByText("Login prefeitura")).toBeInTheDocument();
  });

  it("expõe o login do admin em /login-admin", async () => {
    window.history.pushState({}, "", "/login-admin");

    render(<AppRoutes />);

    expect(await screen.findByText("Login admin")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login-admin");
  });

  it("redireciona prefeitura logada da raiz para o dashboard", async () => {
    useLogin.setState({
      user: {
        id: "u2",
        usuario: "pref",
        type: "prefeitura",
        prefeituraId: "pref-1",
      },
    });
    window.history.pushState({}, "", "/");

    render(<AppRoutes />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/prefeitura/pref-1/dashboard");
    });
  });

  it("impede admin de acessar o painel da prefeitura", async () => {
    useLogin.setState({
      user: {
        id: "u1",
        usuario: "admin",
        type: "admin",
      },
    });
    window.history.pushState({}, "", "/prefeitura/pref-1/dashboard");

    render(<AppRoutes />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/admin/dashboard");
    });
  });
});
