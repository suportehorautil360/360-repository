import { Link, NavLink, Outlet } from 'react-router-dom'
import logoUrl from '../../assets/logo.jpeg'

interface AdminLayoutProps {
  onLogout: () => void
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `menu-item ${isActive ? 'active' : ''}`

export function AdminLayout({ onLogout }: AdminLayoutProps) {
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

          <Link to="/oficina" className="menu-item">
            Portal Oficina
          </Link>

          <Link to="/locacao" className="menu-item">
            Painel Locação
          </Link>

          <Link to="/posto" className="menu-item">
            Portal Posto
          </Link>

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
                style={{ margin: '6px 0 0', fontSize: '0.82rem' }}
              />
            </div>
            <div>
              <span id="usuarioLogado" className="topbar-user">
                Conectado: Administrador Três Lagoas (admin)
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
  )
}
