import type { ItemOrdemOrcamento } from "./orcamentos-aprovacoes-model";
import { fmtBRL } from "./orcamentos-aprovacoes-model";

export interface OrcamentoPecaLinha {
  id: string;
  codigo: string;
  descricao: string;
  marca: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
}

export interface OrcamentoServicoLinha {
  id: string;
  descricao: string;
  tipoHora: string;
  horas: number;
  valorHora: number;
  total: number;
}

export interface OrcamentoDeslocamento {
  km: number;
  valorPorKm: number;
  horasViagem: number;
  valorHora: number;
  taxas: number;
  total: number;
}

export interface OrcamentoItensSecoes {
  pecas: OrcamentoPecaLinha[];
  servicos: OrcamentoServicoLinha[];
  deslocamento: OrcamentoDeslocamento;
}

export interface OrcamentoItensSubtotais {
  pecas: number;
  servicos: number;
  deslocamento: number;
  total: number;
}

const HORA_LABEL: Record<string, string> = {
  normal: "Normal",
  extra: "Extra",
  noturna: "Noturna",
};

function num(valor: unknown, fallback = 0): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : fallback;
  if (typeof valor === "string") {
    const n = Number(valor.replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function fmtNum(valor: number): string {
  if (!Number.isFinite(valor)) return "0";
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2).replace(".", ",");
}

function isDeslocamento(item: ItemOrdemOrcamento): boolean {
  return item.category === "travel" || item.descricao.trim() === "Deslocamento";
}

function mapPeca(item: ItemOrdemOrcamento, index: number): OrcamentoPecaLinha | null {
  if (
    item.category === "service" ||
    item.category === "travel" ||
    isDeslocamento(item)
  ) {
    return null;
  }

  if (
    item.category === "part" ||
    item.codigo ||
    item.marca ||
    item.quantidade != null ||
    item.valorUnitario != null
  ) {
    const quantidade = num(item.quantidade, 1);
    const valorUnitario = num(item.valorUnitario, item.valor);
    return {
      id: `peca-${index}`,
      codigo: item.codigo?.trim() ?? "",
      descricao: item.descricao.trim(),
      marca: item.marca?.trim() ?? "",
      quantidade,
      valorUnitario,
      total: quantidade * valorUnitario,
    };
  }

  return null;
}

function mapServico(
  item: ItemOrdemOrcamento,
  index: number,
): OrcamentoServicoLinha | null {
  if (item.category === "part" || item.category === "travel" || isDeslocamento(item)) {
    return null;
  }

  if (item.category === "service" || item.horas != null || item.valorHora != null) {
    const horas = num(item.horas, 1);
    const valorHora = num(item.valorHora, item.valor);
    return {
      id: `servico-${index}`,
      descricao: item.descricao.trim(),
      tipoHora: item.tipoHora?.trim() || "normal",
      horas,
      valorHora,
      total: horas * valorHora,
    };
  }

  return {
    id: `servico-${index}`,
    descricao: item.descricao.trim(),
    tipoHora: "normal",
    horas: 1,
    valorHora: item.valor,
    total: item.valor,
  };
}

function mapDeslocamento(itens: ItemOrdemOrcamento[]): OrcamentoDeslocamento {
  const travel = itens.find(isDeslocamento);
  if (!travel) {
    return {
      km: 0,
      valorPorKm: 0,
      horasViagem: 0,
      valorHora: 0,
      taxas: 0,
      total: 0,
    };
  }

  const km = num(travel.km);
  const valorPorKm = num(travel.valorPorKm);
  const horasViagem = num(travel.horasViagem);
  const valorHora = num(travel.valorHoraViagem);
  const taxas = num(travel.taxas);
  const calculado =
    km * valorPorKm + horasViagem * valorHora + taxas;

  return {
    km,
    valorPorKm,
    horasViagem,
    valorHora,
    taxas,
    total: calculado > 0 ? calculado : travel.valor,
  };
}

export function resolverSecoesOrcamento(
  itens: ItemOrdemOrcamento[],
): OrcamentoItensSecoes {
  const pecas = itens
    .map(mapPeca)
    .filter((linha): linha is OrcamentoPecaLinha => linha != null);
  const servicos = itens
    .map(mapServico)
    .filter((linha): linha is OrcamentoServicoLinha => linha != null);

  return {
    pecas,
    servicos,
    deslocamento: mapDeslocamento(itens),
  };
}

export function calcularSubtotaisOrcamento(
  secoes: OrcamentoItensSecoes,
): OrcamentoItensSubtotais {
  const pecas = secoes.pecas.reduce((acc, linha) => acc + linha.total, 0);
  const servicos = secoes.servicos.reduce((acc, linha) => acc + linha.total, 0);
  const deslocamento = secoes.deslocamento.total;

  return {
    pecas,
    servicos,
    deslocamento,
    total: pecas + servicos + deslocamento,
  };
}

export function labelTipoHora(tipo: string): string {
  return HORA_LABEL[tipo] ?? tipo;
}

export function fmtPrazoDias(prazoDias?: number): string {
  if (!prazoDias || prazoDias <= 0) return "—";
  return `${prazoDias} ${prazoDias === 1 ? "dia" : "dias"}`;
}

export { fmtBRL, fmtNum };
