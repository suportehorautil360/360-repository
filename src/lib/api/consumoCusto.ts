/** Consumo e custo por veículo — GET /movimentacoes/consumo-custo/:prefeituraId */
import { api } from "./client";

interface MetricaApi {
  rotulo?: string;
  valor?: number | null;
  valorExibicao?: string;
}

interface TotalDestaqueApi extends MetricaApi {
  tipo?: "litros" | "gasto" | string;
}

interface TotaisApi {
  litros?: number;
  litrosExibicao?: string;
  gasto?: number;
  gastoExibicao?: string;
}

export interface ConsumoCustoPeriodoApi {
  label: string;
  startDate: string | null;
  endDate: string | null;
}

export interface ConsumoCustoCalculoApi {
  titulo: string;
  formulaConsumo: string;
  formulaCusto?: string;
  observacao?: string;
}

export interface ConsumoCustoPayloadApi {
  titulo?: string;
  periodo?: ConsumoCustoPeriodoApi;
  calculo?: ConsumoCustoCalculoApi;
  veiculos?: unknown[];
}

export interface IntervaloHistorico {
  id: string;
  periodoLabel: string;
  duracaoLabel: string;
  consumoLabel: string;
  custoLabel: string;
}

export interface AbastecimentoHistorico {
  id: string;
  dateTimeLabel: string;
  litrosLabel: string;
  leituraLabel: string;
  gastoLabel: string;
}

export interface VeiculoConsumoCusto {
  id: string;
  nome: string;
  subtitulo: string;
  placa: string;
  categoria: string;
  local: string;
  labelConsumo: string;
  labelCusto: string;
  labelTerceira: string;
  consumoValor: string;
  consumoLabel: string;
  custoValor: string;
  custoLabel: string;
  valorTerceira: string;
  litrosLabel: string;
  gastoLabel: string;
  intervalos: IntervaloHistorico[];
  abastecimentos: AbastecimentoHistorico[];
}

export interface ConsumoCustoCalculoTela {
  titulo: string;
  formulaConsumo: string;
  formulaCusto: string;
  observacao: string;
}

export interface ConsumoCustoTela {
  titulo: string;
  periodoLabel: string;
  calculo: ConsumoCustoCalculoTela;
  veiculos: VeiculoConsumoCusto[];
}

export const CALCULO_CONSUMO_PADRAO: ConsumoCustoCalculoTela = {
  titulo: "Como o consumo e o custo são calculados",
  formulaConsumo:
    "Consumo = litros do abastecimento ÷ (leitura atual − leitura anterior)",
  formulaCusto:
    "Quando o abastecimento tem valor (R$), o custo por km ou hora é calculado dividindo o valor pelo deslocamento no intervalo.",
  observacao:
    "Máquinas usam litros por hora; carros e caminhões usam litros por km.",
};

function labelOuTraco(v: string | null | undefined): string {
  const t = v?.trim();
  if (!t || t === "—" || t === "— · —") return "—";
  return t;
}

function asStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function asMetrica(v: unknown): MetricaApi | null {
  return v && typeof v === "object" ? (v as MetricaApi) : null;
}

function rotuloMetrica(m: MetricaApi | null, fallback: string): string {
  const r = m?.rotulo?.trim();
  return r || fallback;
}

function valorMetrica(m: MetricaApi | null): string {
  if (m?.valorExibicao?.trim()) return labelOuTraco(m.valorExibicao);
  if (m?.valor != null && Number.isFinite(m.valor)) {
    return m.valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return "—";
}

function valorCurtoMetrica(m: MetricaApi | null): string {
  if (m?.valor != null && Number.isFinite(m.valor)) {
    return m.valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return "—";
}

/** Valor grande no card: número curto se houver, senão a exibição formatada. */
export function valorMetricaCard(curto: string, exibicao: string): string {
  return curto !== "—" ? curto : exibicao;
}

function montarTitulo(raw: Record<string, unknown>, equipmentId: string) {
  const nome = labelOuTraco(asStr(raw.nome ?? raw.name));
  const placa = labelOuTraco(asStr(raw.placa ?? raw.plate));
  const tipo = labelOuTraco(asStr(raw.tipo ?? raw.type));
  const setor = labelOuTraco(
    asStr(raw.setor ?? raw.local ?? raw.location ?? raw.obra),
  );
  const subtituloApi = labelOuTraco(asStr(raw.subtitulo));

  if (nome !== "—") {
    const partes = [placa, tipo, setor].filter((p) => p !== "—");
    return {
      nome,
      subtitulo: subtituloApi !== "—" ? subtituloApi : partes.join(" · ") || "—",
      placa: placa !== "—" ? placa : "",
      categoria: tipo !== "—" ? tipo : "Veículo",
      local: setor !== "—" ? setor : "—",
    };
  }

  const partes = [placa, tipo, setor].filter((p) => p !== "—");
  return {
    nome: `Equipamento ${equipmentId.slice(0, 8)}`,
    subtitulo:
      subtituloApi !== "—"
        ? subtituloApi
        : partes.join(" · ") || equipmentId,
    placa: placa !== "—" ? placa : "",
    categoria: tipo !== "—" ? tipo : "Veículo",
    local: setor !== "—" ? setor : "—",
  };
}

function normalizarAbastecimento(
  raw: unknown,
  index: number,
  equipmentId: string,
): AbastecimentoHistorico | null {
  if (!raw || typeof raw !== "object") return null;
  const ab = raw as Record<string, unknown>;

  const litros = ab.litros;
  const litrosLabel =
    labelOuTraco(asStr(ab.litrosLabel)) !== "—"
      ? labelOuTraco(asStr(ab.litrosLabel))
      : typeof litros === "number" && Number.isFinite(litros)
        ? `${litros.toLocaleString("pt-BR")} L`
        : "—";

  const gasto = ab.gasto;
  const gastoLabel =
    labelOuTraco(asStr(ab.gastoLabel)) !== "—"
      ? labelOuTraco(asStr(ab.gastoLabel))
      : typeof gasto === "number" && Number.isFinite(gasto)
        ? gasto.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })
        : "—";

  return {
    id: asStr(ab.id) || `${equipmentId}-ab-${index}`,
    dateTimeLabel: labelOuTraco(
      asStr(ab.dateTime ?? ab.dataHora ?? ab.data ?? ab.createdAt),
    ),
    litrosLabel,
    leituraLabel: (() => {
      const fromApi = labelOuTraco(asStr(ab.leituraLabel ?? ab.leitura));
      if (fromApi !== "—") return fromApi;
      const reading = ab.currentReading;
      if (typeof reading === "number" && Number.isFinite(reading)) {
        return reading.toLocaleString("pt-BR");
      }
      return "—";
    })(),
    gastoLabel,
  };
}

interface AbastecimentoBrutoOrdenado {
  id: string;
  dateTime: string;
  createdAt: string;
  litros: number | null;
  currentReading: number | null;
  previousReading: number | null;
  gasto: number | null;
}

function ordenarAbastecimentosBrutos(brutos: unknown[]): AbastecimentoBrutoOrdenado[] {
  return brutos
    .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object")
    .map((ab, index) => ({
      id: asStr(ab.id) || `ab-${index}`,
      dateTime: asStr(ab.dateTime ?? ab.dataHora ?? ab.data),
      createdAt: asStr(ab.createdAt),
      litros: typeof ab.litros === "number" && Number.isFinite(ab.litros) ? ab.litros : null,
      currentReading:
        typeof ab.currentReading === "number" && Number.isFinite(ab.currentReading)
          ? ab.currentReading
          : null,
      previousReading:
        typeof ab.previousReading === "number" && Number.isFinite(ab.previousReading)
          ? ab.previousReading
          : typeof ab.leituraAnterior === "number" && Number.isFinite(ab.leituraAnterior)
            ? ab.leituraAnterior
            : null,
      gasto: typeof ab.gasto === "number" && Number.isFinite(ab.gasto) ? ab.gasto : null,
    }))
    .sort((a, b) => {
      const ta = a.createdAt || a.dateTime;
      const tb = b.createdAt || b.dateTime;
      return ta.localeCompare(tb);
    });
}

interface IntervaloCalculado {
  id: string;
  inicio: AbastecimentoBrutoOrdenado;
  fim: AbastecimentoBrutoOrdenado;
  litros: number;
  gasto: number | null;
  diff: number;
}

function fmtConsumoIntervalo(litros: number, diff: number, porHora: boolean): string {
  const taxa = litros / diff;
  return `${taxa.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${porHora ? "L/h" : "L/km"}`;
}

function fmtCustoIntervalo(gasto: number, diff: number, porHora: boolean): string {
  const taxa = gasto / diff;
  const moeda = taxa.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${moeda}${porHora ? "/h" : "/km"}`;
}

/**
 * Consumo = litros ÷ (leitura atual − leitura anterior).
 * Abastecimentos com a mesma leitura acumulam litros até a próxima leitura diferente.
 */
function intervalosCalculadosDeAbastecimentos(
  brutos: unknown[],
): IntervaloCalculado[] {
  const ordenados = ordenarAbastecimentosBrutos(brutos);
  const intervalos: IntervaloCalculado[] = [];
  let litrosAcumulados = 0;
  let gastoAcumulado = 0;
  let temGasto = false;
  let inicioChain: AbastecimentoBrutoOrdenado | null = null;

  for (let i = 1; i < ordenados.length; i++) {
    const prev = ordenados[i - 1];
    const curr = ordenados[i];
    if (inicioChain == null) inicioChain = prev;

    const diff =
      curr.currentReading != null && prev.currentReading != null
        ? curr.currentReading - prev.currentReading
        : null;

    if (diff == null || diff <= 0) {
      const diffAnterior =
        curr.previousReading != null && curr.currentReading != null
          ? curr.currentReading - curr.previousReading
          : null;

      if (
        diffAnterior != null &&
        diffAnterior > 0 &&
        curr.litros != null &&
        labelOuTraco(curr.dateTime) !== "—"
      ) {
        intervalos.push({
          id: `${curr.id}-leitura-anterior`,
          inicio: prev,
          fim: curr,
          litros: curr.litros + litrosAcumulados,
          gasto: temGasto ? (curr.gasto ?? 0) + gastoAcumulado : curr.gasto,
          diff: diffAnterior,
        });
        litrosAcumulados = 0;
        gastoAcumulado = 0;
        temGasto = false;
        inicioChain = curr;
        continue;
      }

      if (litrosAcumulados === 0 && prev.litros != null) {
        litrosAcumulados += prev.litros;
      }
      if (curr.litros != null) litrosAcumulados += curr.litros;
      if (curr.gasto != null) {
        gastoAcumulado += curr.gasto;
        temGasto = true;
      }
      continue;
    }

    const litros = (curr.litros ?? 0) + litrosAcumulados;
    const gasto = temGasto ? (curr.gasto ?? 0) + gastoAcumulado : null;
    litrosAcumulados = 0;
    gastoAcumulado = 0;
    temGasto = false;

    intervalos.push({
      id: `${inicioChain.id}-${curr.id}`,
      inicio: inicioChain,
      fim: curr,
      litros,
      gasto,
      diff,
    });
    inicioChain = curr;
  }

  return intervalos;
}

/** Monta intervalos no formato do print a partir de abastecimentos consecutivos. */
function derivarIntervalosDeAbastecimentos(
  brutos: unknown[],
  equipmentId: string,
  porHora: boolean,
): IntervaloHistorico[] {
  return intervalosCalculadosDeAbastecimentos(brutos)
    .map((iv) => {
      const inicio = labelOuTraco(iv.inicio.dateTime);
      const fim = labelOuTraco(iv.fim.dateTime);
      if (inicio === "—" || fim === "—") return null;

      const unidade = porHora ? "h" : "km";
      return {
        id: iv.id || `${equipmentId}-${iv.inicio.id}-${iv.fim.id}`,
        periodoLabel: `${inicio} → ${fim}`,
        duracaoLabel: `${iv.diff.toLocaleString("pt-BR")} ${unidade}`,
        consumoLabel: fmtConsumoIntervalo(iv.litros, iv.diff, porHora),
        custoLabel:
          iv.gasto != null ? fmtCustoIntervalo(iv.gasto, iv.diff, porHora) : "—",
      };
    })
    .filter((iv): iv is IntervaloHistorico => iv != null);
}

interface MediaTaxa {
  valor: number;
  exibicao: string;
}

function fmtTaxaConsumo(taxa: number, porHora: boolean): string {
  return `${taxa.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${porHora ? "L/h" : "L/km"}`;
}

function fmtTaxaCusto(taxa: number, porHora: boolean): string {
  const moeda = taxa.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${moeda}${porHora ? "/h" : "/km"}`;
}

/** Percorre abastecimentos e mantém a última taxa válida; leitura repetida = mesma taxa. */
function ultimaTaxaConsumoEmAbastecimentos(
  brutos: unknown[],
  porHora: boolean,
): MediaTaxa | null {
  const ordenados = ordenarAbastecimentosBrutos(brutos);
  let ultima: MediaTaxa | null = null;
  let litrosAcumulados = 0;

  for (let i = 0; i < ordenados.length; i++) {
    const ab = ordenados[i];

    if (
      ab.previousReading != null &&
      ab.currentReading != null &&
      ab.litros != null
    ) {
      const diffAnterior = ab.currentReading - ab.previousReading;
      if (diffAnterior > 0) {
        const taxa = (ab.litros + litrosAcumulados) / diffAnterior;
        litrosAcumulados = 0;
        ultima = { valor: taxa, exibicao: fmtTaxaConsumo(taxa, porHora) };
      }
    }

    if (i === 0) continue;

    const prev = ordenados[i - 1];
    const diff =
      ab.currentReading != null && prev.currentReading != null
        ? ab.currentReading - prev.currentReading
        : null;

    if (diff != null && diff > 0 && ab.litros != null) {
      const taxa = ((ab.litros ?? 0) + litrosAcumulados) / diff;
      litrosAcumulados = 0;
      ultima = { valor: taxa, exibicao: fmtTaxaConsumo(taxa, porHora) };
      continue;
    }

    if (
      diff != null &&
      diff <= 0 &&
      ab.currentReading != null &&
      prev.currentReading != null &&
      ab.currentReading === prev.currentReading
    ) {
      if (litrosAcumulados === 0 && prev.litros != null) {
        litrosAcumulados += prev.litros;
      }
      if (ab.litros != null) litrosAcumulados += ab.litros;
      // Leitura igual: mantém a mesma taxa já calculada
      continue;
    }
  }

  return ultima;
}

/** Médio L/h (ou L/km) = Σ litros dos intervalos ÷ Σ horas/km rodadas. */
function mediaConsumoDeAbastecimentos(
  brutos: unknown[],
  porHora: boolean,
): MediaTaxa | null {
  const calculados = intervalosCalculadosDeAbastecimentos(brutos);
  let totalLitros = 0;
  let totalDeslocamento = 0;

  for (const iv of calculados) {
    totalLitros += iv.litros;
    totalDeslocamento += iv.diff;
  }

  if (totalDeslocamento > 0) {
    const taxa = totalLitros / totalDeslocamento;
    return { valor: taxa, exibicao: fmtTaxaConsumo(taxa, porHora) };
  }

  return ultimaTaxaConsumoEmAbastecimentos(brutos, porHora);
}

function mediaCustoDeAbastecimentos(
  brutos: unknown[],
  porHora: boolean,
): MediaTaxa | null {
  const calculados = intervalosCalculadosDeAbastecimentos(brutos);
  let totalGasto = 0;
  let totalDeslocamento = 0;

  for (const iv of calculados) {
    if (iv.gasto == null) continue;
    totalGasto += iv.gasto;
    totalDeslocamento += iv.diff;
  }

  if (totalDeslocamento > 0) {
    const taxa = totalGasto / totalDeslocamento;
    return { valor: taxa, exibicao: fmtTaxaCusto(taxa, porHora) };
  }

  return null;
}

function normalizarIntervalo(
  raw: unknown,
  index: number,
  equipmentId: string,
): IntervaloHistorico | null {
  if (!raw || typeof raw !== "object") return null;
  const iv = raw as Record<string, unknown>;

  return {
    id: asStr(iv.id) || `${equipmentId}-${index}`,
    periodoLabel: labelOuTraco(
      asStr(iv.periodoLabel ?? iv.periodo ?? iv.periodoExibicao),
    ),
    duracaoLabel: labelOuTraco(
      asStr(iv.distanciaLabel ?? iv.duracaoLabel ?? iv.distanciaExibicao),
    ),
    consumoLabel: labelOuTraco(
      asStr(iv.consumoLabel ?? iv.consumoExibicao ?? iv.consumo),
    ),
    custoLabel: labelOuTraco(asStr(iv.custoLabel ?? iv.custoExibicao ?? iv.custo)),
  };
}

function veiculoBrutoParaTela(raw: unknown): VeiculoConsumoCusto | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as Record<string, unknown>;
  const equipmentId = asStr(item.equipmentId ?? item.id);
  if (!equipmentId) return null;

  const titulo = montarTitulo(item, equipmentId);
  const consumoMedio = asMetrica(item.consumoMedio ?? item.mediaConsumo);
  const custoMedio = asMetrica(item.custoMedio ?? item.mediaCusto);
  const totalDestaque = asMetrica(item.totalDestaque) as TotalDestaqueApi | null;
  const totais = (item.totais ?? null) as TotaisApi | null;

  const unidade = asStr(item.unidadeMedicao ?? item.unit).toLowerCase();
  const measurementType = asStr(item.measurementType).toLowerCase();
  const porHora =
    unidade === "h" ||
    unidade.includes("hora") ||
    measurementType.includes("horimetro") ||
    measurementType.includes("hora");

  const litrosLabel = labelOuTraco(
    totais?.litrosExibicao ?? asStr(item.totalLitrosLabel),
  );
  const gastoLabel = labelOuTraco(
    totais?.gastoExibicao ?? asStr(item.totalGastoLabel),
  );

  const valorTerceira =
    labelOuTraco(totalDestaque?.valorExibicao) !== "—"
      ? labelOuTraco(totalDestaque?.valorExibicao)
      : totalDestaque?.tipo === "gasto"
        ? gastoLabel
        : litrosLabel;

  const labelTerceira = rotuloMetrica(
    totalDestaque,
    totalDestaque?.tipo === "gasto"
      ? "Gasto total"
      : porHora
        ? "Litros total"
        : "Gasto total",
  );

  const intervalosBrutos = Array.isArray(item.historicoIntervalos)
    ? item.historicoIntervalos
    : Array.isArray(item.intervalos)
      ? item.intervalos
      : [];

  let intervalos = intervalosBrutos
    .map((iv, index) => normalizarIntervalo(iv, index, equipmentId))
    .filter((iv): iv is IntervaloHistorico => iv != null);

  const abastecimentosBrutos = Array.isArray(item.historicoAbastecimentos)
    ? item.historicoAbastecimentos
    : Array.isArray(item.abastecimentos)
      ? item.abastecimentos
      : [];

  const abastecimentos = abastecimentosBrutos
    .map((ab, index) => normalizarAbastecimento(ab, index, equipmentId))
    .filter((ab): ab is AbastecimentoHistorico => ab != null);

  if (intervalos.length === 0 && abastecimentosBrutos.length >= 2) {
    intervalos = derivarIntervalosDeAbastecimentos(
      abastecimentosBrutos,
      equipmentId,
      porHora,
    );
  }

  const mediaConsumoDerivada =
    consumoMedio?.valor == null && intervalos.length === 0
      ? mediaConsumoDeAbastecimentos(abastecimentosBrutos, porHora)
      : null;

  const mediaCustoDerivada =
    custoMedio?.valor == null && intervalos.length === 0
      ? mediaCustoDeAbastecimentos(abastecimentosBrutos, porHora)
      : null;

  return {
    id: equipmentId,
    nome: titulo.nome,
    subtitulo: titulo.subtitulo,
    placa: titulo.placa,
    categoria: titulo.categoria,
    local: titulo.local,
    labelConsumo: rotuloMetrica(
      consumoMedio,
      porHora ? "Médio L/h" : "Médio L/km",
    ),
    labelCusto: rotuloMetrica(custoMedio, porHora ? "Custo /h" : "Custo /km"),
    labelTerceira,
    consumoValor: mediaConsumoDerivada
      ? mediaConsumoDerivada.valor.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : valorCurtoMetrica(consumoMedio),
    consumoLabel: mediaConsumoDerivada
      ? mediaConsumoDerivada.exibicao
      : valorMetrica(consumoMedio),
    custoValor: mediaCustoDerivada
      ? mediaCustoDerivada.valor.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : valorCurtoMetrica(custoMedio),
    custoLabel: mediaCustoDerivada
      ? mediaCustoDerivada.exibicao
      : valorMetrica(custoMedio),
    valorTerceira,
    litrosLabel,
    gastoLabel,
    intervalos,
    abastecimentos,
  };
}

function payloadParaTela(payload: ConsumoCustoPayloadApi): ConsumoCustoTela {
  const veiculos = (payload.veiculos ?? [])
    .map(veiculoBrutoParaTela)
    .filter((v): v is VeiculoConsumoCusto => v != null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const calculoApi = payload.calculo;

  return {
    titulo: payload.titulo?.trim() || "Consumo & Custo por Veículo",
    periodoLabel: payload.periodo?.label?.trim() || "",
    calculo: {
      titulo: calculoApi?.titulo?.trim() || CALCULO_CONSUMO_PADRAO.titulo,
      formulaConsumo:
        calculoApi?.formulaConsumo?.trim() ||
        CALCULO_CONSUMO_PADRAO.formulaConsumo,
      formulaCusto:
        calculoApi?.formulaCusto?.trim() || CALCULO_CONSUMO_PADRAO.formulaCusto,
      observacao:
        calculoApi?.observacao?.trim() || CALCULO_CONSUMO_PADRAO.observacao,
    },
    veiculos,
  };
}

export const consumoCustoApi = {
  async listarPorPeriodo(
    prefeituraId: string,
    startDate: string,
    endDate: string,
  ): Promise<ConsumoCustoTela> {
    const qs = new URLSearchParams({ startDate, endDate });
    const r = await api.get<{ data: ConsumoCustoPayloadApi | null }>(
      `/movimentacoes/consumo-custo/${prefeituraId}?${qs}`,
    );
    const payload = r.data ?? {};
    return payloadParaTela(
      typeof payload === "object" ? payload : { veiculos: [] },
    );
  },
};
