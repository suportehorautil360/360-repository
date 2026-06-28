export type PainelGeralOs =
  | "insumos"
  | "etapas"
  | "sintomas"
  | "ocorrencias";

export interface InsumoRow {
  produto: string;
  descricao: string;
  qtd: number;
  unid: string;
  vlrUnit: number;
  total: number;
}

export interface EtapaRow {
  seq: string;
  descricao: string;
  tecnico: string;
  inicioPrevisto: string;
  status: string;
  statusCls: "pendente" | "aguardando";
}

export interface SintomaRow {
  cod: string;
  descricao: string;
  observacao: string;
}

export interface OcorrenciaRow {
  id: string;
  dataHora: string;
  usuario: string;
  mensagem: string;
}

export type TomOficina = "laranja" | "vermelho" | "verde";

export interface MaquinaParadaRow {
  os: string;
  equipamento: string;
  motivo: string;
  diasParado: number;
  horasTotais: number;
  oficina: string;
  tomOficina: TomOficina;
  diasDestaque?: boolean;
}

export const INSUMOS_MOCK: InsumoRow[] = [
  {
    produto: "00125",
    descricao: "Anel O-Ring Viton",
    qtd: 2,
    unid: "UN",
    vlrUnit: 15,
    total: 30,
  },
  {
    produto: "00489",
    descricao: "Óleo Hidráulico 68",
    qtd: 20,
    unid: "L",
    vlrUnit: 22,
    total: 440,
  },
];

export const ETAPAS_MOCK: EtapaRow[] = [
  {
    seq: "01",
    descricao: "Desmontagem do Cilindro",
    tecnico: "Mec. João",
    inicioPrevisto: "08/06/2026",
    status: "Pendente",
    statusCls: "pendente",
  },
  {
    seq: "02",
    descricao: "Troca de Vedação",
    tecnico: "Mec. João",
    inicioPrevisto: "09/06/2026",
    status: "Aguardando",
    statusCls: "aguardando",
  },
];

export function sintomasDeRelato(relato: string): SintomaRow[] {
  const texto = relato.trim();
  if (!texto) return [];

  const partes = texto
    .split(/\r?\n|;/)
    .map((p) => p.trim())
    .filter(Boolean);

  return partes.map((descricao, i) => ({
    cod: String(i + 1).padStart(2, "0"),
    descricao,
    observacao: "—",
  }));
}

export const SINTOMAS_MOCK: SintomaRow[] = [
  {
    cod: "S02",
    descricao: "Vazamento de fluido",
    observacao: "Poça de óleo sob o braço da escavadeira.",
  },
  {
    cod: "S15",
    descricao: "Perda de pressão",
    observacao: "Braço operando com lentidão.",
  },
];

export const OCORRENCIAS_MOCK: OcorrenciaRow[] = [
  {
    id: "1",
    dataHora: "08/06/2026 14:00",
    usuario: "ADM",
    mensagem: "Aguardando chegada do kit de vedações da filial 02.",
  },
  {
    id: "2",
    dataHora: "08/06/2026 10:00",
    usuario: "MEC_JOAO",
    mensagem: "Máquina lavada e pronta para início da inspeção.",
  },
];

export const MAQUINAS_PARADAS_MOCK: MaquinaParadaRow[] = [
  {
    os: "013295",
    equipamento: "Escavadeira hidráulica CAT 320",
    motivo:
      "Vazamento crítico no cilindro mestre do braço primário. Aguardando kit de vedações.",
    diasParado: 0,
    horasTotais: 9,
    oficina: "L. Amarela",
    tomOficina: "laranja",
  },
  {
    os: "013142",
    equipamento: "Retroescavadeira JCB 3CX",
    motivo:
      "Falha severa na transmissão e travamento do conversor de torque.",
    diasParado: 12,
    horasTotais: 288,
    oficina: "L. Amarela",
    tomOficina: "vermelho",
    diasDestaque: true,
  },
  {
    os: "013210",
    equipamento: "Motoniveladora John Deere 620G",
    motivo:
      "Revisão do sistema elétrico / módulo central e substituição do chicote principal.",
    diasParado: 4,
    horasTotais: 96,
    oficina: "L. Amarela",
    tomOficina: "laranja",
  },
  {
    os: "013254",
    equipamento: "Escavadeira Sany SY215C",
    motivo:
      "Troca preventiva e alinhamento de sapatas e roletes do conjunto de esteiras.",
    diasParado: 2,
    horasTotais: 48,
    oficina: "L. Amarela",
    tomOficina: "verde",
  },
];

export const PAINEL_META: Record<
  PainelGeralOs,
  { titulo: string; icone: string }
> = {
  insumos: { titulo: "Insumos (peças e materiais)", icone: "📦" },
  etapas: { titulo: "Etapas da manutenção", icone: "⏳" },
  sintomas: { titulo: "Sintomas e diagnóstico", icone: "🔍" },
  ocorrencias: { titulo: "Histórico de ocorrências", icone: "📄" },
};

export function fmtBRLPainel(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtQtdPainel(v: number): string {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function badgeOficinaCls(tom: TomOficina): string {
  if (tom === "vermelho") return "aos-mp-badge--vermelho";
  if (tom === "verde") return "aos-mp-badge--verde";
  return "aos-mp-badge--laranja";
}
