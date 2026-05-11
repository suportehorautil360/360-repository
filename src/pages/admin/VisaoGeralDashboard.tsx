import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHU360 } from "../../lib/hu360";
import { useDashboardFirestore } from "./hooks/dashboard/use-dashboard";

declare global {
  interface Window {
    hubAbrirPainelCliente?: (id: string) => void;
  }
}

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

  // Carrega contagens do Firestore na montagem e quando reloadKey muda
  useEffect(() => {
    void carregar();
  }, [carregar, reloadKey]);

  // Monta linhas a partir das prefeituras + dados do Firestore
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
    console.log("Linhas montadas para dashboard:", linhas);
    setClientesHU360(linhas);
  }, [reloadKey, clientesProp, prefeituras, prefeituraLabel, linhasFirestore]);

  const clientes = clientesProp ?? clientesHU360;

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

  function abrirPainelCliente(id: string) {
    if (typeof window.hubAbrirPainelCliente === "function") {
      window.hubAbrirPainelCliente(id);
      return;
    }
    const actualCliente = clientes.find((c) => c.id === id);

    console.log("Abrindo painel para cliente", id, actualCliente);

    if (actualCliente?.tipo === "prefeitura") {
      navigate(`/prefeitura/${id}`);
      return;
    }
    if (actualCliente?.tipo === "locadora") {
      navigate(`/locacao/${id}`);
      return;
    }
  }

  const totalOsAberta = totais.cot + totais.os;

  return (
    <>
      <div className="card-grid" style={{ marginBottom: 16 }}>
        <article className="card">
          <h3>Clientes contratantes</h3>
          <p id="hub-vg-n-pref">{clientes.length || "—"}</p>
        </article>
        <article className="card">
          <h3>Ativos (frota total)</h3>
          <p id="hub-vg-total-ativos">{loading ? "…" : totais.ativos || "—"}</p>
        </article>
        <article className="card">
          <h3>Checklists (total período)</h3>
          <p id="hub-vg-total-check">{loading ? "…" : totais.check || "—"}</p>
        </article>
        <article className="card">
          <h3>O.S. em aberto (todas)</h3>
          <p id="hub-vg-total-os-aberta">{totalOsAberta || "—"}</p>
        </article>
      </div>

      <article className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 8 }}>Contratos por cliente</h3>
        {loading && (
          <p className="topbar-user" style={{ margin: "0 0 10px" }}>
            Carregando dados do banco…
          </p>
        )}
        <div className="hub-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Ativos</th>
                <th>Checklists</th>
                <th>Em manutenção</th>
                <th>Custo acumulado</th>
                <th>O.S. em cotação</th>
                <th>O.S. NF / pagamento</th>
                <th>Abrir painel</th>
              </tr>
            </thead>
            <tbody id="hub-tbody-visao-geral">
              {clientes.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: "center", color: "var(--muted)" }}
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
                    <td>{c.ativos}</td>
                    <td>{c.checklists}</td>
                    <td>{c.manutencao}</td>
                    <td>
                      {c.tipo === "locadora" ? "---" : (c.custoLabel ?? "0")}
                    </td>
                    <td>{c.tipo === "locadora" ? "---" : (c.nCot ?? "0")}</td>
                    <td>{c.tipo === "locadora" ? "---" : (c.nOs ?? "0")}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{
                          marginTop: 0,
                          padding: "6px 12px",
                          fontSize: "0.82rem",
                        }}
                        onClick={() => abrirPainelCliente(c.id)}
                      >
                        Abrir painel
                      </button>
                    </td>
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
