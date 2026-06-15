import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  clientesApi,
  type ClienteOverviewApi,
} from "../../../lib/api/clientes";
import { HUB_CTX_KEY } from "../../../portal/postoPortalCore";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Lê o cliente em foco persistido pela gestão (mesma chave da topbar). */
function lerFocoId(): string {
  try {
    return sessionStorage.getItem(HUB_CTX_KEY) ?? "";
  } catch {
    return "";
  }
}

export function ClientesSection() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<ClienteOverviewApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      setLoading(true);
      setErro(null);
      try {
        const lista = await clientesApi.overview();
        if (ativo) setClientes(lista);
      } catch (e) {
        if (ativo) {
          setErro(
            e instanceof Error ? e.message : "Falha ao carregar os clientes.",
          );
        }
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const totais = useMemo(
    () =>
      clientes.reduce(
        (acc, c) => {
          acc.ativos += c.ativos;
          acc.custo += c.custoAcumulado;
          return acc;
        },
        { ativos: 0, custo: 0 },
      ),
    [clientes],
  );

  const focoLabel = useMemo(() => {
    const id = lerFocoId();
    const c = clientes.find((x) => x.id === id) ?? clientes[0];
    return c ? `${c.nome} (${c.uf})` : "—";
  }, [clientes]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) || c.uf.toLowerCase().includes(q),
    );
  }, [clientes, busca]);

  function abrirPainel(c: ClienteOverviewApi) {
    navigate(
      c.tipoCliente === "locacao" ? `/locacao/${c.id}` : `/prefeitura/${c.id}`,
    );
  }

  return (
    <section id="clientes" className="aba-conteudo ativa">
      <div className="clientes-head">
        <h2>Clientes</h2>
        <button
          type="button"
          className="btn btn-primary clientes-novo"
          onClick={() => navigate("/admin/cadastros")}
        >
          + Novo cliente
        </button>
      </div>
      <p className="clientes-sub">
        Visualize e acesse o painel de todos os clientes contratantes.
      </p>

      <div className="card-grid hub-dashboard-metrics">
        <article className="card hub-dashboard-metric">
          <h3>Clientes contratantes</h3>
          <p className="hub-dashboard-metric-value is-accent">
            {loading ? "…" : clientes.length || "—"}
          </p>
        </article>
        <article className="card hub-dashboard-metric">
          <h3>Ativos (frota total)</h3>
          <p className="hub-dashboard-metric-value">
            {loading ? "…" : totais.ativos}
          </p>
        </article>
        <article className="card hub-dashboard-metric">
          <h3>Custo acumulado</h3>
          <p className="hub-dashboard-metric-value">
            {formatarMoeda(totais.custo)}
          </p>
        </article>
        <article className="card hub-dashboard-metric">
          <h3>Cliente em foco</h3>
          <p className="hub-dashboard-metric-value clientes-foco">
            {loading ? "…" : focoLabel}
          </p>
        </article>
      </div>

      <article className="card hub-dashboard-table-card">
        <div className="clientes-table-head">
          <h3 className="hub-dashboard-table-title">Contratos por cliente</h3>
          <div className="clientes-busca">
            <span aria-hidden="true">🔍</span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou UF..."
              aria-label="Buscar cliente por nome ou UF"
            />
          </div>
        </div>

        {loading && (
          <p className="topbar-user" style={{ margin: "0 0 10px" }}>
            Carregando dados do banco…
          </p>
        )}
        {erro && !loading && (
          <p className="admin-error" style={{ margin: "0 0 10px" }}>
            {erro}
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
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="hub-dash-empty">
                    {loading
                      ? "Carregando…"
                      : busca
                        ? "Nenhum cliente encontrado para a busca."
                        : "Nenhum cliente cadastrado."}
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>
                        {c.tipoCliente === "locacao"
                          ? "Locadora "
                          : "Prefeitura "}
                      </strong>
                      {c.nome} ({c.uf})
                    </td>
                    <td className="hub-dash-num">{c.ativos}</td>
                    <td className="hub-dash-num">{c.checklists}</td>
                    <td className="hub-dash-num">{c.emManutencao}</td>
                    <td className="hub-dash-num">
                      {c.tipoCliente === "locacao"
                        ? "—"
                        : formatarMoeda(c.custoAcumulado)}
                    </td>
                    <td className="hub-dash-num">
                      {c.tipoCliente === "locacao" ? "—" : c.osCotacao}
                    </td>
                    <td className="hub-dash-num">
                      {c.tipoCliente === "locacao" ? "—" : c.osNfPagamento}
                    </td>
                    <td className="hub-dash-action">
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-secondary hub-dash-btn"
                          onClick={() => navigate(`/admin/cadastros/${c.id}`)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary hub-dash-btn"
                          onClick={() => abrirPainel(c)}
                        >
                          Abrir painel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
