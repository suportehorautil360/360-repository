import type { ReactNode } from "react";

/** Cor do badge de contagem ao lado de um item. */
export type SidebarBadgeTone = "danger" | "warning" | "primary";

export interface SidebarItem {
  /** Texto do item. */
  label: string;
  /** Rota de destino (usa <NavLink>). */
  to: string;
  /** Ícone à esquerda (emoji, SVG, qualquer ReactNode). Opcional. */
  icon?: ReactNode;
  /** Contador exibido à direita (ex.: notificações pendentes). */
  badge?: number | string;
  /** Cor do badge. Padrão: "danger". */
  badgeTone?: SidebarBadgeTone;
  /** Casa a rota de forma exata (NavLink end). */
  end?: boolean;
  /** id opcional no anchor (mantém compat com seletores legados). */
  id?: string;
}

export interface SidebarGroup {
  /** Título da seção (ex.: "PRINCIPAL"). Omitir para grupo sem rótulo. */
  label?: string;
  items: SidebarItem[];
  locked?: boolean;
}

export interface SidebarBrand {
  /** Logo/ícone da marca. */
  logo?: ReactNode;
  /** Título (pode conter spans coloridos). */
  title: ReactNode;
  /** Subtítulo curto abaixo do título. */
  subtitle?: ReactNode;
}

export interface SidebarUser {
  name: string;
  role?: string;
  /** Iniciais do avatar. Se ausente, derivamos do nome. */
  initials?: string;
}

export interface SidebarProps {
  brand: SidebarBrand;
  groups: SidebarGroup[];
  user?: SidebarUser;
  /** Ação de logout — renderiza o botão de sair no rodapé quando definida. */
  onLogout?: () => void;
  /** Ações no topo (ex.: sino/drawer de notificações). */
  topActions?: ReactNode;
  /** Classe extra no <aside>. */
  className?: string;
}
