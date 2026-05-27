/**
 * Modelo de Frota — alinhado ao backend NestJS (coleção `vehicles`).
 * A leitura é km para carro/van/caminhão e horímetro (h) para máquina.
 * O limite da próxima revisão é DERIVADO: ultimaRevisao + intervaloRevisao.
 */

export type TipoVeiculo = "carro" | "caminhao" | "van" | "maquina";

export type StatusVeiculo = "ativo" | "bloqueado";

export interface VeiculoFrota {
  id: string;
  /** Placa / código interno (backend: plate). */
  placa: string;
  /** Nome de exibição, ex.: "HB20 2021" (backend: name). */
  nome: string;
  /** Marca/fabricante (backend: brand). */
  marca: string;
  tipo: TipoVeiculo;
  /** Ano de fabricação (backend: year). */
  ano: number;
  /** Leitura atual em km ou h (backend: currentMeter). */
  medicaoAtual: number;
  /** Intervalo entre revisões (backend: maintenanceInterval). */
  intervaloRevisao: number;
  /** Leitura na última revisão (backend: lastRevisionOdometerReading). */
  ultimaRevisao: number;
  /** Obra / frente de trabalho atual (backend: obra). */
  obra: string;
  /** Estado no backend: "ativo" ou "bloqueado". */
  status: StatusVeiculo;
}

/** Dados do formulário de cadastro (sem id/status; prefeituraId vem da tela). */
export type VeiculoFrotaInput = Omit<VeiculoFrota, "id" | "status">;

/** Dados informados no modal de liberar/registrar revisão. */
export interface RevisaoInput {
  data: string;
  hodometro: number;
  oficina: string;
  servicos: string;
  custo: number;
  notaFiscal: string;
}

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

/** Unidade no formato do backend (maintenanceUnit). */
export function maintenanceUnitDe(tipo: TipoVeiculo): "km" | "hours" {
  return tipo === "maquina" ? "hours" : "km";
}

/** "KM atual" / "Horímetro" — rótulo da leitura conforme o tipo. */
export function rotuloLeitura(tipo: TipoVeiculo): string {
  return tipo === "maquina" ? "Horímetro" : "KM atual";
}

/** Limite da próxima revisão (derivado). */
export function revisaoEm(v: VeiculoFrota): number {
  return v.ultimaRevisao + v.intervaloRevisao;
}

/** > 0 => dentro do prazo; <= 0 => vencida (e por quanto passou). */
export function revisaoRestante(v: VeiculoFrota): number {
  return revisaoEm(v) - v.medicaoAtual;
}

export function isVencido(v: VeiculoFrota): boolean {
  return revisaoRestante(v) <= 0;
}

/** Vencido (ou marcado como bloqueado no backend) => mostra LIBERAR. */
export function isBloqueado(v: VeiculoFrota): boolean {
  return isVencido(v) || v.status === "bloqueado";
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
 * Resumo do vencimento para o modal de liberar. Ex.:
 * "Carro · Hyundai · Limite de 10.000 km atingido. KM atual: 12.000. Excesso: 2.000 km."
 */
export function textoVencimento(v: VeiculoFrota): string {
  const un = unidadeDe(v.tipo);
  const excesso = Math.abs(revisaoRestante(v));
  return (
    `${TIPO_LABEL[v.tipo]} · ${v.marca} · ` +
    `Limite de ${revisaoEm(v).toLocaleString("pt-BR")} ${un} atingido. ` +
    `${rotuloLeitura(v.tipo)}: ${v.medicaoAtual.toLocaleString("pt-BR")} ${un}. ` +
    `Excesso: ${excesso.toLocaleString("pt-BR")} ${un}.`
  );
}

/**
 * Veículos de exemplo (estado vazio, por ação explícita). Números realistas
 * para o modelo ultimaRevisao + intervalo: alguns vencidos, o Komatsu no prazo.
 */
export const FROTA_EXEMPLO: VeiculoFrotaInput[] = [
  { placa: "CAR-001", nome: "HB20 2021", marca: "Hyundai", tipo: "carro", ano: 2021, medicaoAtual: 12000, intervaloRevisao: 10000, ultimaRevisao: 0, obra: "Galpão Industrial Norte" },
  { placa: "CAR-002", nome: "Onix 2020", marca: "Chevrolet", tipo: "carro", ano: 2020, medicaoAtual: 34500, intervaloRevisao: 10000, ultimaRevisao: 20000, obra: "Disponível" },
  { placa: "CAR-003", nome: "Civic 2019", marca: "Honda", tipo: "carro", ano: 2019, medicaoAtual: 48500, intervaloRevisao: 10000, ultimaRevisao: 30000, obra: "Disponível" },
  { placa: "TRK-001", nome: "Scania R450 2018", marca: "Scania", tipo: "caminhao", ano: 2018, medicaoAtual: 120000, intervaloRevisao: 20000, ultimaRevisao: 100000, obra: "Rodovia SP-310 — Trecho 4" },
  { placa: "VAN-002", nome: "Sprinter 2022", marca: "Mercedes", tipo: "van", ano: 2022, medicaoAtual: 68000, intervaloRevisao: 15000, ultimaRevisao: 50000, obra: "Cond. Parque Verde" },
  { placa: "MQ-01", nome: "Caterpillar 320 2017", marca: "Caterpillar", tipo: "maquina", ano: 2017, medicaoAtual: 1250, intervaloRevisao: 250, ultimaRevisao: 1000, obra: "Rodovia SP-310 — Trecho 4" },
  { placa: "MQ-02", nome: "Komatsu PC210 2019", marca: "Komatsu", tipo: "maquina", ano: 2019, medicaoAtual: 860, intervaloRevisao: 250, ultimaRevisao: 850, obra: "Cond. Parque Verde" },
];
