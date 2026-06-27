import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import {
  garantiasApi,
  labelStatusGarantia,
  type GarantiaListItem,
  type GarantiaResumoEquipamento,
} from "../../../lib/api/garantias";

const TIPOS_FILTRO = [
  { value: "todos", label: "Todos os tipos" },
  { value: "peca", label: "Peça" },
  { value: "servico", label: "Serviço" },
];

const STATUS_FILTRO = [
  { value: "todos", label: "Todos os status" },
  { value: "vigente", label: "Vigente" },
  { value: "vencendo", label: "Prestes a vencer" },
  { value: "vencido", label: "Vencido" },
];

interface AbrirOsAbaGarantiaProps {
  /** Quando informado (detalhe da O.S.), busca garantias do CHD desta solicitação. */
  solicitacaoOsId?: string;
  equipamentoId?: string;
  nomeEquipamento: string;
  horimetro: string;
  equipamentoSelecionado: boolean;
  /** Protocolo da O.S. atual — destaca linhas com mesma origem. */
  osOrigemAtual?: string;
  somenteLeitura?: boolean;
}

export function AbrirOsAbaGarantia({
  solicitacaoOsId,
  equipamentoId,
  nomeEquipamento,
  horimetro,
  equipamentoSelecionado,
  osOrigemAtual,
  somenteLeitura = false,
}: AbrirOsAbaGarantiaProps) {
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [historico, setHistorico] = useState<GarantiaListItem[]>([]);
  const [resumo, setResumo] = useState<GarantiaResumoEquipamento | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const idSolicitacao = solicitacaoOsId?.trim() ?? "";
  const idEquipamento = equipamentoId?.trim() ?? "";
  const modoOs = Boolean(idSolicitacao);
  const podeConsultar = modoOs
    ? true
    : equipamentoSelecionado && Boolean(idEquipamento);

  const carregar = useCallback(async () => {
    if (!podeConsultar) {
      setHistorico([]);
      setResumo(null);
      setInfo(null);
      setErro(null);
      return;
    }

    setCarregando(true);
    setErro(null);
    try {
      const filtros = {
        horimetroAtual: horimetro.trim() || undefined,
        status: filtroStatus,
        tipo: filtroTipo,
        busca,
      };

      const resp = modoOs
        ? await garantiasApi.listarPorSolicitacao(idSolicitacao, filtros)
        : await garantiasApi.listarPorEquipamento(idEquipamento, filtros);

      setHistorico(resp.data);
      setResumo(resp.resumo);
      setInfo(resp.message);
    } catch {
      setHistorico([]);
      setResumo(null);
      setInfo(null);
      setErro("Não foi possível carregar o histórico de garantia.");
    } finally {
      setCarregando(false);
    }
  }, [
    podeConsultar,
    modoOs,
    idSolicitacao,
    idEquipamento,
    horimetro,
    filtroStatus,
    filtroTipo,
    busca,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void carregar();
    }, busca.trim() ? 300 : 0);

    return () => window.clearTimeout(timer);
  }, [carregar, busca]);

  const itensGarantia = resumo?.itensEmGarantia ?? 0;
  const prestesVencer = resumo?.prestesAVencer ?? 0;
  const nomeExibicao = resumo?.equipamento ?? nomeEquipamento;

  const emptyMessage = modoOs
    ? "Nenhum item de garantia — aguardando checklist de devolução (CHD) da oficina para esta O.S."
    : "Nenhum item de garantia encontrado para este equipamento.";

  return (
    <div className="aos-gar">
      <h2 className="aos-gar__title">
        <Shield size={16} className="aos-gar__title-icon" aria-hidden />
        Análise de garantia – histórico de peças e mão de obra
      </h2>

      <div className="aos-gar__cards">
        <article className="aos-gar-card">
          <span className="aos-gar-card__label">Equipamento</span>
          <strong className="aos-gar-card__valor aos-gar-card__valor--warn">
            {podeConsultar ? nomeExibicao || "—" : "—"}
          </strong>
        </article>
        <article className="aos-gar-card">
          <span className="aos-gar-card__label">Horímetro atual</span>
          <strong className="aos-gar-card__valor aos-gar-card__valor--warn">
            {podeConsultar ? horimetro || "—" : "—"}
          </strong>
        </article>
        <article className="aos-gar-card">
          <span className="aos-gar-card__label">Itens em garantia</span>
          <strong className="aos-gar-card__valor aos-gar-card__valor--ok">
            {podeConsultar ? itensGarantia : 0}
          </strong>
        </article>
        <article className="aos-gar-card">
          <span className="aos-gar-card__label">Prestes a vencer</span>
          <strong className="aos-gar-card__valor aos-gar-card__valor--warn">
            {podeConsultar ? prestesVencer : 0}
          </strong>
        </article>
      </div>

      <div className="aos-gar__filtros">
        <input
          type="search"
          className="aos-gar__busca"
          placeholder="Peça, serviço ou O.S…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          disabled={!podeConsultar}
        />
        <select
          className="aos-gar__select"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          disabled={!podeConsultar}
        >
          {TIPOS_FILTRO.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="aos-gar__select"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          disabled={!podeConsultar}
        >
          {STATUS_FILTRO.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="aos-gar-table-scroll">
        <table className="aos-gar-table">
          <thead>
            <tr>
              <th>O.S. origem</th>
              <th>Data exec.</th>
              <th>Tipo</th>
              <th>Item (peça / serviço)</th>
              <th>Fornecedor / executante</th>
              <th>Prazo</th>
              <th>Limite horím.</th>
              <th>Vence em</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!podeConsultar ? (
              <tr>
                <td colSpan={9} className="aos-gar-empty">
                  {modoOs
                    ? "O.S. sem identificador — não foi possível consultar garantias."
                    : "Selecione um equipamento na aba Geral para carregar o histórico de garantia."}
                </td>
              </tr>
            ) : carregando ? (
              <tr>
                <td colSpan={9} className="aos-gar-empty">
                  Carregando histórico de garantia…
                </td>
              </tr>
            ) : erro ? (
              <tr>
                <td colSpan={9} className="aos-gar-empty aos-gar-empty--erro">
                  {erro}
                </td>
              </tr>
            ) : historico.length === 0 ? (
              <tr>
                <td colSpan={9} className="aos-gar-empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              historico.map((r) => {
                const destaque =
                  osOrigemAtual?.trim() &&
                  r.osOrigem.trim().toLowerCase() ===
                    osOrigemAtual.trim().toLowerCase();
                return (
                  <tr
                    key={r.id}
                    className={destaque ? "aos-gar-row--destaque" : undefined}
                  >
                    <td className="aos-gar-col-os">{r.osOrigem}</td>
                    <td>{r.dataExec}</td>
                    <td>{r.tipoLabel}</td>
                    <td>{r.item}</td>
                    <td>{r.fornecedor}</td>
                    <td>{r.prazo}</td>
                    <td>{r.limiteHorimetro}</td>
                    <td>{r.venceEm}</td>
                    <td>
                      <span
                        className={`aos-gar-status aos-gar-status--${r.status}`}
                      >
                        {labelStatusGarantia(r.status)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="aos-gar__regra" role="note">
        <span className="aos-gar__regra-icon" aria-hidden>
          💡
        </span>
        <p>
          {somenteLeitura ? (
            <>
              <strong>Consulta:</strong> peças e serviços em garantia derivados
              do checklist de devolução (CHD) desta O.S. —{" "}
              <strong>não é necessário aceitar o CHD</strong> para visualizar.
              {info ? <> {info}</> : null} Quando houver itens vigentes, acione o
              fornecedor antes de gerar custo.
            </>
          ) : (
            <>
              <strong>Regra de negócio:</strong> o sistema cruza CHDs anteriores
              do equipamento com prazo em meses e limite de horímetro. Se a nova
              O.S. envolver peça ou serviço ainda coberto, acione o
              fornecedor/oficina antes de gerar custo.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
