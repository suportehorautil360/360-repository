import { useMemo, useState } from "react";
import type { FiltroStatusOs, SolicitacaoOS } from "./abrir-os-model";
import {
  filtrarOsLista,
  fmtClassificacao,
  fmtDataOs,
  statusBadgeOs,
} from "./abrir-os-model";

interface AbrirOsListaProps {
  rows: SolicitacaoOS[];
  loading: boolean;
  erro: string | null;
  onAbrirOs: () => void;
}

const STATUS_OPCOES: { value: FiltroStatusOs; label: string }[] = [
  { value: "todos", label: "Todos os status" },
  { value: "aprovado", label: "Aprovado" },
  { value: "aguardando_orcamento", label: "Aguard. Orçamento" },
];

export function AbrirOsLista({
  rows,
  loading,
  erro,
  onAbrirOs,
}: AbrirOsListaProps) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [status, setStatus] = useState<FiltroStatusOs>("todos");

  const filtradas = useMemo(
    () => filtrarOsLista(rows, { dataInicio, dataFim, status }),
    [rows, dataInicio, dataFim, status],
  );

  const temFiltro = Boolean(dataInicio || dataFim || status !== "todos");

  return (
    <div className="aos-wrap">
      <div className="aos-head">
        <h1 className="aos-title">
          <span className="aos-title__icon" aria-hidden>
            📄
          </span>
          Ordens de serviço
        </h1>
        <button type="button" className="aos-btn-abrir" onClick={onAbrirOs}>
          + Abrir OS
        </button>
      </div>

      {erro ? <p className="aos-erro">{erro}</p> : null}

      <div className="aos-lista-filtros">
        <div className="aos-lista-filtros__grupo">
          <label className="aos-lista-filtros__label" htmlFor="aos-filtro-inicio">
            Período — de
          </label>
          <input
            id="aos-filtro-inicio"
            type="date"
            className="aos-lista-filtros__input"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            max={dataFim || undefined}
          />
        </div>
        <div className="aos-lista-filtros__grupo">
          <label className="aos-lista-filtros__label" htmlFor="aos-filtro-fim">
            até
          </label>
          <input
            id="aos-filtro-fim"
            type="date"
            className="aos-lista-filtros__input"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            min={dataInicio || undefined}
          />
        </div>
        <div className="aos-lista-filtros__grupo aos-lista-filtros__grupo--status">
          <label className="aos-lista-filtros__label" htmlFor="aos-filtro-status">
            Status
          </label>
          <select
            id="aos-filtro-status"
            className="aos-lista-filtros__select"
            value={status}
            onChange={(e) => setStatus(e.target.value as FiltroStatusOs)}
          >
            {STATUS_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {temFiltro ? (
          <button
            type="button"
            className="aos-lista-filtros__limpar"
            onClick={() => {
              setDataInicio("");
              setDataFim("");
              setStatus("todos");
            }}
          >
            Limpar filtros
          </button>
        ) : null}
      </div>

      {!loading && rows.length > 0 ? (
        <p className="aos-lista-contagem">
          {filtradas.length} de {rows.length} ordem
          {rows.length === 1 ? "" : "ens"}
        </p>
      ) : null}

      <div className="aos-table-scroll">
        <table className="aos-table">
          <thead>
            <tr>
              <th>Nº OS</th>
              <th>Equipamento</th>
              <th>Classificação</th>
              <th>Operador</th>
              <th>Problema</th>
              <th>Data</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="aos-empty">
                  Carregando ordens de serviço…
                </td>
              </tr>
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="aos-empty">
                  {rows.length === 0
                    ? "Nenhuma ordem de serviço cadastrada."
                    : "Nenhuma O.S. encontrada com os filtros selecionados."}
                </td>
              </tr>
            ) : (
              filtradas.map((os) => {
                const st = statusBadgeOs(os.status);
                return (
                  <tr key={os.id}>
                    <td className="aos-col-os">{os.protocolo || "—"}</td>
                    <td className="aos-col-equip">{os.equipamento || "—"}</td>
                    <td>{fmtClassificacao(os.linha)}</td>
                    <td>{os.operador || "—"}</td>
                    <td>{os.relato?.trim() || "—"}</td>
                    <td>{fmtDataOs(os.criadoEm)}</td>
                    <td>
                      <span className={`aos-status ${st.cls}`}>{st.label}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
