import { NavLink, Outlet, useNavigate } from "react-router-dom";
import logoUrl from "../../assets/logo.png";
import { useLogin } from "../login/hooks/use-login";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `menu-item ${isActive ? "active" : ""}`;

export function AdminLayout() {
  const { user, logout } = useLogin();
  const navigate = useNavigate();

  function onLogout() {
    logout(navigate);
  }
  return (
    <div className="admin-root">
      <section id="appShell" className="app-shell">
        <aside className="sidebar">
          <div className="logo">
            <img
              className="logo-img"
              src={logoUrl}
              alt="horautil360"
              width={220}
              height={72}
            />
            <p>Gestão de frota multimarcas</p>
          </div>

          <div className="menu-label">Gestao</div>

          <NavLink
            to="/admin/dashboard"
            className={navLinkClass}
            id="nav-hub-dashboard"
          >
            Dashboard
          </NavLink>

          <NavLink to="/admin/portal-oficina" className={navLinkClass}>
            Portal Oficina
          </NavLink>

          <NavLink to="/admin/portal-locacao" className={navLinkClass}>
            Painel Locação
          </NavLink>

          <NavLink to="/admin/portal-posto-admin" className={navLinkClass}>
            Portal Posto
          </NavLink>

          <NavLink
            to="/admin/oficinas-postos"
            className={navLinkClass}
            id="nav-hub-oficinas-postos"
          >
            Oficinas e postos
          </NavLink>

          <div className="menu-label">Controle</div>

          <NavLink to="/admin/cadastros" className={navLinkClass}>
            Cadastro de clientes
          </NavLink>

          <NavLink to="/admin/usuarios" className={navLinkClass}>
            Acessos e logins
          </NavLink>

          <NavLink
            to="/admin/equipamentos-locacao"
            className={navLinkClass}
            id="nav-hub-equipamentos-locacao"
          >
            Equipamentos locação
          </NavLink>
        </aside>

        <main className="main-content">
          <div className="topbar">
            <div>
              <h1>Hub Mestre - Controle Operacional</h1>
              <p
                id="ctxPrefeitura"
                className="topbar-user"
                style={{ margin: "6px 0 0", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <span id="usuarioLogado" className="topbar-user">
                Conectado: {user?.usuario} ({user?.type})
              </span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onLogout}
              >
                Sair
              </button>
            </div>
          </div>

          <div
            id="hub-banner-foco"
            className="hub-foco-banner hidden"
            role="status"
          />

          <Outlet />
        </main>
      </section>
    </div>
  );
}
