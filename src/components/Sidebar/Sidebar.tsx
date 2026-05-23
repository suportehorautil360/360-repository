import { NavLink } from "react-router-dom";
import type { SidebarItem, SidebarProps } from "./types";
import "./sidebar.css";

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

      {user && (
        <div className="hu-sidebar__footer">
          <span className="hu-sidebar__avatar" aria-hidden="true">
            {user.initials ?? deriveInitials(user.name)}
          </span>
          <div className="hu-sidebar__user">
            <strong className="hu-sidebar__user-name">{user.name}</strong>
            {user.role && (
              <span className="hu-sidebar__user-role">{user.role}</span>
            )}
          </div>
          {onLogout && (
            <button
              type="button"
              className="hu-sidebar__logout"
              onClick={onLogout}
              title="Sair"
              aria-label="Sair"
            >
              ⎋
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
