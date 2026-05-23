import { Outlet, useNavigate } from "react-router-dom";
import { clearAdminSession } from "../../admin/adminSession";
import { useLogin } from "../login/hooks/use-login";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { ADMIN_BRAND, ADMIN_NAV } from "./adminNav";

export function AdminLayout() {
  const { user, logout } = useLogin();
  const navigate = useNavigate();

  function onLogout() {
    clearAdminSession();
    logout(navigate);
    window.location.reload();
  }
  return (
    <div className="admin-root">
      <section id="appShell" className="app-shell">
        <Sidebar
          brand={ADMIN_BRAND}
          groups={ADMIN_NAV}
          user={{
            name: user?.usuario ?? "Usuário",
            role: user?.type ?? "admin",
          }}
          onLogout={onLogout}
        />

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
