import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  Clock3,
  DollarSign,
  FileText,
  CheckCircle2,
} from "lucide-react";
import {
  fmtDataNotaFiscal,
  fmtPeriodoNotasFiscais,
  fmtValorNotaFiscal,
  fmtValorNotaFiscalRow,
  labelStatusNotaFiscal,
  mensagemErroListarNotasFiscais,
  notasFiscaisApi,
  type NotaFiscalListItem,
  type NotasFiscaisResumo,
  type NotaFiscalStatus,
} from "../../../lib/api/notas-fiscais";
import {
  fmtMoedaGrafico,
  NotasFiscaisGraficoBarras,
} from "./NotasFiscaisGraficoBarras";
import "./notas-fiscais.css";

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

const RESUMO_VAZIO: NotasFiscaisResumo = {
  totalNotas: 0,
  valorTotal: 0,
  pendentes: 0,
  aprovadas: 0,
  rejeitadas: 0,
  oficinas: 0,
  porMes: [],
  porStatus: [],
  porOficina: [],
};

export function NotasFiscaisSection({ prefeituraId }: { prefeituraId: string }) {
  const [rows, setRows] = useState<NotaFiscalListItem[]>([]);
  const [resumo, setResumo] = useState<NotasFiscaisResumo>(RESUMO_VAZIO);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<NotaFiscalStatus | "todos">("todos");
  const [dataInicio, setDataInicio] = useState(isoInicioMes);
  const [dataFim, setDataFim] = useState(isoHoje);

  const carregar = useCallback(async () => {
    if (!prefeituraId) {
      setRows([]);
      setResumo(RESUMO_VAZIO);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const resp = await notasFiscaisApi.listarPorPrefeitura(prefeituraId, {
        busca,
        status,
        startDate: dataInicio,
        endDate: dataFim,
      });
      setRows(resp.data);
      setResumo(resp.resumo ?? RESUMO_VAZIO);
    } catch (err) {
      setRows([]);
      setResumo(RESUMO_VAZIO);
      setErro(mensagemErroListarNotasFiscais(err));
    } finally {
      setLoading(false);
    }
  }, [prefeituraId, busca, status, dataInicio, dataFim]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void carregar();
    }, busca ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [carregar, busca]);

  const kpis = useMemo(
    () => [
      {
        id: "total",
        icon: FileText,
        label: "Notas no período",
        valor: String(resumo.totalNotas),
      },
      {
        id: "valor",
        icon: DollarSign,
        label: "Valor identificado",
        valor: fmtValorNotaFiscal(resumo.valorTotal),
      },
      {
        id: "pendentes",
        icon: Clock3,
        label: "Pendentes",
        valor: String(resumo.pendentes),
      },
      {
        id: "aprovadas",
        icon: CheckCircle2,
        label: "Aprovadas",
        valor: String(resumo.aprovadas),
      },
      {
        id: "oficinas",
        icon: Building2,
        label: "Oficinas",
        valor: String(resumo.oficinas),
      },
    ],
    [resumo],
  );

  return (
    <section className="nf-page">
      <div className="nf-wrap">
        <h1 className="nf-title">Notas Fiscais</h1>
        <p className="nf-subtitle">
          Notas enviadas pelas oficinas credenciadas após conclusão do serviço.
          Veja de qual oficina veio cada NF, a O.S. vinculada e baixe o PDF.
        </p>

        <div className="nf-periodo">
          <CalendarDays size={16} aria-hidden />
          <span>{fmtPeriodoNotasFiscais(dataInicio, dataFim)}</span>
        </div>

        <div className="nf-kpis">
          {kpis.map(({ id, icon: Icon, label, valor }) => (
            <article key={id} className="nf-kpi">
              <div className="nf-kpi__icon">
                <Icon size={18} aria-hidden />
              </div>
              <div>
                <strong className="nf-kpi__valor">{valor}</strong>
                <span className="nf-kpi__label">{label}</span>
              </div>
            </article>
          ))}
        </div>

        {!loading && (resumo.porMes.length > 0 || resumo.porStatus.length > 0) ? (
          <div className="nf-charts">
            {resumo.porMes.length > 0 ? (
              <article className="nf-chart-card">
                <h2 className="nf-chart-title">Valor por mês</h2>
                <NotasFiscaisGraficoBarras
                  dados={resumo.porMes.map((p) => ({
                    label: p.label,
                    valor: p.valor,
                  }))}
                  formato={fmtMoedaGrafico}
                />
              </article>
            ) : null}
            {resumo.porStatus.length > 0 ? (
              <article className="nf-chart-card">
                <h2 className="nf-chart-title">Por status</h2>
                <NotasFiscaisGraficoBarras dados={resumo.porStatus} />
              </article>
            ) : null}
            {resumo.porOficina.length > 0 ? (
              <article className="nf-chart-card nf-chart-card--wide">
                <h2 className="nf-chart-title">Top oficinas (valor)</h2>
                <NotasFiscaisGraficoBarras
                  dados={resumo.porOficina.map((p) => ({
                    label: p.label,
                    valor: p.valor,
                  }))}
                  formato={fmtMoedaGrafico}
                />
              </article>
            ) : null}
          </div>
        ) : null}

        <div className="nf-toolbar">
          <div className="nf-toolbar-fields">
            <label className="nf-toolbar-field">
              <span className="nf-toolbar-field__label">De</span>
              <input
                type="date"
                value={dataInicio}
                max={dataFim}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </label>
            <label className="nf-toolbar-field">
              <span className="nf-toolbar-field__label">Até</span>
              <input
                type="date"
                value={dataFim}
                min={dataInicio}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </label>
            <label className="nf-toolbar-field nf-toolbar-field--search">
              <span className="nf-toolbar-field__label">Busca</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Oficina, O.S.…"
                aria-label="Buscar notas fiscais"
              />
            </label>
            <label className="nf-toolbar-field nf-toolbar-field--status">
              <span className="nf-toolbar-field__label">Status</span>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as NotaFiscalStatus | "todos")
                }
                aria-label="Filtrar por status"
              >
                <option value="todos">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="aprovada">Aprovada</option>
                <option value="rejeitada">Rejeitada</option>
              </select>
            </label>
          </div>
          <div className="nf-toolbar-actions">
            <button
              type="button"
              className="nf-btn-reload"
              onClick={() => void carregar()}
              disabled={loading}
            >
              {loading ? "Carregando…" : "Atualizar"}
            </button>
            {!loading ? (
              <span className="nf-toolbar__count">
                {rows.length} nota{rows.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>

        {erro ? <div className="nf-erro">{erro}</div> : null}

        {loading ? (
          <div className="nf-loading">Carregando notas fiscais…</div>
        ) : rows.length === 0 ? (
          <div className="nf-empty">
            Nenhuma nota fiscal encontrada
            {busca || status !== "todos" ? " com os filtros atuais" : ""}.
          </div>
        ) : (
          <div className="nf-table-wrap">
            <table className="nf-table">
              <thead>
                <tr>
                  <th>Enviada em</th>
                  <th>Oficina</th>
                  <th>Nº O.S.</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Arquivo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{fmtDataNotaFiscal(row.createdAt)}</td>
                    <td>{row.oficinaNome || row.oficinaId}</td>
                    <td>
                      {row.osProtocolo ? (
                        <>
                          <strong>{row.osProtocolo}</strong>
                          {row.osEquipamento ? (
                            <div style={{ color: "#9cc0ef", marginTop: 4 }}>
                              {row.osEquipamento}
                            </div>
                          ) : null}
                        </>
                      ) : row.solicitacaoOsId ? (
                        <span title="Protocolo não encontrado; ID interno da solicitação">
                          {row.solicitacaoOsId}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{fmtValorNotaFiscalRow(row)}</td>
                    <td>
                      <span className={`nf-badge nf-badge--${row.status}`}>
                        {labelStatusNotaFiscal(row.status)}
                      </span>
                    </td>
                    <td>
                      {row.fileUrl ? (
                        <a
                          className="nf-link-pdf"
                          href={row.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          PDF
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
