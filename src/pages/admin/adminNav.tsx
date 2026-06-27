import type { SidebarBrand, SidebarGroup } from "../../components/Sidebar/types";
import { AdminIconDashboard, ClockLogo } from "./adminIcons";

export const ADMIN_BRAND: SidebarBrand = {
  logo: <ClockLogo />,
  title: (
    <>
      HORA <span className="accent">ÚTIL</span> 360
    </>
  ),
  subtitle: "Gestão de frota multimarcas",
};

export const ADMIN_NAV: SidebarGroup[] = [
  {
    label: "Principal",
    items: [
      {
        label: "Dashboard",
        to: "/admin/dashboard",
        icon: <AdminIconDashboard />,
        id: "nav-hub-dashboard",
      },
    ],
  },
  {
    label: "Gestão",
    items: [
      {
        label: "Clientes",
        to: "/admin/clientes",
        icon: "👥",
        id: "nav-hub-clientes",
      },
      {
        label: "Postos e oficinas",
        to: "/admin/parceiros",
        icon: "🏭",
        id: "nav-hub-parceiros",
      },
    ],
  },
  {
    label: "Controle",
    items: [
      {
        label: "Cadastro de clientes",
        to: "/admin/cadastros",
        icon: "📁",
      },
      {
        label: "Checklists",
        to: "/admin/checklists",
        icon: "✅",
        id: "nav-hub-checklists",
      },
      {
        label: "Funcionalidades",
        to: "/admin/funcionalidades",
        icon: "🧩",
        id: "nav-hub-funcionalidades",
      },
      {
        label: "Conexão WhatsApp",
        to: "/admin/whatsapp",
        icon: "💬",
        id: "nav-hub-whatsapp",
      },
      {
        label: "Suporte dos Postos",
        to: "/admin/suporte-postos",
        icon: "📨",
        id: "nav-hub-suporte-postos",
      },
      {
        label: "Cadastro de parceiros",
        to: "/admin/parceiros",
        icon: "🤝",
        id: "nav-hub-parceiros-cadastro",
      },
    ],
  },
  {
    label: "ERP",
    items: [
      {
        label: "Financeiro",
        to: "/admin/financeiro",
        icon: "💲",
        id: "nav-hub-financeiro",
      },
    ],
  },
];
