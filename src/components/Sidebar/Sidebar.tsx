import { NavLink } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
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

function groupValue(label: string | undefined, index: number) {
  return label?.trim() || `group-${index}`;
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
  topActions,
  className,
}: SidebarProps) {
  const hasBrandText =
    (brand.title != null && brand.title !== "") || brand.subtitle != null;

  return (
    <aside className={`hu-sidebar ${className ?? ""}`}>
      <div className="hu-sidebar__brand">
        {brand.logo != null && (
          <span
            className="hu-sidebar__brand-logo"
            aria-hidden={hasBrandText ? true : undefined}
          >
            {brand.logo}
          </span>
        )}
        {hasBrandText && (
          <div className="hu-sidebar__brand-text">
            <strong className="hu-sidebar__brand-title">{brand.title}</strong>
            {brand.subtitle != null && (
              <span className="hu-sidebar__brand-subtitle">
                {brand.subtitle}
              </span>
            )}
          </div>
        )}
        {topActions != null && (
          <div className="hu-sidebar__brand-actions">{topActions}</div>
        )}
      </div>

      <nav className="hu-sidebar__nav" aria-label="Menu principal">
        <Accordion
          type="multiple"
          defaultValue={[]}
          className="hu-sidebar__accordion"
        >
          {groups.map((group, gi) => {
            const value = groupValue(group.label, gi);

            if (!group.label) {
              return (
                <div
                  className="hu-sidebar__group hu-sidebar__group--plain"
                  key={value}
                >
                  <div className="hu-sidebar__group-items">
                    {group.items.map((item) => (
                      <SidebarLink key={item.to} item={item} />
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <AccordionItem
                className={`hu-sidebar__group ${
                  group.locked ? "is-locked" : ""
                }`}
                key={value}
                value={value}
                disabled={group.locked}
              >
                <AccordionTrigger
                  className="hu-sidebar__group-trigger"
                  title={
                    group.locked
                      ? "Seu cargo não tem acesso a esta área"
                      : undefined
                  }
                >
                  <span className="hu-sidebar__group-label">{group.label}</span>
                  {group.locked && (
                    <span
                      className="hu-sidebar__group-lock"
                      aria-hidden="true"
                    >
                      🔒
                    </span>
                  )}
                </AccordionTrigger>
                <AccordionContent className="hu-sidebar__group-content">
                  <div className="hu-sidebar__group-items">
                    {group.items.map((item) => (
                      <SidebarLink key={item.to} item={item} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
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
