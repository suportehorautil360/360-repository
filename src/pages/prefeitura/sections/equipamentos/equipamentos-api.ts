/**
 * Camada de dados de Equipamentos — fala com o backend NestJS (módulo
 * `equipamentos`), nunca com o Firestore direto. Faz a tradução entre o
 * documento cru do banco e o modelo de UI (EquipRow).
 */
import { api, ApiError } from "../../../../lib/api/client";

export type UnidadeRevisao = "km" | "h";
export type StatusEquipamento = "ativo" | "bloqueado" | "inativo";

export interface EquipRow {
  id: string;
  descricao: string;
  marca: string;
  modelo: string;
  chassis: string;
  placa: string;
  linha: string;
  tipo: string;
  ano: string;
  obra: string;
  status: StatusEquipamento;
  medicaoAtual: number;
  intervaloRevisao: number;
  ultimaRevisao: number;
  unidadeRevisao: UnidadeRevisao;
}

/** Dados do formulário de cadastro completo (sem id/derivados). */
export interface NovoEquip {
  // Identificação
  placa: string;
  chassis: string;
  renavam: string;
  numeroSerie: string;
  patrimonioBase: string;
  // Veículo
  marca: string;
  modelo: string;
  cor: string;
  combustivel: string;
  tipo: string;
  tipoFrota: string;
  motorizacao: string;
  anoFabricacao: string;
  anoModelo: string;
  capacidadeTanque: number;
  valorVeiculo: number;
  // Operação / revisão
  status: StatusEquipamento;
  medicaoAtual: number;
  intervaloRevisao: number;
  condutorResponsavel: string;
  gestorResponsavel: string;
  // Localização
  centroCusto: string;
  cidade: string;
  estado: string;
  regiao: string;
  // Documentos (datas yyyy-mm-dd)
  ipva: string;
  seguro: string;
  licenciamento: string;
  // Locação
  vigenciaInicio: string;
  vigenciaFim: string;
  inativarAposVigencia: boolean;
}

/** Opções dos selects do formulário. */
export const TIPO_OPTIONS = [
  "Carro Leve",
  "Caminhões",
  "Munck",
  "Pipa",
  "Basculante",
  "Betoneira",
  "Comboio",
  "Ambulância",
  "Baú",
  "Motoniveladora",
  "Escavadeira",
  "Trator de Esteira",
  "Retroescavadeira",
  "Pá Carregadeira",
  "Rolo Compactador",
  "Trator",
];

export const COMBUSTIVEL_OPTIONS = [
  "Diesel",
  "Diesel S10",
  "Gasolina",
  "Etanol",
  "Flex",
  "GNV",
  "Elétrico",
  "Híbrido",
];

export const FROTA_OPTIONS = ["Própria", "Locada"];

export const STATUS_OPTIONS: { value: StatusEquipamento; label: string }[] = [
  { value: "ativo", label: "Ativo" },
  { value: "bloqueado", label: "Bloqueado" },
  { value: "inativo", label: "Inativo" },
];

export const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

/** Dados informados no modal de revisão. */
export interface RevisaoEquipInput {
  data: string;
  leitura: number;
  oficina: string;
  servicos: string;
  custo: number;
  notaFiscal: string;
}

const TIPO_OPTIONS_HORIMETRO = [
  "motoniveladora",
  "escavadeira",
  "trator de esteira",
  "retroescavadeira",
  "pá carregadeira",
  "pa carregadeira",
  "rolo compactador",
  "trator",
];

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function inferTipo(data: Record<string, unknown>): string {
  const raw = `${asText(data.tipo)} ${asText(data.linha)} ${asText(
    data.descricao,
  )} ${asText(data.modelo)}`.toLowerCase();
  if (
    raw.includes("carro leve") ||
    raw.includes("linha leve") ||
    raw.includes("veiculo leve") ||
    raw.includes("veículo leve") ||
    raw.includes("automovel") ||
    raw.includes("automóvel")
  )
    return "Carro Leve";
  if (raw.includes("munck") || raw.includes("munk")) return "Munck";
  if (raw.includes("pipa")) return "Pipa";
  if (raw.includes("basculante")) return "Basculante";
  if (raw.includes("betoneira")) return "Betoneira";
  if (raw.includes("comboio")) return "Comboio";
  if (raw.includes("ambulancia") || raw.includes("ambulância"))
    return "Ambulância";
  if (raw.includes("baú") || raw.includes("bau")) return "Baú";
  if (raw.includes("motoniveladora")) return "Motoniveladora";
  if (raw.includes("escavadeira")) return "Escavadeira";
  if (
    raw.includes("trator de esteira") ||
    (raw.includes("trator") && raw.includes("esteira"))
  )
    return "Trator de Esteira";
  if (raw.includes("retroescavadeira")) return "Retroescavadeira";
  if (
    raw.includes("pa carregadeira") ||
    raw.includes("pá carregadeira") ||
    raw.includes("carregadeira")
  )
    return "Pá Carregadeira";
  if (raw.includes("rolo compactador") || raw.includes("compactador"))
    return "Rolo Compactador";
  if (/carro|leve|hatch|sedan|pickup|camionete/.test(raw)) return "Carro";
  if (/van|sprinter|furg[aã]o/.test(raw)) return "Van";
  if (/caminh|truck|pipa|munck|basculante|comboio|betoneira/.test(raw)) {
    return "Caminhão";
  }
  if (
    /m[aá]quina|escav|retro|p[aá] carregadeira|trator|komatsu|caterpillar/.test(
      raw,
    )
  ) {
    return "Máquina";
  }
  return asText(data.tipo) || asText(data.linha) || "Equipamento";
}

export function unitForTipo(tipo: string, fallback?: string): UnidadeRevisao {
  if (fallback === "h" || fallback === "km") return fallback;
  return TIPO_OPTIONS_HORIMETRO.some((needle) =>
    tipo.toLowerCase().includes(needle),
  )
    ? "h"
    : "km";
}

export function defaultInterval(tipo: string, unidade: UnidadeRevisao): number {
  if (unidade === "h") return 500;
  return tipo === "Carro" || tipo === "Carro Leve" || tipo === "Van"
    ? 10000
    : 15000;
}

function normalizeStatus(value: unknown): StatusEquipamento {
  const raw = asText(value).toLowerCase();
  if (raw.includes("bloq") || raw === "blocked") return "bloqueado";
  if (raw.includes("inat")) return "inativo";
  return "ativo";
}

/** Documento cru (Firestore via backend) → modelo de UI. Tolerante a aliases. */
export function normalizeEquip(
  id: string,
  data: Record<string, unknown>,
): EquipRow {
  const tipo = inferTipo(data);
  const unidade = unitForTipo(tipo, asText(data.unidadeRevisao));
  const intervaloInformado =
    asNumber(data.intervaloRevisao) ||
    asNumber(data.maintenanceInterval) ||
    asNumber(data.intervaloManutencao);
  const medicaoAtual =
    asNumber(data.medicaoAtual) ||
    asNumber(data.currentMeter) ||
    asNumber(data.horimetro) ||
    asNumber(data.odometro) ||
    asNumber(data.kmAtual);

  return {
    id,
    descricao: asText(data.label) || asText(data.descricao) || "Equipamento",
    marca: asText(data.marca),
    modelo: asText(data.modelo) || asText(data.descricao),
    chassis: asText(data.chassis) || asText(data.placa) || asText(data.placaId),
    placa: asText(data.placa) || asText(data.placaId),
    linha: asText(data.linha),
    tipo,
    ano: asText(data.ano),
    obra: asText(data.obra),
    status: normalizeStatus(data.status),
    medicaoAtual,
    intervaloRevisao:
      intervaloInformado > 0
        ? intervaloInformado
        : defaultInterval(tipo, unidade),
    ultimaRevisao:
      asNumber(data.ultimaRevisao) ||
      asNumber(data.lastRevisionOdometerReading) ||
      0,
    unidadeRevisao: unidade,
  };
}

interface ListaResponse {
  data: Array<Record<string, unknown> & { id?: string }>;
  message: string;
}

function ordenar(lista: EquipRow[]): EquipRow[] {
  return [...lista].sort((a, b) =>
    a.descricao.localeCompare(b.descricao, "pt-BR"),
  );
}

/**
 * Campos comuns de criação/edição (sem `obra` e `ultimaRevisao`, que não são
 * editados pela tela — preservados na edição).
 */
function montarPayload(input: NovoEquip, prefeituraId: string) {
  const descricao = `${input.marca} ${input.modelo}`.trim() || input.modelo;
  return {
    prefeituraId,
    descricao,
    label: descricao,
    modelo: input.modelo,
    chassis: input.chassis,
    placa: input.placa,
    renavam: input.renavam,
    numeroSerie: input.numeroSerie,
    patrimonioBase: input.patrimonioBase,
    marca: input.marca,
    cor: input.cor,
    combustivel: input.combustivel,
    tipo: input.tipo,
    linha: input.tipo,
    tipoFrota: input.tipoFrota,
    motorizacao: input.motorizacao,
    ano: input.anoFabricacao,
    anoFabricacao: input.anoFabricacao,
    anoModelo: input.anoModelo,
    capacidadeTanque: input.capacidadeTanque,
    valorVeiculo: input.valorVeiculo,
    status: input.status,
    medicaoAtual: input.medicaoAtual,
    intervaloRevisao: input.intervaloRevisao,
    unidadeRevisao: unitForTipo(input.tipo),
    condutorResponsavel: input.condutorResponsavel,
    gestorResponsavel: input.gestorResponsavel,
    centroCusto: input.centroCusto,
    cidade: input.cidade,
    estado: input.estado,
    regiao: input.regiao,
    ipva: input.ipva,
    seguro: input.seguro,
    licenciamento: input.licenciamento,
    vigenciaInicio: input.vigenciaInicio,
    vigenciaFim: input.vigenciaFim,
    inativarAposVigencia: input.inativarAposVigencia,
  };
}

export const equipamentosApi = {
  /** Lista os equipamentos da prefeitura (404 vira lista vazia). */
  async listar(prefeituraId: string): Promise<EquipRow[]> {
    try {
      const r = await api.get<ListaResponse>(`/equipamentos/${prefeituraId}`);
      return ordenar(
        (r.data ?? []).map((d) => normalizeEquip(String(d.id ?? ""), d)),
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return [];
      throw e;
    }
  },

  /** Busca um equipamento (documento bruto) pelo id. Null se não existir. */
  async obter(id: string): Promise<Record<string, unknown> | null> {
    try {
      const r = await api.get<{ data: Record<string, unknown> }>(
        `/equipamentos/item/${id}`,
      );
      return r.data ?? null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  /** Cria um equipamento e devolve a linha normalizada. */
  async criar(input: NovoEquip, prefeituraId: string): Promise<EquipRow> {
    const payload = {
      ...montarPayload(input, prefeituraId),
      ultimaRevisao: input.medicaoAtual,
      obra: "",
    };
    const r = await api.post<{ data: Record<string, unknown> }>(
      "/equipamentos",
      payload,
    );
    const doc = r.data ?? payload;
    return normalizeEquip(String((doc as { id?: string }).id ?? ""), doc);
  },

  /** Atualiza todos os campos editáveis (preserva obra e ultimaRevisao). */
  async atualizar(
    id: string,
    input: NovoEquip,
    prefeituraId: string,
  ): Promise<void> {
    await api.post(`/equipamentos/update/${id}`, montarPayload(input, prefeituraId));
  },

  /** Atualiza a leitura atual (medição). */
  async atualizarMedicao(id: string, medicaoAtual: number): Promise<void> {
    await api.post(`/equipamentos/update/${id}`, { medicaoAtual });
  },

  /** Alterna/define o status do equipamento. */
  async atualizarStatus(id: string, status: StatusEquipamento): Promise<void> {
    await api.post(`/equipamentos/update/${id}`, { status });
  },

  async remover(id: string): Promise<void> {
    await api.del(`/equipamentos/${id}`);
  },

  /** Registra a revisão concluída e libera o equipamento. */
  async concluirRevisao(
    eq: EquipRow,
    prefeituraId: string,
    dados: RevisaoEquipInput,
  ): Promise<void> {
    await api.post("/equipamentos/revision/complete", {
      revisionDate: new Date(dados.data).toISOString(),
      odometerReading: dados.leitura,
      mechanicOrOfficeName: dados.oficina.trim(),
      servicesDescription: dados.servicos.trim(),
      revisionCost: dados.custo,
      invoiceNumber: dados.notaFiscal.trim(),
      prefeituraId,
      equipamentoId: eq.id,
    });
  },
};
