import type { EquipRow } from "./equipamentos/equipamentos-api";
import {
  inferLinhaFromTipo,
  LINHA_OPTIONS,
} from "./equipamentos/equipamentos-api";

export const SEGMENTOS_OFICINA = [
  "Carro leve",
  "Máquinas linha amarela",
  "Tratores linha verde",
  "Caminhão linha branca",
] as const;

export type SegmentoOficina = (typeof SEGMENTOS_OFICINA)[number];

export interface OficinaDirecionamento {
  id: string;
  nome: string;
  especialidade: string;
  linhasAtuacao?: string[];
  segmentosAtuacao?: string[];
}

function norm(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normEsp(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function especialidadeCompativel(
  especialidade: string,
  linha: string,
): boolean {
  const e = normEsp(especialidade);
  const l = normEsp(linha);
  if (!e || !l) return false;
  return e === l || e.includes(l) || l.includes(e);
}

function blobEquipamento(eq: EquipRow): string {
  return norm(
    [eq.tipo, eq.linha, eq.descricao, eq.modelo, eq.marca].join(" "),
  );
}

/** Infere segmento do equipamento — mesma heurística do backend. */
export function resolveSegmentoEquipamento(
  eq: EquipRow,
): SegmentoOficina | "" {
  const blob = blobEquipamento(eq);
  const linha = norm(eq.linha || eq.tipo);

  if (
    linha.includes("leve") ||
    blob.includes("carro leve") ||
    blob.includes("linha leve") ||
    blob.includes("veiculo leve") ||
    /\b(hatch|sedan|pickup leve|camionete)\b/.test(blob)
  ) {
    return "Carro leve";
  }

  if (
    linha.includes("verde") ||
    blob.includes("trator") ||
    blob.includes("colheitadeira") ||
    blob.includes("pulverizador")
  ) {
    return "Tratores linha verde";
  }

  if (
    linha.includes("branca") ||
    blob.includes("caminh") ||
    blob.includes("truck") ||
    blob.includes("onibus") ||
    blob.includes("ônibus")
  ) {
    return "Caminhão linha branca";
  }

  if (
    linha.includes("amarela") ||
    blob.includes("escavadeira") ||
    blob.includes("retroescavadeira") ||
    blob.includes("carregadeira") ||
    blob.includes("motoniveladora") ||
    blob.includes("rolo compactador") ||
    blob.includes("maquina") ||
    blob.includes("máquina")
  ) {
    return "Máquinas linha amarela";
  }

  if (linha.includes("amarela")) return "Máquinas linha amarela";
  if (linha.includes("verde")) return "Tratores linha verde";
  if (linha.includes("branca")) return "Caminhão linha branca";

  return "";
}

export function oficinaAtendeSegmento(
  segmentosAtuacao: string[],
  segmentoEquipamento: string,
  linhasAtuacao: string[] = [],
): boolean {
  const segmentos = segmentosEfetivosOficina(segmentosAtuacao, linhasAtuacao);
  const alvo = norm(segmentoEquipamento);
  if (!alvo) return true;

  const cadastrados = segmentos.map(norm).filter(Boolean);
  if (cadastrados.length === 0) return false;

  return cadastrados.includes(alvo);
}

const LINHA_PARA_SEGMENTO: Record<string, SegmentoOficina> = {
  "linha leve": "Carro leve",
  "linha branca": "Caminhão linha branca",
  "linha amarela": "Máquinas linha amarela",
  "linha verde": "Tratores linha verde",
};

export function segmentosEfetivosOficina(
  segmentosAtuacao: string[],
  linhasAtuacao: string[],
): string[] {
  const cadastrados = segmentosAtuacao.filter(Boolean);
  const inferidos = linhasAtuacao
    .map((linha) => LINHA_PARA_SEGMENTO[norm(linha)] ?? "")
    .filter(Boolean);
  return [...new Set([...cadastrados, ...inferidos])];
}

function linhaAtuacaoParaEspecialidade(linha: string): string {
  return linha.trim().replace(/^linha\s+/i, "").trim() || linha.trim();
}

export function oficinaAtendeLinha(
  linhasAtuacao: string[],
  especialidade: string,
  linhaEquipamento: string,
): boolean {
  const alvo = linhaEquipamento.trim();
  if (!alvo) return true;

  const linhas = linhasAtuacao.filter(Boolean);
  if (linhas.length > 0) {
    return linhas.some(
      (linha) =>
        especialidadeCompativel(linha, alvo) ||
        especialidadeCompativel(linhaAtuacaoParaEspecialidade(linha), alvo),
    );
  }

  return especialidadeCompativel(especialidade, alvo);
}

export function linhaDoEquipamento(eq: EquipRow): string {
  const linha = (eq.linha || "").trim();
  if ((LINHA_OPTIONS as readonly string[]).includes(linha)) return linha;
  return inferLinhaFromTipo(eq.tipo) || inferLinhaFromTipo(linha) || linha || eq.tipo.trim();
}

/** Oficinas compatíveis — sem fallback amplo. */
export function filtrarOficinasElegiveis(
  oficinas: OficinaDirecionamento[],
  linha: string,
  segmento?: string,
): OficinaDirecionamento[] {
  if (oficinas.length === 0) return [];

  let pool = oficinas;
  const segmentoNorm = segmento?.trim() ?? "";

  if (segmentoNorm) {
    pool = pool.filter((oficina) =>
      oficinaAtendeSegmento(
        oficina.segmentosAtuacao ?? [],
        segmentoNorm,
        oficina.linhasAtuacao ?? [],
      ),
    );
    if (pool.length === 0) return [];
  }

  const linhaNorm = linha.trim();
  if (!linhaNorm) return pool;

  return pool.filter((oficina) =>
    oficinaAtendeLinha(
      oficina.linhasAtuacao ?? [],
      oficina.especialidade,
      linhaNorm,
    ),
  );
}

export function labelSegmento(segmento: string): string {
  return segmento || "Não identificado";
}
