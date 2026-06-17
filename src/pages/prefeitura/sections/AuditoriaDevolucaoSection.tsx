import { useCallback, useEffect, useState } from "react";
import { clientesApi } from "../../../lib/api/clientes";
import {
  mensagemErroAuditoriaDevolucao,
  osAuditoriaDevolucaoApi,
} from "../../../lib/api/os-auditoria-devolucao";
import {
  STATUS_OS_OPCOES,
  linhaAuditoriaParaTela,
  type LinhaAuditoriaDevolucao,
} from "./auditoria-devolucao-model";
import { baixarPlanilhaAuditoriaDevolucao } from "./auditoriaDevolucaoExport";
import { ObservacaoAuditoriaCell } from "./ObservacaoAuditoriaCell";
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
  const [oficinas, setOficinas] = useState<OficinaOpt[]>([]);
  const [equipamentosOpts, setEquipamentosOpts] = useState<string[]>([]);
  const [linhasPreview, setLinhasPreview] = useState<LinhaAuditoriaDevolucao[]>(
    [],
  );
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [oficinaId, setOficinaId] = useState("todas");
  const [equipamento, setEquipamento] = useState("todos");
  const [statusOs, setStatusOs] = useState("aguardando_orcamento");
  const [previewAtiva, setPreviewAtiva] = useState(false);

  const carregarMeta = useCallback(async () => {
    if (!prefeituraId) {
      setOficinas([]);
      setEquipamentosOpts([]);
      setLoadingMeta(false);
      return;
    }
    setLoadingMeta(true);
    setErro(null);
    try {
      const [oficinasLista, equipamentos] = await Promise.all([
        clientesApi.listarOficinasCredenciadas(prefeituraId),
        osAuditoriaDevolucaoApi.listarEquipamentos(prefeituraId),
      ]);
      setOficinas(
        oficinasLista
          .map((o) => ({
            id: o.id,
            nome: o.nome?.trim() || o.id,
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      );
      setEquipamentosOpts(equipamentos);
    } catch (err) {
      setErro(mensagemErroAuditoriaDevolucao(err));
    } finally {
      setLoadingMeta(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregarMeta();
  }, [carregarMeta]);

  async function handlePreview() {
    if (!prefeituraId) return;
    setLoadingPreview(true);
    setErro(null);
    try {
      const linhas = await osAuditoriaDevolucaoApi.listarLinhas(prefeituraId, {
        startDate: dataInicio || undefined,
        endDate: dataFim || undefined,
        status: statusOs,
        oficinaId,
        equipamento,
      });
      setLinhasPreview(linhas);
      setPreviewAtiva(true);
    } catch (err) {
      setLinhasPreview([]);
      setPreviewAtiva(true);
      setErro(mensagemErroAuditoriaDevolucao(err));
    } finally {
      setLoadingPreview(false);
    }
  }

  function handleDownload() {
    if (linhasPreview.length === 0) return;
    baixarPlanilhaAuditoriaDevolucao(linhasPreview, {
      prefeituraId,
      dataInicio,
      dataFim,
    });
  }

  const busy = loadingMeta || loadingPreview;

  return (
    <section className="adev-page">
      <div className="adev-wrap">
        <h1 className="adev-title">Auditoria de Devolução</h1>
        <p className="adev-subtitle">
          Relatório via API do backend. Valor e oficina executora completos
          quando a API de orçamentos estiver disponível; hoje lista as O.S. com
          relato e oficinas convidadas.
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
                disabled={loadingMeta}
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
                disabled={loadingMeta}
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
          </div>

          <div className="adev-acoes">
            <button
              type="button"
              className="adev-btn adev-btn--preview"
              onClick={() => void handlePreview()}
              disabled={busy || !prefeituraId}
            >
              <span aria-hidden>🔍</span>{" "}
              {loadingPreview ? "Carregando…" : "Pré-visualizar"}
            </button>
            <button
              type="button"
              className="adev-btn adev-btn--download"
              onClick={handleDownload}
              disabled={busy || linhasPreview.length === 0}
            >
              <span aria-hidden>⬇</span> Baixar relatório
            </button>
          </div>
        </div>

        {previewAtiva ? (
          <div className="adev-preview">
            <div className="adev-preview__head">Pré-visualização</div>
            {loadingPreview ? (
              <div className="adev-empty">Carregando registros…</div>
            ) : linhasPreview.length === 0 ? (
              <div className="adev-empty">
                Nenhum registro encontrado com esses filtros.
              </div>
            ) : (
              <div className="adev-table-scroll">
                <table className="adev-table">
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
                    {linhasPreview.map((r) => {
                      const item = linhaAuditoriaParaTela(r);
                      return (
                        <tr key={r.osId}>
                          <td>{item.dataLabel}</td>
                          <td>
                            <span
                              className={`adev-status adev-status--${r.status}`}
                            >
                              {item.tipoLabel}
                            </span>
                          </td>
                          <td>{item.destino}</td>
                          <td className="adev-valor-positivo">
                            {item.valorLabel}
                          </td>
                          <td>{item.responsavel}</td>
                          <td className="adev-table__obs">
                            <ObservacaoAuditoriaCell fmt={item.observacaoFmt} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="adev-preview__foot">
              {linhasPreview.length} registro(s) encontrado(s)
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
