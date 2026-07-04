import type {
  SidebarBrand,
  SidebarGroup,
} from "../../components/Sidebar/types";

/** Slugs das seções com tela de verdade (o resto é placeholder "em construção"). */
export const SECOES_REAIS = new Set([
  "dashboard",
  "abastecimento-visao-geral",
  "consumo-custo",
  "credito",
  "abastecimento",
  "lubrificacao",
  "cargas-comboio",
  "postos",
  "notas-fiscais",
  "frota",
  "revisoes",
  "preventiva",
  "equipamentos",
  "cadastros",
  "funcionarios",
  "abrir-os",
  "plano-preventivo",
  "orcamentos",
  "notas-fiscais-oficinas",
  "pagamentos",
  "auditoria-devolucao",
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
  "abastecimento-visao-geral": "Visão Geral",
  "consumo-custo": "Consumo / Custo",
  credito: "Crédito",
  abastecimento: "Abastecimentos",
  lubrificacao: "Lubrificação",
  "cargas-comboio": "Cargas do Comboio",
  postos: "Postos Cadastrados",
  "notas-fiscais": "Notas Fiscais",
  tanques: "Tanques",
  frota: "Frota",
  "frentes-trabalho": "Frentes de Trabalho",
  alocacao: "Alocação",
  revisoes: "Preventiva",
  preventiva: "Revisões",
  "custos-obra": "Custos por obra",
  "gastos-gerais": "Gastos Gerais",
  pagamentos: "Demonstrativo de Pagamentos",
  garantias: "Garantias e Comparativo",
  "painel-geral": "Painel Geral",
  equipamentos: "Equipamentos",
  cadastros: "Cadastros",
  funcionarios: "Funcionários",
  "abrir-os": "Abrir OS",
  "plano-preventivo": "Plano preventivo",
  orcamentos: "Orçamentos e Aprovações",
  "notas-fiscais-oficinas": "Notas Fiscais (Oficinas)",
  "auditoria-devolucao": "Auditoria de Devolução",
  "auditoria-checklists": "Auditoria de Checklists",
  riscos: "Triagem de Riscos",
  emergencia: "Emergência",
  "pontos-rh": "Pontos (RH)",
  "solicitacoes-ponto": "Solicitações de Ponto",
  configuracoes: "Configurações",
};

export const PREFEITURA_BRAND: SidebarBrand = {
  logo: (
    <img
      src="/logo.png"
      alt="Hora Útil 360"
      style={{
        display: "block",
        width: "60%",
        maxWidth: "150px",
        margin: "0 auto",
        borderRadius: "12px",
      }}
    />
  ),
  title: "",
};

export interface PrefeituraNavBadges {
  /** Batidas de ponto pendentes (RH). */
  pontosRh?: number;
  /** Veículos com revisão vencida. */
  revisoes?: number;
  /** CHDs de devolução ainda não conferidos. */
  auditoriaDevolucao?: number;
}

/** Monta os grupos da sidebar da prefeitura, com as rotas /prefeitura/:id/<slug>. */
export function prefeituraNav(
  prefeituraId: string,
  opts?: {
    flags?: Record<string, boolean>;
    badges?: PrefeituraNavBadges;
  },
): SidebarGroup[] {
  const to = (slug: string) => `/prefeitura/${prefeituraId}/${slug}`;
  const flags = opts?.flags ?? {};
  const pontoAtivo = flags.ponto ?? false;
  const abastecimentoAtivo = flags.abastecimento ?? false;
  const frotaAtivo = flags.frota ?? true;
  const manutencaoAtivo = flags.manutencao ?? true;
  const pessoasAtivo = flags.pessoas ?? true;
  const qualidadeAtivo = flags.qualidade ?? true;
  const badges = opts?.badges ?? {};

  const grupos: SidebarGroup[] = [
    {
      label: "Principal",
      items: [{ label: "Painel", to: to("dashboard"), icon: "📊" }],
    },
    ...(abastecimentoAtivo
      ? [
          {
            label: "Abastecimento",
            items: [
              {
                label: "Visão Geral",
                to: to("abastecimento-visao-geral"),
                icon: "📈",
              },
              { label: "Abastecimentos", to: to("abastecimento"), icon: "⛽" },
              { label: "Consumo / Custo", to: to("consumo-custo"), icon: "💵" },
              { label: "Crédito", to: to("credito"), icon: "💳" },
              { label: "Lubrificação", to: to("lubrificacao"), icon: "🛢️" },
              {
                label: "Cargas do Comboio",
                to: to("cargas-comboio"),
                icon: "🚛",
              },
              { label: "Postos", to: to("postos"), icon: "🏪" },
              { label: "Notas Fiscais", to: to("notas-fiscais"), icon: "📄" },
            ],
          },
        ]
      : []),
    ...(frotaAtivo
      ? [
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
        ]
      : []),
    ...(manutencaoAtivo
      ? [
          {
            label: "Manutenção",
            items: [
              {
                label: "Abrir OS",
                to: to("abrir-os"),
                icon: "📄",
              },
              {
                label: "Plano preventivo",
                to: to("plano-preventivo"),
                icon: "📅",
              },
              {
                label: "Preventiva",
                to: to("revisoes"),
                icon: "🔧",
                badge: badges.revisoes,
                badgeTone: "warning" as const,
              },
              {
                label: "Revisões",
                to: to("preventiva"),
                icon: "🛠️",
              },
              {
                label: "Auditoria de Devolução",
                to: to("auditoria-devolucao"),
                icon: "📋",
                badge: badges.auditoriaDevolucao,
                badgeTone: "primary" as const,
              },
              {
                label: "Orçamentos e Aprovações",
                to: to("orcamentos"),
                icon: "💰",
              },
              {
                label: "Notas Fiscais",
                to: to("notas-fiscais-oficinas"),
                icon: "🧾",
              },
            ],
          },
        ]
      : []),
    ...(pessoasAtivo
      ? [
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
        ]
      : []),
    ...(qualidadeAtivo
      ? [
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
        ]
      : []),
    {
      label: "Sistema",
      items: [
        { label: "Configurações", to: to("configuracoes"), icon: "⚙️" },
      ],
    },
  ];

  return grupos;
}
