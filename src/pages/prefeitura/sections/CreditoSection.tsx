import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Car,
  CreditCard,
  FileDown,
  Layers,
  Plus,
  Wallet,
} from "lucide-react";
import { ApiError } from "../../../lib/api/client";
import {
  creditoApi,
  filtrarHistoricoPorPeriodo,
  mesclarHistoricoLancamentos,
  montarResumoCredito,
  type CreditoAlocacao,
  type CreditoOpcoesTela,
  type CreditoSaldosTela,
  type LancamentoCreditoTela,
} from "../../../lib/api/credito";
import { abastecimentosApi } from "../../../lib/api/abastecimentos";
import type { DadosPrefeitura } from "../../../lib/hu360/types";
import { fmtPeriodoExibicao } from "./abastecimentoVisaoGeral";
import { baixarPlanilhaCredito } from "./creditoExport";
import "./credito.css";

interface CreditoSectionProps {
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

function parseValorInput(v: string): number {
  const limpo = v
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

function fmtValorInput(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function labelAlocacao(
  opcoes: CreditoOpcoesTela | null,
  alocacao: CreditoAlocacao,
): string {
  const value = alocacao === "equipamento" ? "equipment" : "workFront";
  return (
    opcoes?.typeOptions.find((o) => o.value === value)?.label ??
    (alocacao === "equipamento" ? "Equipamento" : "Frente de trabalho")
  );
}

export function CreditoSection({ prefeituraId }: CreditoSectionProps) {
  const [periodoInicio, setPeriodoInicio] = useState(isoInicioMes);
  const [periodoFim, setPeriodoFim] = useState(isoHoje);
  const [opcoes, setOpcoes] = useState<CreditoOpcoesTela | null>(null);
  const [historicoCompleto, setHistoricoCompleto] = useState<LancamentoCreditoTela[]>(
    [],
  );
  const [saldos, setSaldos] = useState<CreditoSaldosTela>({
    saldosEquipamento: [],
    saldosFrente: [],
  });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [alocacao, setAlocacao] = useState<CreditoAlocacao>("equipamento");
  const [destinoId, setDestinoId] = useState("");
  const [valorStr, setValorStr] = useState("0,00");
  const [responsavel, setResponsavel] = useState("Financeiro");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [formMsg, setFormMsg] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  const periodoExibicao = fmtPeriodoExibicao(periodoInicio, periodoFim);

  const dados = useMemo(() => {
    const historico = filtrarHistoricoPorPeriodo(
      historicoCompleto,
      periodoInicio,
      periodoFim,
    );
    return montarResumoCredito(historico, periodoExibicao, saldos);
  }, [historicoCompleto, periodoInicio, periodoFim, periodoExibicao, saldos]);

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setCarregando(true);
    setErro(null);
    try {
      const [opts, creditos, abastecimentos, saldosData] = await Promise.all([
        creditoApi.obterOpcoes(prefeituraId),
        creditoApi.listar(prefeituraId),
        abastecimentosApi.listar(prefeituraId),
        creditoApi.obterSaldos(prefeituraId),
      ]);
      setOpcoes(opts);
      setHistoricoCompleto(mesclarHistoricoLancamentos(creditos, abastecimentos));
      setSaldos(saldosData);
      setResponsavel((atual) =>
        opts.responsaveis.includes(atual)
          ? atual
          : (opts.responsaveis[0] ?? "Financeiro"),
      );
    } catch (e) {
      setOpcoes(null);
      setHistoricoCompleto([]);
      setSaldos({ saldosEquipamento: [], saldosFrente: [] });
      setErro(
        e instanceof Error ? e.message : "Não foi possível carregar o crédito.",
      );
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setDestinoId("");
  }, [alocacao]);

  const atalhosValor = opcoes?.suggestedAmounts ?? [200, 500, 1000, 2000, 5000];

  const podeExportar = !carregando && dados.historico.length > 0;

  const handleExportar = useCallback(() => {
    if (!podeExportar) return;
    baixarPlanilhaCredito(dados.historico, {
      prefeituraId,
      periodoInicio,
      periodoFim,
    });
  }, [podeExportar, dados.historico, prefeituraId, periodoInicio, periodoFim]);

  const handleLancar = async (e: FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    const valor = parseValorInput(valorStr);
    const destino = destinoId.trim();

    if (!destino) {
      setFormMsg({
        tone: "err",
        text:
          alocacao === "equipamento"
            ? "Informe a placa ou o chassi do equipamento."
            : "Selecione a frente de trabalho.",
      });
      return;
    }
    if (valor < 0.01) {
      setFormMsg({
        tone: "err",
        text: "Informe um valor maior que zero.",
      });
      return;
    }

    setSalvando(true);
    try {
      await creditoApi.lancar(prefeituraId, {
        alocacao,
        destinoId: destino,
        valor,
        responsavel,
        observacao: observacao.trim() || undefined,
      });
      setFormMsg({ tone: "ok", text: "Crédito lançado com sucesso." });
      setValorStr("0,00");
      setObservacao("");
      setDestinoId("");
      await carregar();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Não foi possível lançar o crédito.";
      setFormMsg({ tone: "err", text: msg });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="pf-section">
      <header className="pf-section-head crd-header">
        <div className="crd-header-text">
          <h1 className="pf-section-title">Crédito de Abastecimento</h1>
          <p className="crd-periodo-label">
            <CalendarDays size={15} strokeWidth={2} aria-hidden />
            Período: {dados.periodoLabel}
          </p>
        </div>

        <div className="crd-periodo">
          <span className="crd-periodo-field-label">Período</span>
          <input
            id="crd-periodo-inicio"
            type="date"
            className="crd-periodo-input"
            value={periodoInicio}
            onChange={(ev) => setPeriodoInicio(ev.target.value)}
            aria-label="Data inicial do período"
          />
          <span className="crd-periodo-sep" aria-hidden>
            —
          </span>
          <input
            id="crd-periodo-fim"
            type="date"
            className="crd-periodo-input"
            value={periodoFim}
            onChange={(ev) => setPeriodoFim(ev.target.value)}
            aria-label="Data final do período"
          />
        </div>
      </header>

      <aside className="crd-info">
        <div className="crd-info-icon" aria-hidden>
          <CreditCard size={16} strokeWidth={2.25} />
        </div>
        <div className="crd-info-body">
          <strong>Como funciona o crédito de abastecimento</strong>
          <p>
            O crédito pode ser alocado por equipamento ou por frente de trabalho.
            O saldo é consumido nos abastecimentos em postos credenciados.
          </p>
          <p className="crd-formula">
            Saldo = total creditado − gasto nos postos credenciados
          </p>
        </div>
      </aside>

      {erro ? (
        <p className="crd-msg crd-msg--erro" role="alert">
          {erro}
        </p>
      ) : null}

      <div className="crd-kpis">
        <article className="crd-kpi">
          <div className="crd-kpi-icon crd-kpi-icon--verde" aria-hidden>
            <Wallet size={18} strokeWidth={2.25} />
          </div>
          <div className="crd-kpi-body">
            <strong>{carregando ? "—" : dados.totalCreditadoLabel}</strong>
            <span>Total creditado</span>
          </div>
        </article>
        <article className="crd-kpi">
          <div className="crd-kpi-icon crd-kpi-icon--amarelo" aria-hidden>
            <Car size={18} strokeWidth={2.25} />
          </div>
          <div className="crd-kpi-body">
            <strong>{carregando ? "—" : dados.qtdCreditosEquipamento}</strong>
            <span>Créditos por equipamento</span>
          </div>
        </article>
        <article className="crd-kpi">
          <div className="crd-kpi-icon crd-kpi-icon--cinza" aria-hidden>
            <Layers size={18} strokeWidth={2.25} />
          </div>
          <div className="crd-kpi-body">
            <strong>{carregando ? "—" : dados.qtdCreditosFrente}</strong>
            <span>Créditos por frente</span>
          </div>
        </article>
      </div>

      <div className="crd-layout">
        <form className="crd-form-card" onSubmit={handleLancar}>
          <h2 className="crd-form-title">Adicionar crédito</h2>

          <div className="crd-form-field">
            <span>Alocar por</span>
            <div className="crd-alocacao" role="group" aria-label="Alocar por">
              <button
                type="button"
                className={`crd-alocacao-btn${alocacao === "equipamento" ? " crd-alocacao-btn--ativo" : ""}`}
                onClick={() => setAlocacao("equipamento")}
              >
                {labelAlocacao(opcoes, "equipamento")}
              </button>
              <button
                type="button"
                className={`crd-alocacao-btn${alocacao === "frente" ? " crd-alocacao-btn--ativo" : ""}`}
                onClick={() => setAlocacao("frente")}
              >
                {labelAlocacao(opcoes, "frente")}
              </button>
            </div>
          </div>

          <div className="crd-form-field">
            {alocacao === "equipamento" ? (
              <>
                <label htmlFor="crd-destino">Equipamento / placa / chassi</label>
                <input
                  id="crd-destino"
                  type="text"
                  list="crd-equip-list"
                  value={destinoId}
                  onChange={(ev) => setDestinoId(ev.target.value)}
                  placeholder="Digite ou selecione placa/chassi…"
                  disabled={carregando}
                  autoComplete="off"
                />
                <datalist id="crd-equip-list">
                  {(opcoes?.equipamentos ?? []).map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.label}
                    </option>
                  ))}
                </datalist>
              </>
            ) : (
              <>
                <label htmlFor="crd-destino">Frente de trabalho</label>
                <select
                  id="crd-destino"
                  value={destinoId}
                  onChange={(ev) => setDestinoId(ev.target.value)}
                  disabled={carregando}
                >
                  <option value="">Selecione…</option>
                  {(opcoes?.frentes ?? []).map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div className="crd-form-field">
            <label htmlFor="crd-valor">Valor do crédito (R$)</label>
            <input
              id="crd-valor"
              type="text"
              inputMode="decimal"
              value={valorStr}
              onChange={(ev) => setValorStr(ev.target.value)}
              onBlur={() => {
                const n = parseValorInput(valorStr);
                setValorStr(fmtValorInput(n));
              }}
            />
            <div className="crd-atalhos">
              {atalhosValor.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="crd-atalho"
                  onClick={() =>
                    setValorStr(fmtValorInput(parseValorInput(valorStr) + v))
                  }
                >
                  + {v.toLocaleString("pt-BR")}
                </button>
              ))}
            </div>
          </div>

          <div className="crd-form-field">
            <label htmlFor="crd-responsavel">Responsável</label>
            <select
              id="crd-responsavel"
              value={responsavel}
              onChange={(ev) => setResponsavel(ev.target.value)}
            >
              {(opcoes?.responsaveis ?? ["Financeiro"]).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="crd-form-field">
            <label htmlFor="crd-obs">Observação (opcional)</label>
            <textarea
              id="crd-obs"
              value={observacao}
              onChange={(ev) => setObservacao(ev.target.value)}
              placeholder="Ex.: previsão mensal, projeto específico…"
            />
          </div>

          {formMsg ? (
            <p
              className={`crd-msg crd-msg--${formMsg.tone}`}
              role={formMsg.tone === "err" ? "alert" : "status"}
            >
              {formMsg.text}
            </p>
          ) : null}

          <button
            type="submit"
            className="crd-btn-lancar"
            disabled={salvando || carregando}
          >
            <Plus size={16} strokeWidth={2.5} aria-hidden />{" "}
            {salvando ? "Lançando…" : "Lançar crédito"}
          </button>
        </form>

        <div className="crd-col-direita">
          <section>
            <div className="crd-saldos-head">
              <h2 className="crd-saldos-titulo">Saldo por equipamento</h2>
            </div>
            <div className="crd-saldos-grid">
              {carregando ? (
                <p className="crd-table-empty">Carregando…</p>
              ) : dados.saldosEquipamento.length === 0 ? (
                <p className="crd-table-empty">Nenhum saldo por equipamento.</p>
              ) : (
                dados.saldosEquipamento.map((eq) => (
                  <article key={eq.id} className="crd-saldo-card">
                    <strong>{eq.nome}</strong>
                    <span>
                      {eq.placa} · {eq.local}
                    </span>
                    <div className="crd-saldo-valor">{eq.saldoLabel}</div>
                    <div className="crd-saldo-rodape">
                      <span>Creditado {eq.creditadoLabel}</span>
                      <span>Gasto {eq.gastoLabel}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section>
            <div className="crd-saldos-head">
              <h2 className="crd-saldos-titulo">Saldo por frente de trabalho</h2>
              <p className="crd-saldos-hint">
                Descontado pelos veículos da frente sem crédito próprio
              </p>
            </div>
            <div className="crd-saldos-grid">
              {carregando ? (
                <p className="crd-table-empty">Carregando…</p>
              ) : dados.saldosFrente.length === 0 ? (
                <p className="crd-table-empty">Nenhum saldo por frente.</p>
              ) : (
                dados.saldosFrente.map((fr) => (
                  <article key={fr.id} className="crd-saldo-card">
                    <strong>{fr.nome}</strong>
                    <div className="crd-saldo-valor">{fr.saldoLabel}</div>
                    <div className="crd-saldo-rodape">
                      <span>Creditado {fr.creditadoLabel}</span>
                      <span>Gasto {fr.gastoLabel}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="crd-historico-card">
            <div className="crd-historico-head">
              <h2>Histórico de lançamentos</h2>
              <button
                type="button"
                className="crd-btn-export"
                onClick={handleExportar}
                disabled={!podeExportar}
              >
                <FileDown size={15} strokeWidth={2.25} aria-hidden />
                Baixar planilha
              </button>
            </div>

            <div className="crd-table-wrap">
              <table className="crd-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Destino</th>
                    <th>Valor</th>
                    <th>Responsável</th>
                    <th>Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {carregando ? (
                    <tr>
                      <td colSpan={6} className="crd-table-empty">
                        Carregando histórico…
                      </td>
                    </tr>
                  ) : dados.historico.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="crd-table-empty">
                        {historicoCompleto.length > 0
                          ? `Nenhum lançamento entre ${periodoExibicao}. Há ${historicoCompleto.length} registro(s) fora deste intervalo — ajuste o período acima.`
                          : "Nenhum crédito lançado para esta prefeitura."}
                      </td>
                    </tr>
                  ) : (
                    dados.historico.map((item) => (
                      <tr key={item.id}>
                        <td>{item.dataLabel}</td>
                        <td>
                          <span
                            className={`crd-badge crd-badge--${
                              item.direcao === "saida" ? "saida" : item.tipo
                            }`}
                          >
                            {item.tipoLabel}
                          </span>
                        </td>
                        <td>{item.destino}</td>
                        <td
                          className={
                            item.direcao === "saida"
                              ? "crd-valor-negativo"
                              : "crd-valor-positivo"
                          }
                        >
                          {item.valorLabel}
                        </td>
                        <td>{item.responsavel}</td>
                        <td>{item.observacao}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
