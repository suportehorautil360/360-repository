import type { SidebarBrand, SidebarGroup } from "../../components/Sidebar/types";
import {
  AdminIconCadastroClientes,
  AdminIconClientes,
  AdminIconDashboard,
  AdminIconFinanceiro,
  AdminIconFuncionalidades,
  AdminIconOficinasPostos,
  AdminIconParceiros,
  AdminIconWhatsapp,
  ClockLogo,
} from "./adminIcons";

export const ADMIN_BRAND: SidebarBrand = {
  logo: <ClockLogo />,
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
        icon: <AdminIconClientes />,
        id: "nav-hub-clientes",
      },
      {
        label: "Oficinas e postos",
        to: "/admin/oficinas-postos",
        icon: <AdminIconOficinasPostos />,
        id: "nav-hub-oficinas-postos",
      },
    ],
  },
  {
    label: "Controle",
    items: [
      {
        label: "Cadastro de clientes",
        to: "/admin/cadastros",
        icon: <AdminIconCadastroClientes />,
      },
      {
        label: "Funcionalidades",
        to: "/admin/funcionalidades",
        icon: <AdminIconFuncionalidades />,
        id: "nav-hub-funcionalidades",
      },
      {
        label: "Conexão WhatsApp",
        to: "/admin/whatsapp",
        icon: <AdminIconWhatsapp />,
        id: "nav-hub-whatsapp",
      },
      {
        label: "Cadastro de parceiros",
        to: "/admin/oficinas-postos",
        icon: <AdminIconParceiros />,
        id: "nav-hub-parceiros",
      },
    ],
  },
  {
    label: "ERP",
    items: [
      {
        label: "Financeiro",
        to: "/admin/financeiro",
        icon: <AdminIconFinanceiro />,
        id: "nav-hub-financeiro",
      },
    ],
  },
];
