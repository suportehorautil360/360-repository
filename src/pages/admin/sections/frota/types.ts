/**
 * Modelo de Frota — independente dos equipamentos de locação.
 * Cada veículo tem uma leitura atual (km para carro/van/caminhão, horímetro
 * para máquina) e um alvo de próxima revisão no mesmo eixo de medição.
 */

export type TipoVeiculo = "carro" | "caminhao" | "van" | "maquina";

export interface VeiculoFrota {
  id: string;
  /** Código interno do veículo (ex.: CAR-001, TRK-001, MQ-02). Único. */
  codigo: string;
  /** Nome de exibição (ex.: "HB20 2021"). */
  nome: string;
  /** Marca/fabricante (ex.: Hyundai, Scania). */
  marca: string;
  tipo: TipoVeiculo;
  /** Leitura atual (km ou horímetro, conforme o tipo). */
  medicaoAtual: number;
  /** Valor de km/horímetro em que a próxima revisão vence. */
  revisaoEm: number;
  /** Obra/serviço atual ou "Disponível". */
  obra: string;
  /** Liberado manualmente apesar de a revisão estar vencida. */
  liberado: boolean;
  criadoEm: string;
}

/** Dados do formulário de cadastro/edição (sem campos de sistema). */
export type VeiculoFrotaInput = Omit<
  VeiculoFrota,
  "id" | "criadoEm" | "liberado"
>;

export const TIPO_LABEL: Record<TipoVeiculo, string> = {
  carro: "Carro",
  caminhao: "Caminhão",
  van: "Caminhão",
  maquina: "Máquina",
};

export const TIPO_ICON: Record<TipoVeiculo, string> = {
  carro: "🚗",
  caminhao: "🚚",
  van: "🚐",
  maquina: "🚜",
};

/** Máquina mede em horímetro (h); os demais em km. */
export function unidadeDe(tipo: TipoVeiculo): "km" | "h" {
  return tipo === "maquina" ? "h" : "km";
}

/** "KM atual" / "Horímetro" — rótulo da leitura conforme o tipo. */
export function rotuloLeitura(tipo: TipoVeiculo): string {
  return tipo === "maquina" ? "Horímetro" : "KM atual";
}

/** > 0 => dentro do prazo; <= 0 => vencida (e por quanto passou). */
export function revisaoRestante(v: VeiculoFrota): number {
  return v.revisaoEm - v.medicaoAtual;
}

export function isVencido(v: VeiculoFrota): boolean {
  return revisaoRestante(v) <= 0;
}

/** Vencido e ainda não liberado manualmente => bloqueado (mostra LIBERAR). */
export function isBloqueado(v: VeiculoFrota): boolean {
  return isVencido(v) && !v.liberado;
}

/** Texto da revisão: "240 h rest." (no prazo) ou "+11000 km" (vencida). */
export function textoRevisao(v: VeiculoFrota): string {
  const unidade = unidadeDe(v.tipo);
  const restante = revisaoRestante(v);
  if (restante > 0) return `${restante.toLocaleString("pt-BR")} ${unidade} rest.`;
  return `+${Math.abs(restante).toLocaleString("pt-BR")} ${unidade}`;
}

/** Formata a leitura atual com a unidade certa. Ex.: "12.000 km", "1.250 h". */
export function textoLeitura(v: VeiculoFrota): string {
  return `${v.medicaoAtual.toLocaleString("pt-BR")} ${unidadeDe(v.tipo)}`;
}

/**
 * Veículos de exemplo que reproduzem o mockup. Usados só no estado vazio,
 * por ação explícita do usuário (não há seed automático no Firestore).
 */
export const FROTA_EXEMPLO: VeiculoFrotaInput[] = [
  { codigo: "CAR-001", nome: "HB20 2021", marca: "Hyundai", tipo: "carro", medicaoAtual: 12000, revisaoEm: 1000, obra: "Galpão Industrial Norte" },
  { codigo: "CAR-002", nome: "Onix 2020", marca: "Chevrolet", tipo: "carro", medicaoAtual: 34500, revisaoEm: 1000, obra: "Disponível" },
  { codigo: "CAR-003", nome: "Civic 2019", marca: "Honda", tipo: "carro", medicaoAtual: 48500, revisaoEm: 1000, obra: "Disponível" },
  { codigo: "TRK-001", nome: "Scania R450 2018", marca: "Scania", tipo: "caminhao", medicaoAtual: 120000, revisaoEm: 120000, obra: "Rodovia SP-310 — Trecho 4" },
  { codigo: "VAN-002", nome: "Sprinter 2022", marca: "Mercedes", tipo: "van", medicaoAtual: 68000, revisaoEm: 500, obra: "Cond. Parque Verde" },
  { codigo: "MQ-01", nome: "Caterpillar 320 2017", marca: "Caterpillar", tipo: "maquina", medicaoAtual: 1250, revisaoEm: 1250, obra: "Rodovia SP-310 — Trecho 4" },
  { codigo: "MQ-02", nome: "Komatsu PC210 2019", marca: "Komatsu", tipo: "maquina", medicaoAtual: 860, revisaoEm: 1100, obra: "Cond. Parque Verde" },
];
