import type {
  SidebarBrand,
  SidebarGroup,
} from "../../components/Sidebar/types";

/** Slugs das seções com tela de verdade (o resto é placeholder "em construção"). */
export const SECOES_REAIS = new Set([
  "dashboard",
  "abastecimento",
  "frota",
  "revisoes",
  "preventiva",
  "equipamentos",
  "cadastros",
  "funcionarios",
  "abrir-os",
  "orcamentos",
  "pagamentos",
  "auditoria-checklists",
  "riscos",
  "emergencia",
  "pontos-rh",
  "solicitacoes-ponto",
  "configuracoes",
]);

/** Rótulo legível por slug (usado no título do placeholder também). */
export const SECAO_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  abastecimento: "Abastecimentos",
  tanques: "Tanques",
  frota: "Frota",
  "frentes-trabalho": "Frentes de Trabalho",
  alocacao: "Alocação",
  revisoes: "Revisões",
  preventiva: "Preventiva",
  "custos-obra": "Custos por obra",
  "gastos-gerais": "Gastos Gerais",
  pagamentos: "Demonstrativo de Pagamentos",
  garantias: "Garantias e Comparativo",
  "painel-geral": "Painel Geral",
  equipamentos: "Equipamentos",
  cadastros: "Cadastros",
  funcionarios: "Funcionários",
  "abrir-os": "Abrir O.S.",
  orcamentos: "Orçamentos e Aprovações",
  "auditoria-devolucao": "Auditoria de Devolução",
  "auditoria-checklists": "Auditoria de Checklists",
  riscos: "Triagem de Riscos",
  emergencia: "Emergência",
  "pontos-rh": "Pontos (RH)",
  "solicitacoes-ponto": "Solicitações de Ponto",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
};

export const PREFEITURA_BRAND: SidebarBrand = {
  title: (
    <>
      HORA <span className="accent">ÚTIL</span>{" "}
      <span className="accent-2">360</span>
    </>
  ),
  subtitle: "Frota · Frentes de trabalho · Abastecimento",
};

export interface PrefeituraNavBadges {
  /** Batidas de ponto pendentes (RH). */
  pontosRh?: number;
  /** Veículos com revisão vencida. */
  revisoes?: number;
}

/** Monta os grupos da sidebar da prefeitura, com as rotas /prefeitura/:id/<slug>. */
export function prefeituraNav(
  prefeituraId: string,
  opts?: { pontoAtivo?: boolean; badges?: PrefeituraNavBadges },
): SidebarGroup[] {
  const to = (slug: string) => `/prefeitura/${prefeituraId}/${slug}`;
  const pontoAtivo = opts?.pontoAtivo ?? false;
  const badges = opts?.badges ?? {};

  const grupos: SidebarGroup[] = [
    {
      label: "Principal",
      items: [{ label: "Painel", to: to("dashboard"), icon: "📊" }],
    },
    {
      label: "Gestão de Frota",
      items: [
        // Equipamentos absorve o antigo "Frota" (mesma função).
        { label: "Equipamentos", to: to("equipamentos"), icon: "🛠️" },
        {
          label: "Frentes de Trabalho",
          to: to("frentes-trabalho"),
          icon: "🏗️",
        },
        { label: "Alocação", to: to("alocacao"), icon: "📋" },
      ],
    },
    {
      label: "Pessoas / RH",
      items: [
        { label: "Funcionários", to: to("funcionarios"), icon: "👷" },
        ...(pontoAtivo
          ? [
              {
                label: "Pontos (RH)",
                to: to("pontos-rh"),
                icon: "🕐",
                badge: badges.pontosRh,
                badgeTone: "danger" as const,
              },
              {
                label: "Solicitações de Ponto",
                to: to("solicitacoes-ponto"),
                icon: "📨",
              },
            ]
          : []),
      ],
    },
    {
      label: "Qualidade e Segurança",
      items: [
        {
          label: "Auditoria de Checklists",
          to: to("auditoria-checklists"),
          icon: "✅",
        },
        { label: "Triagem de Riscos", to: to("riscos"), icon: "⚠️" },
        { label: "Emergência", to: to("emergencia"), icon: "🚨" },
      ],
    },
    {
      label: "Sistema",
      items: [
        { label: "Relatórios", to: to("relatorios"), icon: "📥" },
        { label: "Configurações", to: to("configuracoes"), icon: "⚙️" },
      ],
    },
  ];

  return grupos;
}
