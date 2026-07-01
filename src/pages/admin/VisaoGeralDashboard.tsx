import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHU360 } from "../../lib/hu360";
import { useDashboardFirestore } from "./hooks/dashboard/use-dashboard";

export type TipoCliente = "prefeitura" | "locadora";

export interface ClienteLinha {
  id: string;
  label: string;
  tipo: TipoCliente;
  ativos: number;
  checklists: number;
  manutencao: number | string;
  custoLabel?: string;
  nCot?: number;
  nOs?: number;
}

interface VisaoGeralDashboardProps {
  clientes?: ClienteLinha[];
  reloadKey?: number | string;
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function exibirContagem(valor: number, loading: boolean): string {
  if (loading) return "…";
  return valor > 0 ? String(valor) : "—";
}

export function VisaoGeralDashboard({
  clientes: clientesProp,
  reloadKey,
}: VisaoGeralDashboardProps) {
  const { prefeituras, prefeituraLabel } = useHU360();
  const navigate = useNavigate();
  const {
    linhas: linhasFirestore,
    loading,
    carregar,
  } = useDashboardFirestore();
  const [clientesHU360, setClientesHU360] = useState<ClienteLinha[]>([]);

  useEffect(() => {
    void carregar();
  }, [carregar, reloadKey]);

  useEffect(() => {
    if (clientesProp) return;
    const linhas: ClienteLinha[] = prefeituras.map((p) => {
      const fs = linhasFirestore.find(
        (l: import("./hooks/dashboard/types").DashboardClienteLinha) =>
          l.prefeituraId === p.id,
      );
      return {
        id: p.id,
        label: prefeituraLabel(p.id),
        tipo: p.tipoCliente === "locacao" ? "locadora" : "prefeitura",
        ativos: fs?.ativos ?? 0,
        checklists: fs?.checklists ?? 0,
        manutencao: fs?.emManutencao ?? 0,
      };
    });
    setClientesHU360(linhas);
  }, [reloadKey, clientesProp, prefeituras, prefeituraLabel, linhasFirestore]);

  const clientes = clientesProp ?? clientesHU360;
  const temLocadora = clientes.some((c) => c.tipo === "locadora");

  const totais = useMemo(() => {
    return clientes.reduce(
      (acc, c) => {
        acc.ativos += c.ativos;
        acc.check += c.checklists;
        acc.cot += c.nCot ?? 0;
        acc.os += c.nOs ?? 0;
        return acc;
      },
      { ativos: 0, check: 0, cot: 0, os: 0 },
    );
  }, [clientes]);

  function abrirPainelLocadora(id: string) {
    navigate(`/locacao/${id}`);
  }

  const totalOsAberta = totais.cot + totais.os;

  return (
    <>
      <div className="card-grid hub-dashboard-metrics">
        <article className="card hub-dashboard-metric">
          <h3>Clientes contratantes</h3>
          <p id="hub-vg-n-pref" className="hub-dashboard-metric-value is-accent">
            {clientes.length || "—"}
          </p>
        </article>
        <article className="card hub-dashboard-metric">
          <h3>Ativos (frota total)</h3>
          <p id="hub-vg-total-ativos" className="hub-dashboard-metric-value">
            {loading ? "…" : totais.ativos}
          </p>
        </article>
        <article className="card hub-dashboard-metric">
          <h3>Checklists (total período)</h3>
          <p id="hub-vg-total-check" className="hub-dashboard-metric-value">
            {exibirContagem(totais.check, loading)}
          </p>
        </article>
        <article className="card hub-dashboard-metric">
          <h3>O.S. em aberto (todas)</h3>
          <p id="hub-vg-total-os-aberta" className="hub-dashboard-metric-value">
            {totalOsAberta > 0 ? totalOsAberta : "—"}
          </p>
        </article>
      </div>

      <article className="card hub-dashboard-table-card">
        <h3 className="hub-dashboard-table-title">Contratos por cliente</h3>
        {loading && (
          <p className="topbar-user" style={{ margin: "0 0 10px" }}>
            Carregando dados do banco…
          </p>
        )}
        <div className="hub-table-scroll">
          <table className="hub-dashboard-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Ativos</th>
                <th>Checklists</th>
                <th>Em manutenção</th>
                <th>Custo acumulado</th>
                <th>O.S. em cotação</th>
                <th>O.S. NF / pagamento</th>
                {temLocadora ? <th>Abrir painel</th> : null}
              </tr>
            </thead>
            <tbody id="hub-tbody-visao-geral">
              {clientes.length === 0 ? (
                <tr>
                  <td
                    colSpan={temLocadora ? 8 : 7}
                    className="hub-dash-empty"
                  >
                    {loading ? "Carregando…" : "Nenhum cliente carregado."}
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>
                        {c.tipo === "prefeitura" ? "Prefeitura " : "Locadora "}
                      </strong>
                      {c.label}
                    </td>
                    <td className="hub-dash-num">{c.ativos}</td>
                    <td className="hub-dash-num">{c.checklists}</td>
                    <td className="hub-dash-num">{c.manutencao}</td>
                    <td className="hub-dash-num">
                      {c.tipo === "locadora"
                        ? "—"
                        : (c.custoLabel ?? formatarMoeda(0))}
                    </td>
                    <td className="hub-dash-num">
                      {c.tipo === "locadora" ? "—" : (c.nCot ?? 0)}
                    </td>
                    <td className="hub-dash-num">
                      {c.tipo === "locadora" ? "—" : (c.nOs ?? 0)}
                    </td>
                    {temLocadora ? (
                      <td className="hub-dash-action">
                        {c.tipo === "locadora" ? (
                          <button
                            type="button"
                            className="btn btn-primary hub-dash-btn"
                            onClick={() => abrirPainelLocadora(c.id)}
                          >
                            Abrir painel
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
