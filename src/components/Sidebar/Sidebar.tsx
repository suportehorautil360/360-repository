import { NavLink } from "react-router-dom";
import type { SidebarItem, SidebarProps } from "./types";
import "./sidebar.css";

function itemClass({ isActive }: { isActive: boolean }) {
  return `hu-sidebar__item ${isActive ? "is-active" : ""}`;
}

function SidebarLink({ item }: { item: SidebarItem }) {
  return (
    <NavLink to={item.to} end={item.end} id={item.id} className={itemClass}>
      {item.icon != null && (
        <span className="hu-sidebar__icon" aria-hidden="true">
          {item.icon}
        </span>
      )}
      <span className="hu-sidebar__label">{item.label}</span>
      {item.badge != null && (
        <span
          className={`hu-sidebar__badge hu-sidebar__badge--${
            item.badgeTone ?? "danger"
          }`}
        >
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

/**
 * Sidebar genérica e reutilizável, dirigida por configuração.
 * Estilo escuro (HORA ÚTIL 360); cores herdam do tema quando presente,
 * com fallback próprio para funcionar isolada.
 */
/** Iniciais a partir do nome (ex.: "João Santos" → "JS"). */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const ini = (partes[0]?.[0] ?? "") + (partes[partes.length - 1]?.[0] ?? "");
  return ini.toUpperCase() || "?";
}

export function Sidebar({
  brand,
  groups,
  user,
  onLogout,
  className,
}: SidebarProps) {
  return (
    <aside className={`hu-sidebar ${className ?? ""}`}>
      <div className="hu-sidebar__brand">
        {brand.logo != null && (
          <span className="hu-sidebar__brand-logo" aria-hidden="true">
            {brand.logo}
          </span>
        )}
        <div className="hu-sidebar__brand-text">
          <strong className="hu-sidebar__brand-title">{brand.title}</strong>
          {brand.subtitle != null && (
            <span className="hu-sidebar__brand-subtitle">{brand.subtitle}</span>
          )}
        </div>
      </div>

      <nav className="hu-sidebar__nav" aria-label="Menu principal">
        {groups.map((group, gi) => (
          <div className="hu-sidebar__group" key={group.label ?? `g${gi}`}>
            {group.label && (
              <p className="hu-sidebar__group-label">{group.label}</p>
            )}
            {group.items.map((item) => (
              <SidebarLink key={item.to} item={item} />
            ))}
          </div>
        ))}
      </nav>

      {(user || onLogout) && (
        <div className="hu-sidebar__footer">
          {user ? (
            <div className="hu-sidebar__user">
              <span className="hu-sidebar__avatar" aria-hidden="true">
                {user.initials ?? iniciais(user.name)}
              </span>
              <span className="hu-sidebar__user-text">
                <strong className="hu-sidebar__user-name">{user.name}</strong>
                {user.role != null && (
                  <span className="hu-sidebar__user-role">{user.role}</span>
                )}
              </span>
              {onLogout && (
                <button
                  type="button"
                  className="hu-sidebar__logout-icon"
                  onClick={onLogout}
                  aria-label="Sair"
                  title="Sair"
                >
                  ⏻
                </button>
              )}
            </div>
          ) : (
            onLogout && (
              <button
                type="button"
                className="hu-sidebar__logout"
                onClick={onLogout}
              >
                Sair
              </button>
            )
          )}
        </div>
      )}
    </aside>
  );
}
