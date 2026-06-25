export interface SolicitacaoOrcamento {
  id: string;
  protocolo: string;
  equipamento: string;
  linha: string;
  operador: string;
  relato: string;
  oficinas?: string[];
  oficinasIds?: string[];
  oficinasResponderam?: string[];
  /** Total de oficinas convidadas (API: invitedCount). */
  convidadas?: number;
  status: string;
  criadoEm: { seconds: number } | null;
}

export interface ItemOrdemOrcamento {
  descricao: string;
  valor: number;
}

export interface OrdemOrcamento {
  id: string;
  protocolo: string;
  solicitacaoOsId: string;
  operador: string;
  oficinaNome?: string;
  oficinaId?: string;
  equipamento: string;
  defeito: string;
  itens: ItemOrdemOrcamento[];
  valorTotal: number;
  status: string;
  criadoEm: { seconds: number } | null;
}

function mockTs(iso: string): { seconds: number } {
  return { seconds: Math.floor(new Date(iso).getTime() / 1000) };
}

export function isMockRegistro(id: string): boolean {
  return id.startsWith("mock-");
}

/** Máximo de orçamentos por O.S. (oficinas convidadas na criação). */
export const LIMITE_ORCAMENTOS_POR_OS = 3;

export function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtDataOs(criadoEm: SolicitacaoOrcamento["criadoEm"]): string {
  if (!criadoEm?.seconds) return "—";
  return new Date(criadoEm.seconds * 1000).toLocaleDateString("pt-BR");
}

export function fmtLinha(linha: string | undefined): string {
  const t = linha?.trim();
  if (!t) return "—";
  if (/^linha\s/i.test(t)) return t;
  return `Linha ${t}`;
}

export function statusSolicitacao(
  status: string,
): { label: string; cls: string } {
  if (status === "aprovado") {
    return { label: "Aprovado", cls: "oap-badge--aprovado" };
  }
  if (status === "aguardando_orcamento" || status === "em_orcamento") {
    return { label: "Aguardando Orçamento", cls: "oap-badge--aguard-orc" };
  }
  if (status === "aguardando_aprovacao" || status === "em_pregao") {
    return { label: "Aguardando Aprovação", cls: "oap-badge--aguard-aprov" };
  }
  if (status === "recusado") {
    return { label: "Recusado", cls: "oap-badge--recusado" };
  }
  return { label: status || "—", cls: "oap-badge--outro" };
}

export function statusOrdem(status: string): { label: string; cls: string } {
  if (status === "aprovado") {
    return { label: "Aprovado", cls: "oap-ordem--aprovado" };
  }
  if (status === "recusado") {
    return { label: "Recusado", cls: "oap-ordem--recusado" };
  }
  if (status === "aguardando_aprovacao") {
    return { label: "Pendente", cls: "oap-ordem--pendente" };
  }
  if (status === "em_pregao") {
    return { label: "Em pregão", cls: "oap-ordem--pregao" };
  }
  return { label: status || "—", cls: "oap-ordem--outro" };
}

export const SOLICITACOES_MOCK: SolicitacaoOrcamento[] = [
  {
    id: "mock-sol-1",
    protocolo: "OS-2026-047",
    equipamento: "Sany SYL956H",
    linha: "Amarela",
    operador: "maq03",
    relato: "caixa hidráulica",
    oficinas: ["Avantec", "Gava", "Marni"],
    oficinasIds: ["of-1", "of-2", "of-3"],
    status: "aprovado",
    criadoEm: mockTs("2026-05-15"),
  },
  {
    id: "mock-sol-2",
    protocolo: "OS-2026-357",
    equipamento: "Mercedes-Benz Atego 2730",
    linha: "Geral",
    operador: "João Silva",
    relato: "x.cbxm xl.zm",
    oficinas: ["Oficina A", "Oficina B", "Oficina C"],
    oficinasIds: ["of-a", "of-b", "of-c"],
    status: "aguardando_orcamento",
    criadoEm: mockTs("2026-05-15"),
  },
  {
    id: "mock-sol-3",
    protocolo: "OS-2026-019",
    equipamento: "John Deere 310L",
    linha: "Geral",
    operador: "Jefferson Da Silva Lima",
    relato: "vazamento de óleo hidráulico",
    oficinas: ["Oficina A", "Oficina B", "Oficina C"],
    oficinasIds: ["of-a", "of-b", "of-c"],
    status: "aguardando_orcamento",
    criadoEm: mockTs("2026-05-15"),
  },
  {
    id: "mock-sol-4",
    protocolo: "OS-2026-018",
    equipamento: "Scania R450",
    linha: "Pesada",
    operador: "Leandro",
    relato: "troca de freio dianteiro",
    oficinas: ["Oficina A", "Oficina B", "Oficina C"],
    oficinasIds: ["of-a", "of-b", "of-c"],
    oficinasResponderam: ["of-a", "of-b"],
    status: "aguardando_aprovacao",
    criadoEm: mockTs("2026-05-10"),
  },
  {
    id: "mock-sol-5",
    protocolo: "OS-2026-017",
    equipamento: "Caterpillar 320",
    linha: "Amarela",
    operador: "JCB",
    relato: "revisão 1000h",
    oficinas: ["Avantec", "Gava", "Marni"],
    oficinasIds: ["of-1", "of-2", "of-3"],
    status: "aprovado",
    criadoEm: mockTs("2026-05-03"),
  },
];

export const ORDENS_MOCK: OrdemOrcamento[] = [
  {
    id: "mock-ord-1",
    protocolo: "ORC-047-A",
    solicitacaoOsId: "mock-sol-1",
    operador: "Avantec",
    oficinaNome: "Avantec",
    equipamento: "Sany SYL956H",
    defeito: "caixa hidráulica",
    itens: [
      { descricao: "Kit reparo caixa hidráulica", valor: 4200 },
      { descricao: "Mão de obra", valor: 1800 },
    ],
    valorTotal: 6000,
    status: "aprovado",
    criadoEm: mockTs("2026-05-16"),
  },
  {
    id: "mock-ord-2",
    protocolo: "ORC-047-B",
    solicitacaoOsId: "mock-sol-1",
    operador: "Gava",
    oficinaNome: "Gava",
    equipamento: "Sany SYL956H",
    defeito: "caixa hidráulica",
    itens: [{ descricao: "Serviço completo", valor: 7200 }],
    valorTotal: 7200,
    status: "recusado",
    criadoEm: mockTs("2026-05-16"),
  },
  {
    id: "mock-ord-3",
    protocolo: "ORC-047-C",
    solicitacaoOsId: "mock-sol-1",
    operador: "Marni",
    oficinaNome: "Marni",
    equipamento: "Sany SYL956H",
    defeito: "caixa hidráulica",
    itens: [{ descricao: "Serviço completo", valor: 6800 }],
    valorTotal: 6800,
    status: "recusado",
    criadoEm: mockTs("2026-05-17"),
  },
  {
    id: "mock-ord-4",
    protocolo: "ORC-018-A",
    solicitacaoOsId: "mock-sol-4",
    operador: "Oficina A",
    oficinaNome: "Oficina A",
    equipamento: "Scania R450",
    defeito: "troca de freio dianteiro",
    itens: [
      { descricao: "Pastilha de freio dianteira", valor: 890 },
      { descricao: "Mão de obra", valor: 450 },
    ],
    valorTotal: 1340,
    status: "aguardando_aprovacao",
    criadoEm: mockTs("2026-05-11"),
  },
  {
    id: "mock-ord-5",
    protocolo: "ORC-018-B",
    solicitacaoOsId: "mock-sol-4",
    operador: "Oficina B",
    oficinaNome: "Oficina B",
    equipamento: "Scania R450",
    defeito: "troca de freio dianteiro",
    itens: [{ descricao: "Kit freio completo", valor: 2100 }],
    valorTotal: 2100,
    status: "aguardando_aprovacao",
    criadoEm: mockTs("2026-05-12"),
  },
  {
    id: "mock-ord-6",
    protocolo: "ORC-017-A",
    solicitacaoOsId: "mock-sol-5",
    operador: "Avantec",
    oficinaNome: "Avantec",
    equipamento: "Caterpillar 320",
    defeito: "revisão 1000h",
    itens: [{ descricao: "Revisão 1000h", valor: 3500 }],
    valorTotal: 3500,
    status: "aprovado",
    criadoEm: mockTs("2026-05-04"),
  },
  {
    id: "mock-ord-7",
    protocolo: "ORC-017-B",
    solicitacaoOsId: "mock-sol-5",
    operador: "Gava",
    oficinaNome: "Gava",
    equipamento: "Caterpillar 320",
    defeito: "revisão 1000h",
    itens: [{ descricao: "Revisão 1000h", valor: 4100 }],
    valorTotal: 4100,
    status: "recusado",
    criadoEm: mockTs("2026-05-04"),
  },
  {
    id: "mock-ord-8",
    protocolo: "ORC-017-C",
    solicitacaoOsId: "mock-sol-5",
    operador: "Marni",
    oficinaNome: "Marni",
    equipamento: "Caterpillar 320",
    defeito: "revisão 1000h",
    itens: [{ descricao: "Revisão 1000h", valor: 3800 }],
    valorTotal: 3800,
    status: "recusado",
    criadoEm: mockTs("2026-05-05"),
  },
];

/** Usa mocks se Firestore vazio; senão mescla solicitações reais com mocks de demo. */
export function listaSolicitacoesParaExibicao(
  rows: SolicitacaoOrcamento[],
  minimo = 3,
): SolicitacaoOrcamento[] {
  if (rows.length === 0) return SOLICITACOES_MOCK;
  if (rows.length >= minimo) return rows;
  const protocolos = new Set(rows.map((r) => r.protocolo));
  const extra = SOLICITACOES_MOCK.filter((m) => !protocolos.has(m.protocolo));
  return [...rows, ...extra].slice(0, Math.max(minimo, rows.length));
}

export function ordensParaExibicao(
  ordensReais: OrdemOrcamento[],
  solicitacoes: SolicitacaoOrcamento[],
  mockOrdens: OrdemOrcamento[] = ORDENS_MOCK,
): OrdemOrcamento[] {
  const idsReais = new Set(
    solicitacoes.filter((s) => !isMockRegistro(s.id)).map((s) => s.id),
  );
  const ordensReaisFiltradas = ordensReais.filter((o) =>
    idsReais.has(o.solicitacaoOsId),
  );
  const mockSolIds = new Set(
    solicitacoes.filter((s) => isMockRegistro(s.id)).map((s) => s.id),
  );
  const ordensMock = mockOrdens.filter((o) => mockSolIds.has(o.solicitacaoOsId));
  return [...ordensReaisFiltradas, ...ordensMock];
}

/** Quantidade máxima de orçamentos exibida no card (regra: até 3 oficinas). */
export function totalConvidadas(sol: SolicitacaoOrcamento): number {
  return (
    sol.convidadas ??
    sol.oficinasIds?.length ??
    sol.oficinas?.length ??
    LIMITE_ORCAMENTOS_POR_OS
  );
}

/** Oficinas efetivamente convidadas nesta O.S. (para detalhes/modal). */
export function oficinasConvidadas(sol: SolicitacaoOrcamento): number {
  return (
    sol.oficinasIds?.length ??
    sol.oficinas?.length ??
    sol.convidadas ??
    0
  );
}

export function prontoParaAprovar(
  sol: SolicitacaoOrcamento,
  ordens: OrdemOrcamento[],
): boolean {
  return ordens.some((o) => podeAprovarOrcamento(sol, o));
}

const STATUS_SOL_BLOQUEIA_APROVACAO = new Set([
  "aprovado",
  "concluido",
  "recusado",
]);

/** Orçamento elegível para PATCH /aprovar (inclui em_pregao do back atual). */
export function podeAprovarOrcamento(
  sol: SolicitacaoOrcamento,
  ord: OrdemOrcamento,
): boolean {
  if (STATUS_SOL_BLOQUEIA_APROVACAO.has(sol.status)) return false;
  if (ord.status === "aprovado" || ord.status === "recusado") return false;
  return ord.status === "aguardando_aprovacao" || ord.status === "em_pregao";
}
