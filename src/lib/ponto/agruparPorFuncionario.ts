/**
 * Agrupa batidas de ponto por funcionário no período selecionado e calcula
 * o estado operacional (ok / atraso / incompleto / falta) por dia.
 *
 * Aliase de "funcionário" aqui é o `name` do registro de ponto. O front
 * tenta casar com o cadastro de funcionário (matrícula, cargo, etc.) por
 * comparação case-insensitive de nome — o ponto não carrega FK hoje.
 */
import type { PontoRegistro } from "../api/pontos";
import type { Escala } from "../api/escala";
import type { Funcionario } from "../funcionarios/funcionarios";
import { minutosPrevistos, minutosTrabalhados } from "../../pages/prefeitura/sections/horasPonto";

export type StatusDia = "ok" | "atraso" | "incompleto" | "falta" | "sem-jornada";

/** Data LOCAL (YYYY-MM-DD) de um ISO — sem virar UTC. */
export function diaDe(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

/** Hoje em formato YYYY-MM-DD (local). */
export function hojeIso(): string {
  return diaDe(new Date().toISOString());
}

/** Tolerância (minutos) para considerar atraso na entrada. */
const TOLERANCIA_ATRASO_MIN = 5;

function minutoLocal(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function horaParaMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function diaUtil(escala: Escala | null, diaIso: string): boolean {
  if (!escala) return true; // sem escala definida, assume todo dia útil
  const dow = new Date(`${diaIso}T12:00:00`).getDay();
  return escala.diasSemana.includes(dow);
}

/**
 * Classifica o dia de um funcionário com base nas batidas e na escala.
 * - sem-jornada: dia não-útil pela escala (final de semana, p.ex.)
 * - falta: dia útil sem nenhuma batida
 * - incompleto: tem batidas mas falta entrada ou saída
 * - atraso: tem entrada e saída, mas a entrada chegou depois da escala + tolerância
 * - ok: jornada completa dentro da escala (ou sem escala definida)
 */
export function statusDoDia(
  batidas: PontoRegistro[],
  escala: Escala | null,
  diaIso: string,
): StatusDia {
  if (!diaUtil(escala, diaIso)) return "sem-jornada";
  if (batidas.length === 0) return "falta";

  const tipos: Partial<Record<PontoRegistro["tipo"], PontoRegistro>> = {};
  for (const b of batidas) tipos[b.tipo] = b;

  const entrada = tipos.entrada;
  const saida = tipos.saida;
  if (!entrada || !saida) return "incompleto";

  if (escala) {
    const limite = horaParaMin(escala.inicio) + TOLERANCIA_ATRASO_MIN;
    if (minutoLocal(entrada.timestampOriginal) > limite) return "atraso";
  }
  return "ok";
}

export interface FuncionarioJornadaDia {
  /** Data local (YYYY-MM-DD) do dia. */
  dia: string;
  /** Todas as batidas do dia para esse funcionário. */
  batidas: PontoRegistro[];
  /** Minutos efetivamente trabalhados no dia. */
  trabalhadoMin: number;
  /** Minutos previstos pela escala (0 em dia não-útil). */
  previstoMin: number;
  /** Saldo do dia (trabalhado - previsto). */
  saldoMin: number;
  /** Classificação operacional. */
  status: StatusDia;
}

export interface FuncionarioResumo {
  /** Doc do funcionário no cadastro (`operadores`), se casou pelo nome. */
  funcionario: Funcionario | null;
  /** Nome utilizado nas batidas (fonte de verdade — pode existir sem cadastro). */
  nome: string;
  /** Dias do período com suas batidas/totais/status. Mais recente primeiro. */
  dias: FuncionarioJornadaDia[];
  /** Agregados do período. */
  totais: {
    trabalhadoMin: number;
    previstoMin: number;
    saldoMin: number;
    diasOk: number;
    atrasos: number;
    faltas: number;
    incompletos: number;
    pendentes: number; // batidas com status === 'pendente'
  };
}

function chaveNome(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Junta batidas + cadastro de funcionários e produz a visão por pessoa no
 * período. Funcionários **ativos sem batida** no período aparecem com `dias`
 * vazio (importante pra mostrar faltas/sem-registro).
 */
export function agruparPorFuncionario(
  batidas: PontoRegistro[],
  funcionarios: Funcionario[],
  diasNoPeriodo: string[],
  escala: Escala | null,
): FuncionarioResumo[] {
  const periodoSet = new Set(diasNoPeriodo);

  // Index funcionário por nome (case-insensitive). Match best-effort.
  const indexFunc = new Map<string, Funcionario>();
  for (const f of funcionarios) {
    if (!f.nome) continue;
    indexFunc.set(chaveNome(f.nome), f);
  }

  // Agrupa as batidas: nome → dia → batidas[].
  const porNome = new Map<string, Map<string, PontoRegistro[]>>();
  for (const b of batidas) {
    const dia = diaDe(b.timestampOriginal);
    if (!periodoSet.has(dia)) continue;
    const k = chaveNome(b.name);
    if (!porNome.has(k)) porNome.set(k, new Map());
    const mapaDia = porNome.get(k)!;
    if (!mapaDia.has(dia)) mapaDia.set(dia, []);
    mapaDia.get(dia)!.push(b);
  }

  // Garante presença de funcionários ativos mesmo sem batida (faltas).
  for (const f of funcionarios) {
    if (f.status !== "ativo") continue;
    const k = chaveNome(f.nome);
    if (!porNome.has(k)) porNome.set(k, new Map());
  }

  const resumos: FuncionarioResumo[] = [];
  for (const [nomeKey, mapaDia] of porNome) {
    const funcionario = indexFunc.get(nomeKey) ?? null;
    // Nome de exibição: prefere o do cadastro (case correto), se houver.
    const nome =
      funcionario?.nome ??
      // pega o nome da primeira batida (mantém capitalização original)
      [...mapaDia.values()][0]?.[0]?.name ??
      nomeKey;

    const dias: FuncionarioJornadaDia[] = [];
    const tot = {
      trabalhadoMin: 0,
      previstoMin: 0,
      saldoMin: 0,
      diasOk: 0,
      atrasos: 0,
      faltas: 0,
      incompletos: 0,
      pendentes: 0,
    };

    for (const diaIso of diasNoPeriodo) {
      const bs = mapaDia.get(diaIso) ?? [];
      const trab = minutosTrabalhados(bs, escala?.almocoMinutos ?? 0);
      const prev = minutosPrevistos(escala, diaIso);
      const status = statusDoDia(bs, escala, diaIso);
      const pend = bs.filter((b) => (b.status ?? "pendente") === "pendente").length;

      tot.trabalhadoMin += trab;
      tot.previstoMin += prev;
      tot.pendentes += pend;
      if (status === "ok") tot.diasOk += 1;
      if (status === "atraso") tot.atrasos += 1;
      if (status === "falta") tot.faltas += 1;
      if (status === "incompleto") tot.incompletos += 1;

      dias.push({
        dia: diaIso,
        batidas: bs,
        trabalhadoMin: trab,
        previstoMin: prev,
        saldoMin: trab - prev,
        status,
      });
    }
    tot.saldoMin = tot.trabalhadoMin - tot.previstoMin;
    // Mais recente primeiro
    dias.sort((a, b) => b.dia.localeCompare(a.dia));

    resumos.push({ funcionario, nome, dias, totais: tot });
  }

  // Ordena: quem tem mais atrasos/faltas/pendências primeiro, depois alfabético.
  resumos.sort((a, b) => {
    const aSinal = a.totais.atrasos + a.totais.faltas + a.totais.pendentes;
    const bSinal = b.totais.atrasos + b.totais.faltas + b.totais.pendentes;
    if (aSinal !== bSinal) return bSinal - aSinal;
    return a.nome.localeCompare(b.nome);
  });

  return resumos;
}

/** Lista de dias YYYY-MM-DD entre dois dias inclusivos (ordem cronológica). */
export function diasEntre(inicioIso: string, fimIso: string): string[] {
  const dias: string[] = [];
  const ini = new Date(`${inicioIso}T12:00:00`);
  const fim = new Date(`${fimIso}T12:00:00`);
  const cur = new Date(ini);
  while (cur <= fim) {
    dias.push(diaDe(cur.toISOString()));
    cur.setDate(cur.getDate() + 1);
  }
  return dias;
}

export type PeriodoPreset = "hoje" | "ontem" | "semana" | "mes";

/** Resolve o preset em [inicio, fim] no formato YYYY-MM-DD. */
export function intervaloDoPeriodo(preset: PeriodoPreset, hoje = new Date()): {
  inicio: string;
  fim: string;
  dias: string[];
} {
  const fim = new Date(hoje);
  fim.setHours(12, 0, 0, 0);
  const inicio = new Date(fim);
  switch (preset) {
    case "hoje":
      break;
    case "ontem":
      inicio.setDate(fim.getDate() - 1);
      fim.setDate(fim.getDate() - 1);
      break;
    case "semana":
      inicio.setDate(fim.getDate() - 6);
      break;
    case "mes":
      inicio.setDate(fim.getDate() - 29);
      break;
  }
  const ini = diaDe(inicio.toISOString());
  const fimIso = diaDe(fim.toISOString());
  return { inicio: ini, fim: fimIso, dias: diasEntre(ini, fimIso) };
}
