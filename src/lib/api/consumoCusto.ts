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

  const intervalos = intervalosBrutos
    .map((iv, index) => normalizarIntervalo(iv, index, equipmentId))
    .filter((iv): iv is IntervaloHistorico => iv != null);

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
    consumoValor: valorCurtoMetrica(consumoMedio),
    consumoLabel: valorMetrica(consumoMedio),
    custoValor: valorCurtoMetrica(custoMedio),
    custoLabel: valorMetrica(custoMedio),
    valorTerceira,
    litrosLabel,
    gastoLabel,
    intervalos,
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
