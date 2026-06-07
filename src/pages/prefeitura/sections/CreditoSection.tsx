import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Car,
  CreditCard,
  FileDown,
  Layers,
  Plus,
  Wallet,
} from "lucide-react";
import {
  creditoApi,
  type CreditoAlocacao,
  type CreditoTela,
} from "../../../lib/api/credito";
import type { DadosPrefeitura } from "../../../lib/hu360/types";
import { fmtPeriodoExibicao } from "./abastecimentoVisaoGeral";
import { baixarPlanilhaCredito } from "./creditoExport";
import "./credito.css";

interface CreditoSectionProps {
  dados: DadosPrefeitura;
  prefeituraId: string;
}

const ATALHOS_VALOR = [200, 500, 1000, 2000, 5000];

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

function fmtMoeda(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dataHojeLabel(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

export function CreditoSection({ prefeituraId }: CreditoSectionProps) {
  const [periodoInicio, setPeriodoInicio] = useState(isoInicioMes);
  const [periodoFim, setPeriodoFim] = useState(isoHoje);
  const [dados, setDados] = useState<CreditoTela | null>(null);
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

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setCarregando(true);
    setErro(null);
    try {
      const r = await creditoApi.listarPorPeriodo(
        prefeituraId,
        periodoInicio,
        periodoFim,
      );
      setDados(r);
      setResponsavel((atual) =>
        r.responsaveis.includes(atual) ? atual : (r.responsaveis[0] ?? ""),
      );
    } catch (e) {
      setDados(null);
      setErro(
        e instanceof Error ? e.message : "Não foi possível carregar o crédito.",
      );
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId, periodoInicio, periodoFim]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setDestinoId("");
  }, [alocacao]);

  const periodoExibicao =
    dados?.periodoLabel || fmtPeriodoExibicao(periodoInicio, periodoFim);

  const opcoesDestino =
    alocacao === "equipamento"
      ? (dados?.equipamentos ?? [])
      : (dados?.frentes ?? []);

  const podeExportar = !carregando && (dados?.historico.length ?? 0) > 0;

  const handleExportar = useCallback(() => {
    if (!podeExportar || !dados) return;
    baixarPlanilhaCredito(dados.historico, {
      prefeituraId,
      periodoInicio,
      periodoFim,
    });
  }, [podeExportar, dados, prefeituraId, periodoInicio, periodoFim]);

  const handleLancar = async (e: FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    const valor = parseValorInput(valorStr);
    if (!destinoId) {
      setFormMsg({ tone: "err", text: "Selecione o destino do crédito." });
      return;
    }
    if (valor <= 0) {
      setFormMsg({ tone: "err", text: "Informe um valor maior que zero." });
      return;
    }

    const opcao = opcoesDestino.find((o) => o.id === destinoId);
    const destinoLabel = opcao?.label ?? destinoId;

    setSalvando(true);
    try {
      await creditoApi.lancar(prefeituraId, {
        alocacao,
        destinoId,
        valor,
        responsavel,
        observacao: observacao.trim() || undefined,
      });
      setFormMsg({ tone: "ok", text: "Crédito lançado com sucesso." });
      setValorStr("0,00");
      setObservacao("");
      await carregar();
    } catch {
      if (!dados) {
        setFormMsg({
          tone: "err",
          text: "Não foi possível lançar o crédito.",
        });
        setSalvando(false);
        return;
      }

      const novo = {
        id: `local-${Date.now()}`,
        dataLabel: dataHojeLabel(),
        tipo: alocacao,
        tipoLabel: alocacao === "equipamento" ? "Equipamento" : "Frente",
        destino: destinoLabel,
        valorLabel: `+${fmtMoeda(valor)}`,
        responsavel,
        observacao: observacao.trim() || "—",
      };

      setDados({
        ...dados,
        historico: [novo, ...dados.historico],
        qtdCreditosEquipamento:
          alocacao === "equipamento"
            ? dados.qtdCreditosEquipamento + 1
            : dados.qtdCreditosEquipamento,
        qtdCreditosFrente:
          alocacao === "frente"
            ? dados.qtdCreditosFrente + 1
            : dados.qtdCreditosFrente,
      });
      setFormMsg({
        tone: "ok",
        text: "Crédito registrado localmente (API indisponível).",
      });
      setValorStr("0,00");
      setObservacao("");
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
            Período: {periodoExibicao}
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
            <strong>{dados?.totalCreditadoLabel ?? "—"}</strong>
            <span>Total creditado</span>
          </div>
        </article>
        <article className="crd-kpi">
          <div className="crd-kpi-icon crd-kpi-icon--amarelo" aria-hidden>
            <Car size={18} strokeWidth={2.25} />
          </div>
          <div className="crd-kpi-body">
            <strong>{dados?.qtdCreditosEquipamento ?? 0}</strong>
            <span>Créditos por equipamento</span>
          </div>
        </article>
        <article className="crd-kpi">
          <div className="crd-kpi-icon crd-kpi-icon--cinza" aria-hidden>
            <Layers size={18} strokeWidth={2.25} />
          </div>
          <div className="crd-kpi-body">
            <strong>{dados?.qtdCreditosFrente ?? 0}</strong>
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
              Equipamento
            </button>
            <button
              type="button"
              className={`crd-alocacao-btn${alocacao === "frente" ? " crd-alocacao-btn--ativo" : ""}`}
              onClick={() => setAlocacao("frente")}
            >
              Frente de trabalho
            </button>
            </div>
          </div>

          <div className="crd-form-field">
            <label htmlFor="crd-destino">
              {alocacao === "equipamento"
                ? "Equipamento / placa"
                : "Frente de trabalho"}
            </label>
            <select
              id="crd-destino"
              value={destinoId}
              onChange={(ev) => setDestinoId(ev.target.value)}
              disabled={carregando}
            >
              <option value="">Selecione…</option>
              {opcoesDestino.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.label}
                </option>
              ))}
            </select>
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
              {ATALHOS_VALOR.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="crd-atalho"
                  onClick={() =>
                    setValorStr(
                      fmtValorInput(parseValorInput(valorStr) + v),
                    )
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
              {(dados?.responsaveis ?? ["Financeiro"]).map((r) => (
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
              ) : (dados?.saldosEquipamento.length ?? 0) === 0 ? (
                <p className="crd-table-empty">Nenhum saldo por equipamento.</p>
              ) : (
                dados!.saldosEquipamento.map((eq) => (
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
              ) : (dados?.saldosFrente.length ?? 0) === 0 ? (
                <p className="crd-table-empty">Nenhum saldo por frente.</p>
              ) : (
                dados!.saldosFrente.map((fr) => (
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
                  ) : (dados?.historico.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={6} className="crd-table-empty">
                        Nenhum lançamento no período.
                      </td>
                    </tr>
                  ) : (
                    dados!.historico.map((item) => (
                      <tr key={item.id}>
                        <td>{item.dataLabel}</td>
                        <td>
                          <span
                            className={`crd-badge crd-badge--${item.tipo}`}
                          >
                            {item.tipoLabel}
                          </span>
                        </td>
                        <td>{item.destino}</td>
                        <td className="crd-valor-positivo">{item.valorLabel}</td>
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
