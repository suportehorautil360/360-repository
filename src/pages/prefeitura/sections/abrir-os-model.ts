export type ServiceTypeOs = "corrective" | "preventive" | "predictive";

export interface SolicitacaoOS {
  id: string;
  protocolo: string;
  /** ID do equipamento (Firestore) — usado na aba Garantia. */
  equipamentoId?: string;
  equipamento: string;
  linha: string;
  operador: string;
  relato: string;
  status: string;
  criadoEm: { seconds: number } | null;
  /** Tipo da O.S. (API: serviceType). */
  serviceType?: ServiceTypeOs;
  serviceTypeLabel?: string;
  /** Data agendada (YYYY-MM-DD). */
  dataAgendamento?: string;
  horimetro?: string;
  cicloId?: string;
  oficinas?: string[];
  oficinasIds?: string[];
  oficinasResponderam?: string[];
  convidadas?: number;
}

export type AbaOsForm = "geral" | "oficina" | "maquina-parada" | "garantia";

function mockTs(iso: string): { seconds: number } {
  return { seconds: Math.floor(new Date(iso).getTime() / 1000) };
}

export function gerarProtocoloOs(): string {
  const ano = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 900) + 100).padStart(3, "0");
  return `OS-${ano}-${seq}`;
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Dados de demonstração enquanto não houver OS no Firestore. */
export const OS_MOCKADAS: SolicitacaoOS[] = [
  {
    id: "mock-1",
    protocolo: "OS-2026-047",
    equipamento: "Sany SYL956H",
    linha: "Geral",
    operador: "maq03",
    relato: "caixa hidráulica",
    status: "aprovado",
    criadoEm: mockTs("2026-05-15"),
  },
  {
    id: "mock-2",
    protocolo: "OS-2026-357",
    equipamento: "Mercedes-Benz Atego 2730",
    linha: "Geral",
    operador: "João Silva",
    relato: "x.cbxm xl.zm",
    status: "aguardando_orcamento",
    criadoEm: mockTs("2026-05-15"),
  },
  {
    id: "mock-3",
    protocolo: "OS-2028-019",
    equipamento: "John Deere 310L",
    linha: "Geral",
    operador: "Jefferson Da Silva Lima",
    relato: "vazamento de óleo hidráulico",
    status: "aguardando_orcamento",
    criadoEm: mockTs("2026-05-15"),
  },
  {
    id: "mock-4",
    protocolo: "OS-2026-018",
    equipamento: "Scania R450",
    linha: "Pesada",
    operador: "Leandro",
    relato: "troca de freio dianteiro",
    status: "aguardando_orcamento",
    criadoEm: mockTs("2026-05-10"),
  },
  {
    id: "mock-5",
    protocolo: "OS-2026-017",
    equipamento: "Caterpillar 320",
    linha: "Amarela",
    operador: "JCB",
    relato: "revisão 1000h",
    status: "aprovado",
    criadoEm: mockTs("2026-05-03"),
  },
  {
    id: "mock-6",
    protocolo: "OS-2026-025",
    equipamento: "Retroescavadeira JCB 3CX",
    linha: "Geral",
    operador: "Mec. João",
    relato: "falha na transmissão — máquina parada",
    status: "aguardando_orcamento",
    criadoEm: mockTs("2026-06-08"),
  },
];

/** Garante lista mínima para demo: mocks inteiros se vazio, ou complementa com mocks. */
export function listaOsParaExibicao(
  rows: SolicitacaoOS[],
  minimo = 6,
): SolicitacaoOS[] {
  if (rows.length === 0) return OS_MOCKADAS;
  if (rows.length >= minimo) return rows;

  const protocolos = new Set(rows.map((r) => r.protocolo));
  const complemento = OS_MOCKADAS.filter((m) => !protocolos.has(m.protocolo));
  return [...rows, ...complemento].slice(0, Math.max(minimo, rows.length));
}

export function fmtDataOs(criadoEm: SolicitacaoOS["criadoEm"]): string {
  if (!criadoEm?.seconds) return "—";
  return new Date(criadoEm.seconds * 1000).toLocaleDateString("pt-BR");
}

export function fmtClassificacao(linha: string | undefined): string {
  const t = linha?.trim();
  if (!t) return "—";
  if (/^linha\s/i.test(t)) return t;
  return `Linha ${t}`;
}

export function fmtTipoOs(
  serviceType?: ServiceTypeOs,
  label?: string,
): string {
  if (label?.trim()) return label.trim();
  if (serviceType === "preventive") return "Preventiva";
  if (serviceType === "predictive") return "Preditiva";
  if (serviceType === "corrective") return "Corretiva";
  return "—";
}

export function fmtDataAgendamento(iso?: string): string {
  if (!iso?.trim()) return "—";
  const d = new Date(`${iso.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

export function totalOficinasConvidadas(os: SolicitacaoOS): number {
  return (
    os.convidadas ??
    os.oficinasIds?.length ??
    os.oficinas?.length ??
    0
  );
}

export function statusBadgeOs(status: string): { label: string; cls: string } {
  if (status === "aprovado") {
    return { label: "Aprovado", cls: "aos-status--aprovado" };
  }
  if (status === "aguardando_orcamento") {
    return { label: "Aguard. Orçamento", cls: "aos-status--aguard-orc" };
  }
  if (status === "aguardando_aprovacao") {
    return { label: "Aguard. Aprovação", cls: "aos-status--aguard-aprov" };
  }
  if (status === "recusado") {
    return { label: "Recusado", cls: "aos-status--recusado" };
  }
  return { label: status || "—", cls: "aos-status--outro" };
}

export type FiltroStatusOs = "todos" | "aprovado" | "aguardando_orcamento";

export interface FiltrosOsLista {
  dataInicio: string;
  dataFim: string;
  status: FiltroStatusOs;
}

function inicioDiaMs(iso: string): number | null {
  if (!iso.trim()) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function fimDiaMs(iso: string): number | null {
  if (!iso.trim()) return null;
  const d = new Date(`${iso}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** Filtra a lista por período (criadoEm) e status. */
export function filtrarOsLista(
  rows: SolicitacaoOS[],
  filtros: FiltrosOsLista,
): SolicitacaoOS[] {
  const ini = inicioDiaMs(filtros.dataInicio);
  const fim = fimDiaMs(filtros.dataFim);

  return rows.filter((os) => {
    if (filtros.status !== "todos" && os.status !== filtros.status) {
      return false;
    }

    if (ini === null && fim === null) return true;

    const ts = os.criadoEm?.seconds;
    if (ts == null) return false;
    const ms = ts * 1000;

    if (ini !== null && ms < ini) return false;
    if (fim !== null && ms > fim) return false;
    return true;
  });
}
