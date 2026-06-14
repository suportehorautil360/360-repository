import { useMemo, useState } from "react";
import { Shield } from "lucide-react";

interface HistoricoGarantiaRow {
  osOrigem: string;
  dataExec: string;
  tipo: string;
  item: string;
  fornecedor: string;
  prazo: string;
  limiteHorimetro: string;
  venceEm: string;
  status: string;
}

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
  nomeEquipamento: string;
  horimetro: string;
  equipamentoSelecionado: boolean;
}

export function AbrirOsAbaGarantia({
  nomeEquipamento,
  horimetro,
  equipamentoSelecionado,
}: AbrirOsAbaGarantiaProps) {
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const historico: HistoricoGarantiaRow[] = [];

  const filtrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return historico.filter((r) => {
      if (filtroTipo !== "todos" && r.tipo.toLowerCase() !== filtroTipo) {
        return false;
      }
      if (filtroStatus !== "todos" && r.status.toLowerCase() !== filtroStatus) {
        return false;
      }
      if (!q) return true;
      return (
        r.osOrigem.toLowerCase().includes(q) ||
        r.item.toLowerCase().includes(q) ||
        r.fornecedor.toLowerCase().includes(q)
      );
    });
  }, [historico, busca, filtroTipo, filtroStatus]);

  const itensGarantia = historico.filter((r) => r.status === "vigente").length;
  const prestesVencer = historico.filter(
    (r) => r.status === "vencendo",
  ).length;

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
            {equipamentoSelecionado ? nomeEquipamento || "—" : "—"}
          </strong>
        </article>
        <article className="aos-gar-card">
          <span className="aos-gar-card__label">Horímetro atual</span>
          <strong className="aos-gar-card__valor aos-gar-card__valor--warn">
            {equipamentoSelecionado ? horimetro || "—" : "—"}
          </strong>
        </article>
        <article className="aos-gar-card">
          <span className="aos-gar-card__label">Itens em garantia</span>
          <strong className="aos-gar-card__valor aos-gar-card__valor--ok">
            {equipamentoSelecionado ? itensGarantia : 0}
          </strong>
        </article>
        <article className="aos-gar-card">
          <span className="aos-gar-card__label">Prestes a vencer</span>
          <strong className="aos-gar-card__valor aos-gar-card__valor--warn">
            {equipamentoSelecionado ? prestesVencer : 0}
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
          disabled={!equipamentoSelecionado}
        />
        <select
          className="aos-gar__select"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          disabled={!equipamentoSelecionado}
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
          disabled={!equipamentoSelecionado}
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
            {!equipamentoSelecionado ? (
              <tr>
                <td colSpan={9} className="aos-gar-empty">
                  Selecione um equipamento na aba Geral para carregar o histórico
                  de garantia.
                </td>
              </tr>
            ) : filtrado.length === 0 ? (
              <tr>
                <td colSpan={9} className="aos-gar-empty">
                  Nenhum item de garantia encontrado para este equipamento.
                </td>
              </tr>
            ) : (
              filtrado.map((r) => (
                <tr key={`${r.osOrigem}-${r.item}`}>
                  <td className="aos-gar-col-os">{r.osOrigem}</td>
                  <td>{r.dataExec}</td>
                  <td>{r.tipo}</td>
                  <td>{r.item}</td>
                  <td>{r.fornecedor}</td>
                  <td>{r.prazo}</td>
                  <td>{r.limiteHorimetro}</td>
                  <td>{r.venceEm}</td>
                  <td>{r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="aos-gar__regra" role="note">
        <span className="aos-gar__regra-icon" aria-hidden>
          💡
        </span>
        <p>
          <strong>Regra de negócio:</strong> o sistema cruza o histórico de
          serviços executados no ativo com as regras de garantia de cada item
          (prazo em meses e limite de horímetro). Se a nova O.S. envolver peça
          ou serviço ainda coberto, o responsável é notificado para acionar o
          fornecedor/oficina antes de gerar custo, evitando retrabalho pago.
        </p>
      </div>
    </div>
  );
}
