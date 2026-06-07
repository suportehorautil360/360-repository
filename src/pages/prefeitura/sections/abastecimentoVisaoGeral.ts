import type { AbastecimentoTela } from "../../../lib/api/abastecimentos";

export interface VisaoGeralKpis {
  litrosComboio: number;
  litrosPosto: number;
  gastoPostos: number;
  veiculosAtivos: number;
}

export interface ConsumoVeiculo {
  id: string;
  nome: string;
  placa: string;
  categoria: string;
  consumo: number;
  unidade: "L/h" | "L/km";
  consumoLabel: string;
}

function isMaquina(tipo: string): boolean {
  const t = tipo.toLowerCase();
  return (
    t.includes("maquina") ||
    t.includes("máquina") ||
    t.includes("trator") ||
    t.includes("escavadeira") ||
    t.includes("carregadeira") ||
    t.includes("motoniveladora") ||
    t.includes("pá") ||
    t.startsWith("pa ")
  );
}

function parseLeitura(leitura: string): number | null {
  const limpo = leitura.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function labelCategoria(tipo: string): string {
  const t = tipo.trim();
  if (!t) return "Veículo";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function calcularKpisVisaoGeral(
  lista: AbastecimentoTela[],
): VisaoGeralKpis {
  let litrosComboio = 0;
  let litrosPosto = 0;
  let gastoPostos = 0;
  const veiculos = new Set<string>();

  for (const item of lista) {
    veiculos.add(item.placa);
    if (item.origemTipo === "comboio") {
      litrosComboio += item.litros;
    } else {
      litrosPosto += item.litros;
      if (item.valor != null) gastoPostos += item.valor;
    }
  }

  return {
    litrosComboio,
    litrosPosto,
    gastoPostos,
    veiculosAtivos: veiculos.size,
  };
}

export function calcularConsumoMedio(
  lista: AbastecimentoTela[],
): ConsumoVeiculo[] {
  const grupos = new Map<string, AbastecimentoTela[]>();

  for (const item of lista) {
    const chave = item.placa || item.veiculo;
    const arr = grupos.get(chave) ?? [];
    arr.push(item);
    grupos.set(chave, arr);
  }

  const resultado: ConsumoVeiculo[] = [];

  for (const [chave, itens] of grupos) {
    const ordenados = [...itens].sort((a, b) => a.data.localeCompare(b.data));
    const ref = ordenados[0];
    const maquina = isMaquina(ref.tipoVeiculo);
    const unidade: "L/h" | "L/km" = maquina ? "L/h" : "L/km";
    const taxas: number[] = [];

    for (let i = 1; i < ordenados.length; i++) {
      const anterior = parseLeitura(ordenados[i - 1].leitura);
      const atual = parseLeitura(ordenados[i].leitura);
      if (anterior == null || atual == null) continue;
      const delta = atual - anterior;
      if (delta <= 0) continue;
      taxas.push(ordenados[i].litros / delta);
    }

    const consumo =
      taxas.length > 0
        ? taxas.reduce((s, t) => s + t, 0) / taxas.length
        : ordenados.reduce((s, i) => s + i.litros, 0) / ordenados.length;

    resultado.push({
      id: chave,
      nome: ref.veiculo,
      placa: ref.placa,
      categoria: labelCategoria(ref.tipoVeiculo),
      consumo,
      unidade,
      consumoLabel: `${consumo.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${unidade}`,
    });
  }

  return resultado.sort((a, b) => b.consumo - a.consumo);
}

export function fmtLitros(n: number): string {
  return `${n.toLocaleString("pt-BR")} L`;
}

export function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtPeriodoExibicao(inicio: string, fim: string): string {
  const fmtCurto = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };
  const [yf, mf, df] = fim.split("-");
  return `${fmtCurto(inicio)} — ${df}/${mf}/${yf}`;
}
