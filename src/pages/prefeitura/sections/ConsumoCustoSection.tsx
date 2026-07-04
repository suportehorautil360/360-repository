import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  FileDown,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  consumoCustoApi,
  valorMetricaCard,
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
  return `${prefeituraId}|${inicio}|${fim}|v15`;
}

const cacheConsumoCusto = new Map<string, ConsumoCustoTela>();

function normBusca(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function metricaExibicao(curto: string, label: string): string {
  return valorMetricaCard(curto, label);
}

export function ConsumoCustoSection({
  prefeituraId,
}: ConsumoCustoSectionProps) {
  const [periodoInicio, setPeriodoInicio] = useState(isoInicioMes);
  const [periodoFim, setPeriodoFim] = useState(isoHoje);
  const [titulo, setTitulo] = useState("Consumo & Custo por Veículo");
  const [periodoLabel, setPeriodoLabel] = useState("");
  const [veiculos, setVeiculos] = useState<VeiculoConsumoCusto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linhaAberta, setLinhaAberta] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!prefeituraId || !periodoInicio || !periodoFim) return;

    const chave = chaveCache(prefeituraId, periodoInicio, periodoFim);
    const emCache = cacheConsumoCusto.get(chave);
    if (emCache) {
      setTitulo(emCache.titulo);
      setPeriodoLabel(emCache.periodoLabel);
      setVeiculos(emCache.veiculos);
    }

    let ativo = true;
    setAtualizando(Boolean(emCache));
    setCarregando(!emCache);
    setErro(null);

    consumoCustoApi
      .listarPorPeriodo(prefeituraId, periodoInicio, periodoFim)
      .then((data) => {
        if (!ativo) return;
        cacheConsumoCusto.set(chave, data);
        setTitulo(data.titulo);
        setPeriodoLabel(data.periodoLabel);
        setVeiculos(data.veiculos);
      })
      .catch((e) => {
        if (!ativo) return;
        if (!emCache) {
          setVeiculos([]);
          setPeriodoLabel("");
        }
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar os dados.",
        );
      })
      .finally(() => {
        if (ativo) {
          setCarregando(false);
          setAtualizando(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, [prefeituraId, periodoInicio, periodoFim, refreshToken]);

  useEffect(() => {
    const recarregarAoVoltar = () => {
      if (document.visibilityState === "visible") {
        setRefreshToken((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", recarregarAoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", recarregarAoVoltar);
    };
  }, []);

  useEffect(() => {
    setLinhaAberta(null);
  }, [periodoInicio, periodoFim, busca]);

  const periodoExibicao =
    periodoLabel || fmtPeriodoExibicao(periodoInicio, periodoFim);

  const veiculosFiltrados = useMemo(() => {
    const q = normBusca(busca.trim());
    if (!q) return veiculos;
    return veiculos.filter((v) =>
      normBusca(`${v.nome} ${v.placa} ${v.subtitulo} ${v.categoria} ${v.local}`).includes(q),
    );
  }, [veiculos, busca]);

  const resumo = useMemo(() => {
    const comCusto = veiculosFiltrados.filter((v) => v.custoLabel !== "—").length;
    const comConsumo = veiculosFiltrados.filter((v) => v.consumoLabel !== "—").length;
    return {
      total: veiculosFiltrados.length,
      comCusto,
      comConsumo,
    };
  }, [veiculosFiltrados]);

  const podeExportar = !carregando && veiculosFiltrados.length > 0;

  const handleExportar = useCallback(() => {
    if (!podeExportar) return;
    baixarPlanilhaConsumoCusto(veiculosFiltrados, {
      prefeituraId,
      periodoInicio,
      periodoFim,
      periodoLabel: periodoExibicao,
    });
  }, [
    podeExportar,
    veiculosFiltrados,
    prefeituraId,
    periodoInicio,
    periodoFim,
    periodoExibicao,
  ]);

  const toggleLinha = useCallback((id: string) => {
    setLinhaAberta((atual) => (atual === id ? null : id));
  }, []);

  const handleAtualizar = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  return (
    <section className="pf-section ccu-page">
      <header className="ccu-header">
        <div className="ccu-header-text">
          <h1 className="pf-section-title">{titulo}</h1>
          <p className="ccu-periodo-label">
            <CalendarDays size={15} strokeWidth={2} aria-hidden />
            Período: {periodoExibicao}
          </p>
        </div>

        <div className="ccu-header-actions">
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

          <div className="ccu-toolbar">
            <button
              type="button"
              className="ccu-btn-refresh"
              onClick={handleAtualizar}
              disabled={carregando || atualizando}
              title="Buscar dados atualizados do servidor"
            >
              <RefreshCw
                size={16}
                strokeWidth={2.25}
                className={
                  atualizando ? "ccu-btn-refresh-icon--spin" : undefined
                }
                aria-hidden
              />
              Atualizar
            </button>
            <button
              type="button"
              className="ccu-btn-export"
              onClick={handleExportar}
              disabled={!podeExportar}
              title={
                podeExportar
                  ? "Exportar consumo e custo para Excel"
                  : "Nenhum dado para exportar"
              }
            >
              <FileDown size={16} strokeWidth={2.25} aria-hidden />
              Exportar Excel
            </button>
          </div>
        </div>
      </header>

      {erro ? (
        <p className="ccu-msg ccu-msg--erro" role="alert">
          {erro}
        </p>
      ) : null}

      <div className="ccu-kpis">
        <article className="ccu-kpi">
          <span className="ccu-kpi-label">Veículos no período</span>
          <strong>{resumo.total}</strong>
        </article>
        <article className="ccu-kpi">
          <span className="ccu-kpi-label">Com consumo calculado</span>
          <strong>{resumo.comConsumo}</strong>
        </article>
        <article className="ccu-kpi">
          <span className="ccu-kpi-label">Com custo calculado</span>
          <strong>{resumo.comCusto}</strong>
        </article>
      </div>

      <div className="ccu-table-panel">
        <div className="ccu-table-toolbar">
          <label className="ccu-busca">
            <Search size={15} strokeWidth={2.25} aria-hidden />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar veículo, placa ou categoria…"
              aria-label="Buscar veículo"
            />
          </label>
          <span className="ccu-table-count">
            {veiculosFiltrados.length} de {veiculos.length} veículo
            {veiculos.length === 1 ? "" : "s"}
          </span>
        </div>

        {carregando && veiculos.length === 0 ? (
          <p className="ccu-empty">Carregando dados dos veículos…</p>
        ) : veiculos.length === 0 ? (
          <p className="ccu-empty">
            Nenhum abastecimento no período para calcular consumo e custo.
          </p>
        ) : veiculosFiltrados.length === 0 ? (
          <p className="ccu-empty">Nenhum veículo corresponde à busca.</p>
        ) : (
          <div className="ccu-table-scroll">
            <table className="ccu-table">
              <thead>
                <tr>
                  <th className="ccu-col-expand" aria-label="Detalhes" />
                  <th>Veículo</th>
                  <th>Placa</th>
                  <th>Categoria</th>
                  <th>Local</th>
                  <th className="ccu-num">Consumo médio</th>
                  <th className="ccu-num">Custo unitário</th>
                  <th className="ccu-num">Litros total</th>
                  <th className="ccu-num">Gasto total</th>
                </tr>
              </thead>
              <tbody>
                {veiculosFiltrados.map((item) => {
                  const aberto = linhaAberta === item.id;
                  const temDetalhe =
                    item.intervalos.length > 0 || item.abastecimentos.length > 0;
                  const consumo = metricaExibicao(
                    item.consumoValor,
                    item.consumoLabel,
                  );
                  const custo = metricaExibicao(item.custoValor, item.custoLabel);

                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`ccu-row${aberto ? " ccu-row--aberto" : ""}${temDetalhe ? " ccu-row--clicavel" : ""}`}
                        onClick={
                          temDetalhe
                            ? () => toggleLinha(item.id)
                            : undefined
                        }
                        onKeyDown={
                          temDetalhe
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleLinha(item.id);
                                }
                              }
                            : undefined
                        }
                        tabIndex={temDetalhe ? 0 : undefined}
                        role={temDetalhe ? "button" : undefined}
                        aria-expanded={temDetalhe ? aberto : undefined}
                      >
                        <td className="ccu-col-expand">
                          {temDetalhe ? (
                            <ChevronDown
                              size={16}
                              className={`ccu-row-chevron${aberto ? " ccu-row-chevron--aberto" : ""}`}
                              aria-hidden
                            />
                          ) : null}
                        </td>
                        <td>
                          <strong className="ccu-veiculo-nome">{item.nome}</strong>
                          <span className="ccu-veiculo-sub">{item.subtitulo}</span>
                        </td>
                        <td>
                          <span className="ccu-placa">
                            {item.placa || "—"}
                          </span>
                        </td>
                        <td>{item.categoria}</td>
                        <td>{item.local}</td>
                        <td className="ccu-num">
                          <span
                            className={
                              consumo === "—" ? "ccu-valor--muted" : "ccu-valor"
                            }
                          >
                            {consumo}
                          </span>
                          <small>{item.labelConsumo}</small>
                        </td>
                        <td className="ccu-num">
                          <span
                            className={
                              custo === "—" ? "ccu-valor--muted" : "ccu-valor"
                            }
                          >
                            {custo}
                          </span>
                          <small>{item.labelCusto}</small>
                        </td>
                        <td className="ccu-num">
                          <span
                            className={
                              item.litrosLabel === "—"
                                ? "ccu-valor--muted"
                                : "ccu-valor"
                            }
                          >
                            {item.litrosLabel}
                          </span>
                        </td>
                        <td className="ccu-num">
                          <span
                            className={
                              item.gastoLabel === "—"
                                ? "ccu-valor--muted"
                                : "ccu-valor ccu-valor--destaque"
                            }
                          >
                            {item.gastoLabel}
                          </span>
                        </td>
                      </tr>
                      {aberto && temDetalhe ? (
                        <tr className="ccu-row-detalhe">
                          <td colSpan={9}>
                            <div className="ccu-detalhe-wrap">
                              {item.intervalos.length > 0 ? (
                                <>
                                  <h3 className="ccu-detalhe-titulo">
                                    Histórico de intervalos
                                  </h3>
                                  <table className="ccu-table ccu-table--nested">
                                    <thead>
                                      <tr>
                                        <th>Período</th>
                                        <th>Distância / duração</th>
                                        <th className="ccu-num">Consumo</th>
                                        <th className="ccu-num">Custo</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.intervalos.map((intervalo) => (
                                        <tr key={intervalo.id}>
                                          <td>{intervalo.periodoLabel}</td>
                                          <td>{intervalo.duracaoLabel}</td>
                                          <td className="ccu-num ccu-valor--consumo">
                                            {intervalo.consumoLabel}
                                          </td>
                                          <td
                                            className={`ccu-num${intervalo.custoLabel === "—" ? " ccu-valor--muted" : ""}`}
                                          >
                                            {intervalo.custoLabel}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </>
                              ) : null}

                              {item.abastecimentos.length > 0 ? (
                                <>
                                  <h3 className="ccu-detalhe-titulo">
                                    Abastecimentos no período
                                  </h3>
                                  <table className="ccu-table ccu-table--nested">
                                    <thead>
                                      <tr>
                                        <th>Data / hora</th>
                                        <th>Leitura</th>
                                        <th className="ccu-num">Litros</th>
                                        <th className="ccu-num">Gasto</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.abastecimentos.map((abast) => (
                                        <tr key={abast.id}>
                                          <td>{abast.dateTimeLabel}</td>
                                          <td>{abast.leituraLabel}</td>
                                          <td className="ccu-num ccu-valor--consumo">
                                            {abast.litrosLabel}
                                          </td>
                                          <td
                                            className={`ccu-num${abast.gastoLabel === "—" ? " ccu-valor--muted" : ""}`}
                                          >
                                            {abast.gastoLabel}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
