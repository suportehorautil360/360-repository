import type { SidebarBrand, SidebarGroup } from "../../components/Sidebar/types";

/** Logo (engrenagem) da marca HORA ÚTIL 360. */
function GearLogo() {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="3" />
      <circle cx="24" cy="24" r="7" stroke="var(--primary, #f97316)" strokeWidth="3" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        const x1 = 24 + Math.cos(a) * 14;
        const y1 = 24 + Math.sin(a) * 14;
        const x2 = 24 + Math.cos(a) * 20;
        const y2 = 24 + Math.sin(a) * 20;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

export const ADMIN_BRAND: SidebarBrand = {
  logo: <GearLogo />,
  title: (
    <>
      HORA <span className="accent">ÚTIL</span>{" "}
      <span className="accent-2">360</span>
    </>
  ),
  subtitle: "Gestão de frota multimarcas",
};

export const ADMIN_NAV: SidebarGroup[] = [
  {
    label: "Gestão de Frota",
    items: [
      {
        label: "Frota",
        to: "/admin/frota",
        icon: "🚚",
        id: "nav-hub-frota",
      },
    ],
  },
  {
    label: "Principal",
    items: [
      {
        label: "Dashboard",
        to: "/admin/dashboard",
        icon: "📊",
        id: "nav-hub-dashboard",
      },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Portal Oficina", to: "/admin/portal-oficina", icon: "🔧" },
      { label: "Painel Locação", to: "/admin/portal-locacao", icon: "📦" },
      { label: "Portal Posto", to: "/admin/portal-posto-admin", icon: "⛽" },
      {
        label: "Oficinas e postos",
        to: "/admin/oficinas-postos",
        icon: "🏭",
        id: "nav-hub-oficinas-postos",
      },
    ],
  },
  {
    label: "Controle",
    items: [
      { label: "Cadastro de clientes", to: "/admin/cadastros", icon: "🗂️" },
      { label: "Acessos e logins", to: "/admin/usuarios", icon: "🔐" },
      {
        label: "Funcionalidades",
        to: "/admin/funcionalidades",
        icon: "🎛️",
        id: "nav-hub-funcionalidades",
      },
      {
        label: "Equipamentos locação",
        to: "/admin/equipamentos-locacao",
        icon: "🚜",
        id: "nav-hub-equipamentos-locacao",
      },
    ],
  },
];
