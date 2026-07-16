/**
 * Camada de dados de Frentes de Trabalho — fala com o backend NestJS
 * (módulos `work-front` e `allocation`), nunca com o Firestore direto.
 * Traduz o documento cru do banco para o modelo de UI.
 */
import { api, ApiError } from "../../../../lib/api/client";
import { toE164 } from "../../../../lib/phone";
import { formatBRL } from "../../../../utils/moeda";

export type FrenteStatus = "Ativa" | "Pausada" | "Concluída";

export const STATUS_FRENTE_OPTIONS: FrenteStatus[] = [
  "Ativa",
  "Pausada",
  "Concluída",
];

/** Equipamento alocado a uma frente (vem da coleção `allocations`). */
export interface FrenteEquip {
  /** id da alocação — usado para desalocar. */
  allocationId: string;
  vehicleId: string;
  placa: string;
  funcao: string;
  /** Data de início da alocação (DD/MM/YYYY, como gravada no backend). */
  desde: string;
  /** Nome do equipamento, resolvido pela lista de equipamentos. */
  nome: string;
}

export interface Frente {
  id: string;
  nome: string;
  endereco: string;
  responsavel: string;
  responsavelId: string;
  /** Telefone (WhatsApp) da frente, em E.164. "" quando não cadastrado. */
  telefone: string;
  /** Email da frente (responsável). "" quando não cadastrado. */
  email: string;
  status: FrenteStatus;
  custo: number;
  inicio: string; // ISO
  fim: string; // ISO ou ""
  criadoEm: string; // ISO
  equipamentos: FrenteEquip[];
}

/** Dados informados no modal de cadastro/edição. */
export interface NovaFrenteInput {
  nome: string;
  endereco: string;
  responsavel: string;
  responsavelId: string;
  /** Telefone (WhatsApp) em E.164, ou "" quando não informado. */
  telefone: string;
  /** Email da frente (responsável), ou "" quando não informado. */
  email: string;
  status: FrenteStatus;
  custo: number;
  inicio: string; // yyyy-mm-dd
  fim: string; // yyyy-mm-dd ou ""
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeStatus(value: unknown): FrenteStatus {
  const raw = asText(value).toLowerCase();
  if (raw.includes("pausa") || raw === "paused") return "Pausada";
  if (raw.includes("conclu") || raw.includes("finaliz") || raw === "done")
    return "Concluída";
  return "Ativa";
}

/** yyyy-mm-dd (input date) → ISO 8601, ou "" quando vazio. */
function dateInputToISO(value: string): string {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

interface ListaResponse {
  data: Array<Record<string, unknown> & { id?: string }>;
  message: string;
}

function normalizeEquip(raw: Record<string, unknown>): FrenteEquip {
  return {
    allocationId: asText(raw.id),
    vehicleId: asText(raw.vehicleId),
    placa: asText(raw.plate),
    funcao: asText(raw.function),
    desde: asText(raw.startDate),
    nome: asText(raw.name) || asText(raw.plate) || "Equipamento",
  };
}

function normalizeFrente(
  id: string,
  data: Record<string, unknown>,
): Frente {
  const equipamentosRaw = Array.isArray(data.equipamentos)
    ? (data.equipamentos as Record<string, unknown>[])
    : [];
  return {
    id: id || asText(data.id),
    nome: asText(data.name) || "Frente de trabalho",
    endereco: asText(data.address),
    responsavel: asText(data.responsible),
    responsavelId: asText(data.responsibleId),
    telefone: asText(data.telefone),
    email: asText(data.email),
    status: normalizeStatus(data.status),
    custo: asNumber(data.cost),
    inicio: asText(data.startDate),
    fim: asText(data.endDate),
    criadoEm: asText(data.createdAt),
    equipamentos: equipamentosRaw.map(normalizeEquip),
  };
}

function ordenar(lista: Frente[]): Frente[] {
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function mensagemErroSalvarFrente(
  err: unknown,
  editando: boolean,
): string {
  if (err instanceof ApiError && err.status === 400) {
    return err.message;
  }
  return editando
    ? "Não foi possível atualizar a frente de trabalho."
    : "Não foi possível criar a frente de trabalho.";
}

export const frentesApi = {
  /** Lista as frentes da prefeitura (404 → lista vazia). */
  async listar(prefeituraId: string): Promise<Frente[]> {
    try {
      const r = await api.get<ListaResponse>(`/work-front/${prefeituraId}`);
      return ordenar(
        (r.data ?? []).map((d) => normalizeFrente(String(d.id ?? ""), d)),
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return [];
      throw e;
    }
  },

  /** Cria uma frente de trabalho. */
  async criar(input: NovaFrenteInput, prefeituraId: string): Promise<void> {
    await api.post("/work-front", {
      name: input.nome.trim(),
      prefeituraId,
      address: input.endereco.trim(),
      responsible: input.responsavel.trim(),
      responsibleId: input.responsavelId,
      telefone: toE164(input.telefone) ?? "",
      email: input.email.trim(),
      equipaments: [],
      status: input.status,
      cost: input.custo,
      startDate: dateInputToISO(input.inicio),
      ...(input.fim ? { endDate: dateInputToISO(input.fim) } : {}),
    });
  },

  /** Atualiza os campos editáveis de uma frente (não toca nas alocações). */
  async atualizar(frenteId: string, input: NovaFrenteInput): Promise<void> {
    await api.patch(`/work-front/${frenteId}`, {
      name: input.nome.trim(),
      address: input.endereco.trim(),
      responsible: input.responsavel.trim(),
      responsibleId: input.responsavelId,
      telefone: toE164(input.telefone) ?? "",
      email: input.email.trim(),
      status: input.status,
      cost: input.custo,
      startDate: dateInputToISO(input.inicio),
      ...(input.fim ? { endDate: dateInputToISO(input.fim) } : {}),
    });
  },

  /** Remove a frente (o backend remove também as alocações vinculadas). */
  async remover(frenteId: string): Promise<void> {
    await api.del(`/work-front/${frenteId}`);
  },

  /**
   * Aloca um equipamento a uma frente. O backend trata "mover" (encerra a
   * alocação ativa anterior) e sincroniza o `obra` do equipamento.
   */
  async alocar(params: {
    frente: Frente;
    vehicleId: string;
    placa: string;
    funcao: string;
    prefeituraId: string;
    /** Data da alocação (yyyy-mm-dd). Padrão: hoje. */
    dataAlocacao?: string;
  }): Promise<void> {
    const { frente, vehicleId, placa, funcao, prefeituraId, dataAlocacao } =
      params;
    await api.post("/allocation", {
      vehicleId,
      workFrontId: frente.id,
      plate: placa,
      workFrontName: frente.nome,
      startDate: dataAlocacao ? dateInputToBR(dataAlocacao) : formatBR(new Date()),
      function: funcao.trim(),
      prefeituraId,
      currentWorkFront: { id: frente.id, name: frente.nome },
    });
  },

  /** Desaloca um equipamento (remove a alocação). */
  async desalocar(allocationId: string): Promise<void> {
    await api.del(`/allocation/${allocationId}`);
  },
};

/** Data → DD/MM/YYYY (formato esperado pelo backend de alocação). */
function formatBR(d: Date): string {
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getFullYear()}`;
}

/** yyyy-mm-dd (input date) → DD/MM/YYYY. "" quando vazio/ inválido. */
function dateInputToBR(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** ISO/data → DD/MM/YYYY para exibição (— quando vazio/ inválido). */
export function formatDataBR(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : formatBR(d);
}

/** ISO → yyyy-mm-dd (valor de <input type="date">), "" quando inválido. */
export function isoParaDateInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Custo numérico (reais) → "R$ 1.234,56" para o card. */
export function formatCustoBR(custo: number): string {
  return formatBRL(custo);
}
