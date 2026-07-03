/** Abastecimentos da prefeitura — módulo `abastecimentos` do back-360-. */
import { api } from "./client";

export type OrigemAbastecimento = "comboio" | "posto";
export type UnidadeLeitura = "km" | "h";

export interface Abastecimento {
  id: string;
  data: string; // YYYY-MM-DD
  hora: string;
  origem: OrigemAbastecimento;
  veiculo: string;
  placa: string;
  tipoVeiculo: string;
  combustivel: string;
  litros: number;
  /** Valor total em número (0 quando comboio). */
  valor: number;
  leitura: number; // km ou horas
  leituraUnidade: UnidadeLeitura;
  local: string;
  /** Id do comboio cujo tanque foi debitado (ou do comboio operado). */
  comboioId: string;
  /** Id do funcionário (comboista) que registrou. */
  funcionarioId: string;
  /** Nome do comboio resolvido (preenchido na tela). */
  comboio: string;
  /** Nome do comboista resolvido (preenchido na tela). */
  comboista: string;
  // Compat com consumidores atuais (dashboard, relatórios):
  km: number;
  postoNome: string;
  status: string;
}

function resolveValor(
  d: Record<string, unknown>,
  origem: OrigemAbastecimento,
): number {
  if (origem === "comboio") return 0;

  const direto = parseValorAbastecimento(
    d.value ?? d.total ?? d.valor ?? d.valorTotal,
  );
  if (direto != null && direto > 0) return direto;

  const ppl = Number(d.pricePerLiter);
  const lit = Number(d.liters ?? d.litros);
  if (
    Number.isFinite(ppl) &&
    ppl > 0 &&
    Number.isFinite(lit) &&
    lit > 0
  ) {
    return Math.round(ppl * lit * 100) / 100;
  }

  return direto ?? 0;
}

/** Converte "R$ 1.234,56" (ou número) em número. */
function parseValorAbastecimento(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const limpo = v.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Rótulo da coluna Total no painel (comboio vs valor vs ausente). */
export function fmtTotalAbastecimento(a: Abastecimento): string {
  if (a.origem === "comboio") return "Comboio";
  if (a.valor > 0) {
    return a.valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  }
  return "Sem valor";
}

export function totalAbastecimentoEhComboio(a: Abastecimento): boolean {
  return a.origem === "comboio";
}

/** Normaliza status do back (en/pt) para classes do painel. */
function normalizeStatus(
  raw: unknown,
  origem: OrigemAbastecimento,
): string {
  const s = asStr(raw).toLowerCase();
  if (s === "pendente_aprovacao" || s === "pendente") return "pendente";
  if (s === "rejeitado" || s === "irregular") return "irregular";
  if (s === "aprovado") return "aprovado";
  if (origem === "posto" || origem === "comboio") return "aprovado";
  return "";
}

function resolveCombustivel(d: Record<string, unknown>): string {
  const vehicle = (d.vehicle ?? null) as Record<string, unknown> | null;
  return (
    asStr(d.fuelType ?? d.combustivel ?? d.tipoCombustivel ?? vehicle?.fuelType) ||
    "—"
  );
}

function asStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

/** ISO ("2026-06-10T16:30:50Z") → "YYYY-MM-DD" (calendário local); "" se inválido. */
function isoDateFrom(iso: string): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISO → "HH:MM" (pt-BR, local); "" se inválido. */
function horaFrom(iso: string): string {
  if (!iso) return "";
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime())
    ? ""
    : dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Normaliza um registro do back-360- (`formatAbastecimento`, campos em inglês)
 * para o shape `Abastecimento`. Mantém fallbacks em português para qualquer
 * caminho legado (ex.: leitura direta do Firestore).
 */
function fromDoc(d: Record<string, unknown> & { id?: string }): Abastecimento {
  const vehicle = (d.vehicle ?? null) as Record<string, unknown> | null;
  const createdAt = asStr(d.createdAt);
  const origem = classificarOrigemAbastecimento(
    asStr(d.origin ?? d.origem),
    (d.postoId ?? d.posto_id ?? null) as string | null,
    (d.comboioId ?? null) as string | null,
  );
  const leituraUnidade: UnidadeLeitura =
    d.measurementType === "horimetro" ||
    d.leituraUnidade === "h" ||
    (origem === "comboio" &&
      d.measurementType == null &&
      d.leituraUnidade == null)
      ? "h"
      : "km";
  const leitura = Number(d.currentReading ?? d.leitura ?? d.km) || 0;
  const valor = resolveValor(d, origem);
  const local = asStr(d.local ?? d.postoNome);
  return {
    id: asStr(d.id),
    data: asStr(d.data) || isoDateFrom(createdAt),
    hora: asStr(d.hora) || horaFrom(createdAt),
    origem,
    veiculo: asStr(d.veiculo ?? vehicle?.name),
    placa: asStr(d.placa ?? vehicle?.plate),
    tipoVeiculo: asStr(d.tipoVeiculo ?? d.tipo ?? vehicle?.type),
    combustivel: resolveCombustivel(d),
    litros: Number(d.litros ?? d.liters) || 0,
    valor,
    leitura,
    leituraUnidade,
    local,
    comboioId: asStr(d.comboioId),
    funcionarioId: asStr(d.funcionarioId),
    comboio: "",
    comboista: "",
    km: leituraUnidade === "km" ? leitura : 0,
    postoNome: asStr(d.postoNome ?? local),
    status: normalizeStatus(d.status, origem),
  };
}

/** Item da listagem por período (GET com startDate/endDate). */
export interface AbastecimentoListaApi {
  id: string;
  dateTime: string;
  vehicle: {
    name: string;
    plate: string;
    type: string;
  };
  origin: string;
  /** Posto credenciado; quando preenchido, origin costuma ser "Posto {nome}". */
  postoId?: string | null;
  liters: number;
  value: number | null;
  reading: string;
  meterPhoto?: string;
  local: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
}

/** Registro normalizado para a tela de abastecimentos da prefeitura. */
export interface AbastecimentoTela {
  id: string;
  data: string;
  veiculo: string;
  placa: string;
  tipoVeiculo: string;
  origemTipo: OrigemAbastecimento;
  origemNome: string;
  litros: number;
  valor: number | null;
  leitura: string;
  local: string;
  latitude?: number | null;
  longitude?: number | null;
}

/** Classifica posto vs comboio. Prioriza postoId até o back corrigir origin. */
export function classificarOrigemAbastecimento(
  origin: string,
  postoId?: string | null,
  comboioId?: string | null,
): OrigemAbastecimento {
  if (postoId != null && String(postoId).trim() !== "") return "posto";
  if (comboioId != null && String(comboioId).trim() !== "") return "comboio";
  return origin.toLowerCase().includes("posto") ? "posto" : "comboio";
}

/** Soma dias em YYYY-MM-DD (calendário local, sem UTC). */
function addDaysIso(iso: string, days: number): string {
  const [y, mo, da] = iso.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function parseCoord(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** URL do Google Maps quando há coordenadas válidas. */
export function urlMapsAbastecimento(
  latitude?: number | null,
  longitude?: number | null,
): string | null {
  const lat = parseCoord(latitude);
  const lng = parseCoord(longitude);
  if (lat === null || lng === null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function normalizarItemLista(raw: unknown): AbastecimentoListaApi | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const vehicle = (r.vehicle ?? r.veiculo ?? null) as Record<string, unknown> | null;

  return {
    id: asStr(r.id),
    dateTime: asStr(r.dateTime ?? r.dataHora ?? r.data),
    vehicle: {
      name: asStr(vehicle?.name ?? vehicle?.nome ?? r.veiculo),
      plate: asStr(vehicle?.plate ?? vehicle?.placa ?? r.placa),
      type: asStr(vehicle?.type ?? vehicle?.tipo ?? r.tipo),
    },
    origin: asStr(r.origin ?? r.origem) || "Comboio",
    postoId: (r.postoId ?? r.posto_id ?? null) as string | null,
    liters: Number(r.liters ?? r.litros ?? 0) || 0,
    value: parseValorAbastecimento(r.value ?? r.valor ?? r.valorTotal ?? r.total),
    reading: asStr(r.reading ?? r.leitura ?? r.leituraLabel),
    meterPhoto: asStr(r.meterPhoto) || undefined,
    local: asStr(r.local),
    latitude: parseCoord(r.latitude ?? r.lat),
    longitude: parseCoord(r.longitude ?? r.lng ?? r.lon),
    createdAt: asStr(r.createdAt),
  };
}

/** ISO → "DD/MM/AA HH:MM" (pt-BR); "" quando inválido. Fallback de data. */
function formatDataIso(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function abastecimentoListaParaTela(
  item: AbastecimentoListaApi,
): AbastecimentoTela {
  return {
    id: item.id,
    // Fallback: se o backend não mandou dateTime, formata o createdAt cru.
    data: item.dateTime || formatDataIso(item.createdAt),
    veiculo: item.vehicle.name,
    placa: item.vehicle.plate,
    tipoVeiculo: item.vehicle.type,
    origemTipo: classificarOrigemAbastecimento(item.origin, item.postoId),
    origemNome: item.origin,
    litros: item.liters,
    valor: item.value,
    leitura: item.reading,
    local: item.local,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
  };
}

export const abastecimentosApi = {
  async listar(prefeituraId: string): Promise<Abastecimento[]> {
    const r = await api.get<{
      data: (Record<string, unknown> & { id?: string })[];
    }>(`/abastecimentos/${prefeituraId}`);
    return (r.data ?? [])
      .map(fromDoc)
      .sort((a, b) => b.data.localeCompare(a.data));
  },

  async listarPorPeriodo(
    prefeituraId: string,
    startDate: string,
    /** Último dia incluso na UI (YYYY-MM-DD). */
    endDateInclusive: string,
  ): Promise<AbastecimentoTela[]> {
    // O backend compara createdAt com meia-noite UTC do endDate; sem +1 dia
    // registros do último dia selecionado ficam de fora (ex.: fim 04/06 não traz o dia 04).
    const endDateApi = addDaysIso(endDateInclusive, 1);
    const qs = new URLSearchParams({ startDate, endDate: endDateApi });
    const r = await api.get<{ data: AbastecimentoListaApi[] }>(
      `/abastecimentos/${prefeituraId}?${qs}`,
    );
    return (r.data ?? [])
      .map(normalizarItemLista)
      .filter((item): item is AbastecimentoListaApi => item != null)
      .map(abastecimentoListaParaTela);
  },

  /** Remove um abastecimento pelo id (DELETE /abastecimentos/item/:id). */
  async remover(id: string): Promise<void> {
    await api.del(`/abastecimentos/item/${id}`);
  },
};
