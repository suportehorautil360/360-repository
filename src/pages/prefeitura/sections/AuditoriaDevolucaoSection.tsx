import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  Download,
  Eye,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { clientesApi } from "../../../lib/api/clientes";
import {
  checklistDevolucaoApi,
  mensagemErroChd,
} from "../../../lib/api/checklist-devolucao";
import {
  mensagemErroAuditoriaDevolucao,
  osAuditoriaDevolucaoApi,
} from "../../../lib/api/os-auditoria-devolucao";
import {
  chdDocParaLinha,
  filtrarLinhasChd,
  linhaChdParaTela,
  type LinhaChdAuditoria,
} from "./auditoria-devolucao-model";
import {
  chdAuditoriaNaoVisto,
  contarChdsAuditoriaNaoVistos,
  marcarChdAuditoriaVisto,
  sincronizarBaselineChdAuditoria,
} from "../auditoria-devolucao-vistos";
import { ChdDetalheModal } from "./ChdDetalheModal";
import { baixarChdPdf } from "../../../lib/chd/chd-pdf";
import "./auditoria-devolucao.css";
import "./chd-detalhe-modal.css";

interface OficinaOpt {
  id: string;
  nome: string;
}

const FILTROS_PADRAO = {
  dataInicio: "",
  dataFim: "",
  oficinaId: "todas",
  equipamento: "todos",
};

export function AuditoriaDevolucaoSection({
  prefeituraId,
}: {
  prefeituraId: string;
}) {
  const [oficinas, setOficinas] = useState<OficinaOpt[]>([]);
  const [equipamentosOpts, setEquipamentosOpts] = useState<string[]>([]);
  const [chds, setChds] = useState<LinhaChdAuditoria[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingChd, setLoadingChd] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [dataInicio, setDataInicio] = useState<string>(FILTROS_PADRAO.dataInicio);
  const [dataFim, setDataFim] = useState<string>(FILTROS_PADRAO.dataFim);
  const [oficinaId, setOficinaId] = useState<string>(FILTROS_PADRAO.oficinaId);
  const [equipamento, setEquipamento] = useState<string>(FILTROS_PADRAO.equipamento);
  const [chdDetalhe, setChdDetalhe] = useState<{
    id: string;
    number: string;
    oficinaNome: string;
  } | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [vistosTick, setVistosTick] = useState(0);

  const chdIds = useMemo(() => chds.map((item) => item.id), [chds]);

  const qtdNovos = useMemo(() => {
    void vistosTick;
    return contarChdsAuditoriaNaoVistos(prefeituraId, chdIds);
  }, [prefeituraId, chdIds, vistosTick]);

  useEffect(() => {
    const onVistos = (event: Event) => {
      const detail = (event as CustomEvent<{ prefeituraId?: string }>).detail;
      if (detail?.prefeituraId && detail.prefeituraId !== prefeituraId) return;
      setVistosTick((value) => value + 1);
    };
    window.addEventListener("hu360:chd-auditoria-vistos", onVistos);
    return () => {
      window.removeEventListener("hu360:chd-auditoria-vistos", onVistos);
    };
  }, [prefeituraId]);

  function marcarComoVisto(chdId: string) {
    marcarChdAuditoriaVisto(prefeituraId, chdId, chdIds);
    setVistosTick((value) => value + 1);
  }

  function abrirDetalhe(linha: LinhaChdAuditoria) {
    marcarComoVisto(linha.id);
    setChdDetalhe({
      id: linha.id,
      number: linha.number,
      oficinaNome: linha.oficinaNome,
    });
  }

  const carregarMeta = useCallback(async () => {
    if (!prefeituraId) {
      setOficinas([]);
      setEquipamentosOpts([]);
      setLoadingMeta(false);
      return;
    }
    setLoadingMeta(true);
    setLoadingChd(true);
    setErro(null);
    try {
      const [oficinasLista, equipamentosOs] = await Promise.all([
        clientesApi.listarOficinasCredenciadas(prefeituraId),
        osAuditoriaDevolucaoApi.listarEquipamentos(prefeituraId).catch(
          () => [] as string[],
        ),
      ]);
      const oficinasOrdenadas = oficinasLista
        .map((o) => ({
          id: o.id,
          nome: o.nome?.trim() || o.id,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      setOficinas(oficinasOrdenadas);

      const equipamentosChd = new Set(equipamentosOs);
      try {
        const oficinasPorId = new Map(
          oficinasOrdenadas.map((o) => [o.id, o.nome]),
        );
        const chdDocs =
          await checklistDevolucaoApi.listarPorPrefeitura(prefeituraId);
        setChds(chdDocs.map((doc) => chdDocParaLinha(doc, oficinasPorId)));
        sincronizarBaselineChdAuditoria(
          prefeituraId,
          chdDocs.map((doc) => doc.id),
        );
        setVistosTick((value) => value + 1);
        for (const doc of chdDocs) {
          const eq = doc.identification?.brandModel?.trim();
          if (eq) equipamentosChd.add(eq);
        }
      } catch (err) {
        setChds([]);
        setErro(mensagemErroChd(err));
      }

      setEquipamentosOpts(
        Array.from(equipamentosChd).sort((a, b) =>
          a.localeCompare(b, "pt-BR"),
        ),
      );
    } catch (err) {
      setErro(mensagemErroAuditoriaDevolucao(err));
    } finally {
      setLoadingMeta(false);
      setLoadingChd(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregarMeta();
  }, [carregarMeta]);

  function limparFiltros() {
    setDataInicio(FILTROS_PADRAO.dataInicio);
    setDataFim(FILTROS_PADRAO.dataFim);
    setOficinaId(FILTROS_PADRAO.oficinaId);
    setEquipamento(FILTROS_PADRAO.equipamento);
  }

  async function handleBaixarChdPdf(linha: LinhaChdAuditoria) {
    if (pdfLoadingId) return;
    setPdfLoadingId(linha.id);
    setErro(null);
    marcarComoVisto(linha.id);
    try {
      const doc = await checklistDevolucaoApi.obterPorId(linha.id);
      await baixarChdPdf(doc, { oficinaNome: linha.oficinaNome });
    } catch (err) {
      setErro(mensagemErroChd(err));
    } finally {
      setPdfLoadingId(null);
    }
  }

  const temFiltroAtivo =
    dataInicio !== FILTROS_PADRAO.dataInicio ||
    dataFim !== FILTROS_PADRAO.dataFim ||
    oficinaId !== FILTROS_PADRAO.oficinaId ||
    equipamento !== FILTROS_PADRAO.equipamento;

  const filtrosAtuais = {
    dataInicio,
    dataFim,
    oficinaId,
    equipamento,
    statusOs: "todos",
  };

  const chdsFiltrados = useMemo(
    () => filtrarLinhasChd(chds, filtrosAtuais),
    [chds, dataInicio, dataFim, oficinaId, equipamento],
  );

  return (
    <section className="adev">
      <header className="adev-header">
        <div className="adev-header__text">
          <h1 className="adev-title">Auditoria de Devolução</h1>
          <p className="adev-lead">
            Consulte os checklists de devolução (CHD) vinculados às ordens de
            serviço desta prefeitura, com filtros por período, oficina e
            equipamento.
          </p>
        </div>
        <div className="adev-stats" aria-live="polite">
          <span className="adev-stat">
            <strong>{chdsFiltrados.length}</strong>
            CHD{chdsFiltrados.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      {erro ? <div className="adev-erro">{erro}</div> : null}

      {qtdNovos > 0 ? (
        <div className="adev-novos" role="status">
          <span className="adev-novos__dot" aria-hidden />
          <span>
            <strong>{qtdNovos}</strong> checklist
            {qtdNovos === 1 ? "" : "s"} de devolução{" "}
            {qtdNovos === 1 ? "novo" : "novos"} — ainda não conferido
            {qtdNovos === 1 ? "" : "s"}
          </span>
        </div>
      ) : null}

      <div className="adev-toolbar">
        <div className="adev-toolbar__filtros">
          <div className="adev-periodo">
            <span className="adev-periodo__label">Período</span>
            <input
              id="adev-data-inicio"
              type="date"
              className="adev-periodo__input"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              max={dataFim || undefined}
              aria-label="Data inicial"
            />
            <span className="adev-periodo__sep">até</span>
            <input
              id="adev-data-fim"
              type="date"
              className="adev-periodo__input"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              min={dataInicio || undefined}
              aria-label="Data final"
            />
          </div>

          <div className="adev-select-wrap">
            <label className="adev-select-wrap__label" htmlFor="adev-oficina">
              Oficina
            </label>
            <select
              id="adev-oficina"
              className="adev-select"
              value={oficinaId}
              onChange={(e) => setOficinaId(e.target.value)}
              disabled={loadingMeta}
            >
              <option value="todas">Todas</option>
              {oficinas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="adev-select-wrap">
            <label
              className="adev-select-wrap__label"
              htmlFor="adev-equipamento"
            >
              Equipamento
            </label>
            <select
              id="adev-equipamento"
              className="adev-select"
              value={equipamento}
              onChange={(e) => setEquipamento(e.target.value)}
              disabled={loadingMeta}
            >
              <option value="todos">Todos</option>
              {equipamentosOpts.map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </select>
          </div>
        </div>

        {temFiltroAtivo ? (
          <div className="adev-toolbar__acoes">
            <button
              type="button"
              className="adev-btn adev-btn--ghost"
              onClick={limparFiltros}
            >
              <RotateCcw size={15} aria-hidden />
              Limpar
            </button>
          </div>
        ) : null}
      </div>

      <div className="adev-panel">
        <div className="adev-panel__head">
          <ClipboardCheck size={18} aria-hidden className="adev-panel__icon" />
          <div>
            <h2 className="adev-panel__title">Checklists de devolução</h2>
            <p className="adev-panel__sub">
              CHDs vinculados às ordens de serviço desta prefeitura
            </p>
          </div>
        </div>
        {loadingChd ? (
          <div className="adev-empty">Carregando checklists…</div>
        ) : chdsFiltrados.length === 0 ? (
          <div className="adev-empty">
            Nenhum CHD encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="adev-table-scroll">
            <table className="adev-table adev-table--chd">
              <thead>
                <tr>
                  <th>Nº CHD</th>
                  <th>O.S.</th>
                  <th>Equipamento</th>
                  <th>Oficina</th>
                  <th>Data</th>
                  <th>Horímetro</th>
                  <th>Peças</th>
                  <th>Serviços</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {chdsFiltrados.map((r) => {
                  const item = linhaChdParaTela(r);
                  const pdfBusy = pdfLoadingId === r.id;
                  const ehNovo = chdAuditoriaNaoVisto(prefeituraId, r.id, chdIds);
                  return (
                    <tr
                      key={r.id}
                      className={ehNovo ? "adev-table-row--novo" : undefined}
                    >
                      <td className="adev-chd-num">
                        <span className="adev-chd-num__wrap">
                          {ehNovo ? (
                            <span className="adev-novo-tag" title="Novo checklist">
                              Novo
                            </span>
                          ) : null}
                          {r.number}
                        </span>
                      </td>
                      <td>{r.osProtocolo}</td>
                      <td>{item.equipamentoLabel}</td>
                      <td>{r.oficinaNome}</td>
                      <td>{item.dataLabel}</td>
                      <td>{r.horimetro}</td>
                      <td className="adev-chd-qtd">{r.qtdPecas}</td>
                      <td className="adev-chd-qtd">{r.qtdServicos}</td>
                      <td>
                        <span
                          className={`adev-badge adev-badge--chd-${r.status}`}
                        >
                          {item.statusLabel}
                        </span>
                      </td>
                      <td>
                        <div className="adev-chd-acoes">
                          <button
                            type="button"
                            className="adev-chd-acao"
                            onClick={() => abrirDetalhe(r)}
                          >
                            <Eye size={13} aria-hidden />
                            Detalhes
                          </button>
                          <button
                            type="button"
                            className="adev-chd-acao adev-chd-acao--pdf"
                            onClick={() => void handleBaixarChdPdf(r)}
                            disabled={Boolean(pdfLoadingId)}
                          >
                            {pdfBusy ? (
                              <Loader2
                                size={13}
                                className="chd-modal__spin"
                                aria-hidden
                              />
                            ) : (
                              <Download size={13} aria-hidden />
                            )}
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="adev-panel__foot">
          {chdsFiltrados.length} exibido(s) · {chds.length} no total
        </div>
      </div>

      <AnimatePresence>
        {chdDetalhe ? (
          <ChdDetalheModal
            key={chdDetalhe.id}
            chdId={chdDetalhe.id}
            chdNumero={chdDetalhe.number}
            oficinaNome={chdDetalhe.oficinaNome}
            onFechar={() => setChdDetalhe(null)}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}
