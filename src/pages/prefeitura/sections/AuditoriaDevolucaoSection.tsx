import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../lib/firebase/firebase";
import { baixarCSV } from "../../../lib/export/export-utils";
import {
  FORMATO_OPCOES,
  STATUS_OS_OPCOES,
  filtrarLinhasAuditoria,
  filtrarPorOficina,
  fmtBRL,
  fmtDataBr,
  labelStatusOs,
  linhasParaCsv,
  montarLinhasAuditoria,
  type FiltrosAuditoriaDevolucao,
  type OrdemDevolucaoRaw,
  type SolicitacaoOsRaw,
} from "./auditoria-devolucao-model";
import "./auditoria-devolucao.css";

interface OficinaOpt {
  id: string;
  nome: string;
}

export function AuditoriaDevolucaoSection({
  prefeituraId,
}: {
  prefeituraId: string;
}) {
  const [ordens, setOrdens] = useState<OrdemDevolucaoRaw[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoOsRaw[]>([]);
  const [oficinas, setOficinas] = useState<OficinaOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [oficinaId, setOficinaId] = useState("todas");
  const [equipamento, setEquipamento] = useState("todos");
  const [statusOs, setStatusOs] = useState("aprovado");
  const [formato, setFormato] = useState("csv");
  const [previewAtiva, setPreviewAtiva] = useState(false);

  const carregar = useCallback(async () => {
    if (!prefeituraId) {
      setOrdens([]);
      setSolicitacoes([]);
      setOficinas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const [ordensSnap, solSnap, oficinasSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "ordensServico"),
            where("prefeituraId", "==", prefeituraId),
          ),
        ),
        getDocs(
          query(
            collection(db, "solicitacoesOS"),
            where("prefeituraId", "==", prefeituraId),
          ),
        ),
        getDocs(
          query(
            collection(db, "oficinas"),
            where("prefeituraId", "==", prefeituraId),
          ),
        ),
      ]);

      setOrdens(
        ordensSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OrdemDevolucaoRaw, "id">),
        })),
      );
      setSolicitacoes(
        solSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SolicitacaoOsRaw, "id">),
        })),
      );
      setOficinas(
        oficinasSnap.docs
          .map((d) => ({
            id: d.id,
            nome: String(d.data().nome ?? "").trim() || d.id,
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      );
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os dados de devolução.",
      );
    } finally {
      setLoading(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const linhasBase = useMemo(
    () => montarLinhasAuditoria(ordens, solicitacoes),
    [ordens, solicitacoes],
  );

  const equipamentosOpts = useMemo(() => {
    const set = new Set<string>();
    for (const r of linhasBase) {
      if (r.equipamento && r.equipamento !== "—") set.add(r.equipamento);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [linhasBase]);

  const filtros: FiltrosAuditoriaDevolucao = {
    dataInicio,
    dataFim,
    oficinaId,
    equipamento,
    statusOs,
  };

  const linhasFiltradas = useMemo(() => {
    const porFiltros = filtrarLinhasAuditoria(linhasBase, filtros);
    return filtrarPorOficina(porFiltros, ordens, oficinaId);
  }, [linhasBase, filtros, ordens, oficinaId]);

  function handlePreview() {
    setPreviewAtiva(true);
  }

  function handleDownload() {
    if (linhasFiltradas.length === 0) return;
    if (formato === "csv") {
      baixarCSV(
        `auditoria-devolucao-${prefeituraId}`,
        linhasParaCsv(linhasFiltradas),
      );
    }
  }

  return (
    <section className="adev-page">
      <div className="adev-wrap">
        <h1 className="adev-title">Auditoria de Devolução</h1>
        <p className="adev-subtitle">
          Baixe relatórios de devolução filtrados por período, oficina e
          equipamento.
        </p>

        {erro ? <div className="adev-erro">{erro}</div> : null}

        <div className="adev-filtros">
          <h2 className="adev-filtros__titulo">
            <span aria-hidden>📋</span> Filtros e download de relatório
          </h2>

          <div className="adev-grid">
            <div className="adev-field">
              <label htmlFor="adev-data-inicio">Data inicial</label>
              <input
                id="adev-data-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPreviewAtiva(false);
                }}
              />
            </div>
            <div className="adev-field">
              <label htmlFor="adev-data-fim">Data final</label>
              <input
                id="adev-data-fim"
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPreviewAtiva(false);
                }}
              />
            </div>
            <div className="adev-field">
              <label htmlFor="adev-oficina">Oficina</label>
              <select
                id="adev-oficina"
                value={oficinaId}
                onChange={(e) => {
                  setOficinaId(e.target.value);
                  setPreviewAtiva(false);
                }}
              >
                <option value="todas">Todas as oficinas</option>
                {oficinas.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="adev-field">
              <label htmlFor="adev-equipamento">Equipamento</label>
              <select
                id="adev-equipamento"
                value={equipamento}
                onChange={(e) => {
                  setEquipamento(e.target.value);
                  setPreviewAtiva(false);
                }}
              >
                <option value="todos">Todos os equipamentos</option>
                {equipamentosOpts.map((eq) => (
                  <option key={eq} value={eq}>
                    {eq}
                  </option>
                ))}
              </select>
            </div>
            <div className="adev-field">
              <label htmlFor="adev-status">Status OS</label>
              <select
                id="adev-status"
                value={statusOs}
                onChange={(e) => {
                  setStatusOs(e.target.value);
                  setPreviewAtiva(false);
                }}
              >
                {STATUS_OS_OPCOES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="adev-field">
              <label htmlFor="adev-formato">Formato</label>
              <select
                id="adev-formato"
                value={formato}
                onChange={(e) => setFormato(e.target.value)}
              >
                {FORMATO_OPCOES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="adev-acoes">
            <button
              type="button"
              className="adev-btn adev-btn--preview"
              onClick={handlePreview}
              disabled={loading}
            >
              <span aria-hidden>🔍</span> Pré-visualizar
            </button>
            <button
              type="button"
              className="adev-btn adev-btn--download"
              onClick={handleDownload}
              disabled={loading || linhasFiltradas.length === 0}
            >
              <span aria-hidden>⬇</span> Baixar relatório
            </button>
          </div>
        </div>

        {previewAtiva ? (
          <div className="adev-preview">
            <div className="adev-preview__head">Pré-visualização</div>
            {loading ? (
              <div className="adev-empty">Carregando registros…</div>
            ) : linhasFiltradas.length === 0 ? (
              <div className="adev-empty">
                Nenhum registro encontrado com esses filtros.
              </div>
            ) : (
              <div className="adev-table-scroll">
                <table className="adev-table">
                  <thead>
                    <tr>
                      <th>OS</th>
                      <th>Equipamento</th>
                      <th>Classificação</th>
                      <th>Protocolo</th>
                      <th>Oficina</th>
                      <th>Defeito</th>
                      <th>Valor</th>
                      <th>Data</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasFiltradas.map((r) => (
                      <tr key={r.osId}>
                        <td>{r.protocolo}</td>
                        <td>{r.equipamento}</td>
                        <td>{r.classificacao}</td>
                        <td>{r.protocolo}</td>
                        <td>{r.oficina}</td>
                        <td className="adev-table__defeito" title={r.defeito}>
                          {r.defeito}
                        </td>
                        <td>{fmtBRL(r.valor)}</td>
                        <td>{fmtDataBr(r.dataIso)}</td>
                        <td>
                          <span
                            className={`adev-status adev-status--${r.status}`}
                          >
                            {labelStatusOs(r.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="adev-preview__foot">
              {linhasFiltradas.length} registro(s) encontrado(s)
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
