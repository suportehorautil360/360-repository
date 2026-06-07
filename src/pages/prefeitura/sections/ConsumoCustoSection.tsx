import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  FileDown,
  TrendingUp,
} from "lucide-react";
import {
  CALCULO_CONSUMO_PADRAO,
  consumoCustoApi,
  valorMetricaCard,
  type ConsumoCustoCalculoTela,
  type ConsumoCustoTela,
  type VeiculoConsumoCusto,
} from "../../../lib/api/consumoCusto";
import type { DadosPrefeitura } from "../../../lib/hu360/types";
import { fmtPeriodoExibicao } from "./abastecimentoVisaoGeral";
import { baixarPlanilhaConsumoCusto } from "./consumoCustoExport";
import "./consumo-custo.css";

interface ConsumoCustoSectionProps {
  dados: DadosPrefeitura;
  prefeituraId: string;
}

function isoInicioMes(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function isoHoje(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function chaveCache(
  prefeituraId: string,
  inicio: string,
  fim: string,
): string {
  return `${prefeituraId}|${inicio}|${fim}|v12`;
}

const cacheConsumoCusto = new Map<string, ConsumoCustoTela>();

function CardVeiculo({
  item,
  aberto,
  onToggle,
}: {
  item: VeiculoConsumoCusto;
  aberto: boolean;
  onToggle: () => void;
}) {
  const consumoExibicao = valorMetricaCard(
    item.consumoValor,
    item.consumoLabel,
  );
  const custoExibicao = valorMetricaCard(item.custoValor, item.custoLabel);

  return (
    <article className={`ccu-card${aberto ? " ccu-card--aberto" : ""}`}>
      <button
        type="button"
        className="ccu-card-toggle"
        onClick={onToggle}
        aria-expanded={aberto}
        aria-label={
          aberto
            ? `Recolher detalhes de ${item.nome}`
            : `Expandir detalhes de ${item.nome}`
        }
      >
        <div className="ccu-card-titulo">
          <strong>{item.nome}</strong>
          <span>{item.subtitulo}</span>
        </div>
        <ChevronDown
          className={`ccu-card-chevron${aberto ? " ccu-card-chevron--aberto" : ""}`}
          size={16}
          strokeWidth={2.25}
          aria-hidden
        />
      </button>

      <div className="ccu-card-metrics">
        <div className="ccu-metric-box">
          <span
            className={`ccu-metric-valor${consumoExibicao === "—" ? " ccu-metric-valor--muted" : ""}`}
          >
            {consumoExibicao}
          </span>
          <span className="ccu-metric-label">{item.labelConsumo}</span>
        </div>
        <div className="ccu-metric-box">
          <span
            className={`ccu-metric-valor${custoExibicao === "—" ? " ccu-metric-valor--muted" : ""}`}
          >
            {custoExibicao}
          </span>
          <span className="ccu-metric-label">{item.labelCusto}</span>
        </div>
        <div className="ccu-metric-box">
          <span
            className={`ccu-metric-valor${item.valorTerceira === "—" ? " ccu-metric-valor--muted" : ""}`}
          >
            {item.valorTerceira}
          </span>
          <span className="ccu-metric-label">{item.labelTerceira}</span>
        </div>
      </div>

      <div
        className={`ccu-card-expand${aberto ? " ccu-card-expand--aberto" : ""}`}
      >
        <div className="ccu-card-expand-inner">
          <div className="ccu-card-detalhe">
            <div className="ccu-historico">
              <h3 className="ccu-historico-titulo">
                {item.intervalos.length > 0
                  ? "Histórico de intervalos"
                  : "Histórico de abastecimentos"}
              </h3>

              {item.intervalos.length > 0 ? (
                <ul className="ccu-historico-lista">
                  {item.intervalos.map((intervalo) => (
                    <li key={intervalo.id} className="ccu-historico-row">
                      <span className="ccu-historico-periodo">
                        {intervalo.periodoLabel}
                      </span>
                      <span className="ccu-historico-duracao">
                        {intervalo.duracaoLabel}
                      </span>
                      <span className="ccu-historico-consumo">
                        {intervalo.consumoLabel}
                      </span>
                      <span
                        className={`ccu-historico-custo${intervalo.custoLabel === "—" ? " ccu-historico-custo--muted" : ""}`}
                      >
                        {intervalo.custoLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : item.abastecimentos.length > 0 ? (
                <ul className="ccu-historico-lista">
                  {item.abastecimentos.map((abastecimento) => (
                    <li
                      key={abastecimento.id}
                      className="ccu-historico-row ccu-historico-row--abast"
                    >
                      <span className="ccu-historico-periodo">
                        {abastecimento.dateTimeLabel}
                      </span>
                      <span className="ccu-historico-duracao">
                        {abastecimento.leituraLabel}
                      </span>
                      <span className="ccu-historico-consumo">
                        {abastecimento.litrosLabel}
                      </span>
                      <span
                        className={`ccu-historico-custo${abastecimento.gastoLabel === "—" ? " ccu-historico-custo--muted" : ""}`}
                      >
                        {abastecimento.gastoLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ccu-historico-vazio">
                  Sem abastecimentos no período.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ConsumoCustoSection({
  prefeituraId,
}: ConsumoCustoSectionProps) {
  const [periodoInicio, setPeriodoInicio] = useState(isoInicioMes);
  const [periodoFim, setPeriodoFim] = useState(isoHoje);
  const [titulo, setTitulo] = useState("Consumo & Custo por Veículo");
  const [periodoLabel, setPeriodoLabel] = useState("");
  const [calculo, setCalculo] = useState<ConsumoCustoCalculoTela>(
    CALCULO_CONSUMO_PADRAO,
  );
  const [veiculos, setVeiculos] = useState<VeiculoConsumoCusto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cardAberto, setCardAberto] = useState<string | null>(null);

  useEffect(() => {
    if (!prefeituraId || !periodoInicio || !periodoFim) return;

    const chave = chaveCache(prefeituraId, periodoInicio, periodoFim);
    const emCache = cacheConsumoCusto.get(chave);
    if (emCache) {
      setTitulo(emCache.titulo);
      setPeriodoLabel(emCache.periodoLabel);
      setCalculo(emCache.calculo);
      setVeiculos(emCache.veiculos);
      setErro(null);
      setCarregando(false);
      return;
    }

    let ativo = true;
    setCarregando(true);
    setErro(null);

    consumoCustoApi
      .listarPorPeriodo(prefeituraId, periodoInicio, periodoFim)
      .then((data) => {
        if (!ativo) return;
        cacheConsumoCusto.set(chave, data);
        setTitulo(data.titulo);
        setPeriodoLabel(data.periodoLabel);
        setCalculo(data.calculo);
        setVeiculos(data.veiculos);
      })
      .catch((e) => {
        if (!ativo) return;
        setVeiculos([]);
        setPeriodoLabel("");
        setCalculo(CALCULO_CONSUMO_PADRAO);
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar os dados.",
        );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [prefeituraId, periodoInicio, periodoFim]);

  useEffect(() => {
    setCardAberto(null);
  }, [periodoInicio, periodoFim]);

  const periodoExibicao =
    periodoLabel || fmtPeriodoExibicao(periodoInicio, periodoFim);
  const podeExportar = !carregando && veiculos.length > 0;

  const handleExportar = useCallback(() => {
    if (!podeExportar) return;
    baixarPlanilhaConsumoCusto(veiculos, {
      prefeituraId,
      periodoInicio,
      periodoFim,
    });
  }, [podeExportar, veiculos, prefeituraId, periodoInicio, periodoFim]);

  const toggleCard = useCallback((id: string) => {
    setCardAberto((atual) => (atual === id ? null : id));
  }, []);

  return (
    <section className="pf-section">
      <header className="pf-section-head ccu-header">
        <div className="ccu-header-text">
          <h1 className="pf-section-title">{titulo}</h1>
          <p className="ccu-periodo-label">
            <CalendarDays size={15} strokeWidth={2} aria-hidden />
            Período: {periodoExibicao}
          </p>
        </div>

        <div className="ccu-periodo">
          <span className="ccu-periodo-field-label">Período</span>
          <input
            id="ccu-periodo-inicio"
            type="date"
            className="ccu-periodo-input"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            aria-label="Data inicial do período"
          />
          <span className="ccu-periodo-sep" aria-hidden>
            —
          </span>
          <input
            id="ccu-periodo-fim"
            type="date"
            className="ccu-periodo-input"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            aria-label="Data final do período"
          />
        </div>
      </header>

      <aside className="ccu-info">
        <div className="ccu-info-icon" aria-hidden>
          <TrendingUp size={16} strokeWidth={2.25} />
        </div>
        <div className="ccu-info-body">
          <strong>{calculo.titulo}</strong>
          <p className="ccu-formula">{calculo.formulaConsumo}</p>
          {calculo.formulaCusto ? (
            <p>{calculo.formulaCusto}</p>
          ) : null}
          {calculo.observacao ? (
            <p className="ccu-info-nota">{calculo.observacao}</p>
          ) : null}
        </div>
      </aside>

      {erro ? (
        <p className="ccu-msg ccu-msg--erro" role="alert">
          {erro}
        </p>
      ) : null}

      <div className="ccu-toolbar">
        <button
          type="button"
          className="ccu-btn-export"
          onClick={handleExportar}
          disabled={!podeExportar}
          title={
            podeExportar
              ? "Exportar consumo e custo para planilha"
              : "Nenhum dado para exportar"
          }
        >
          <FileDown size={16} strokeWidth={2.25} aria-hidden />
          Exportar consumo + custo
        </button>
      </div>

      <div className="ccu-grid">
        {carregando ? (
          <p className="ccu-empty">Carregando dados dos veículos…</p>
        ) : veiculos.length === 0 ? (
          <p className="ccu-empty">
            Nenhum abastecimento no período para calcular consumo e custo.
          </p>
        ) : (
          veiculos.map((item) => (
            <CardVeiculo
              key={item.id}
              item={item}
              aberto={cardAberto === item.id}
              onToggle={() => toggleCard(item.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
