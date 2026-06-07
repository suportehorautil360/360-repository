import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Prefeitura } from "../../../lib/hu360";
import { useHU360 } from "../../../lib/hu360";
import { useClientes } from "../hooks/clientes/use-clientes";

export function ClientesSection() {
  const { listarClientes } = useClientes();
  const { prefeituraLabel } = useHU360();
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Prefeitura[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      setLoading(true);
      const lista = await listarClientes();
      if (ativo) {
        setClientes(lista);
        setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [listarClientes]);

  function abrirPainel(cliente: Prefeitura) {
    if (cliente.tipoCliente === "locacao") {
      navigate(`/locacao/${cliente.id}`);
      return;
    }
    navigate(`/prefeitura/${cliente.id}`);
  }

  return (
    <section id="clientes" className="aba-conteudo ativa">
      <h2>Clientes</h2>

      <article className="card hub-dashboard-table-card">
        <h3 className="hub-dashboard-table-title">Clientes contratantes</h3>
        {loading && (
          <p className="topbar-user" style={{ margin: "0 0 10px" }}>
            Carregando clientes…
          </p>
        )}
        <div className="hub-table-scroll">
          <table className="hub-dashboard-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>UF</th>
                <th>Status</th>
                <th>Abrir painel</th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="hub-dash-empty">
                    {loading ? "Carregando…" : "Nenhum cliente cadastrado."}
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>
                        {c.tipoCliente === "locacao" ? "Locadora " : "Prefeitura "}
                      </strong>
                      {prefeituraLabel(c.id)}
                    </td>
                    <td className="hub-dash-num">
                      {c.tipoCliente === "locacao" ? "Locação" : "Prefeitura"}
                    </td>
                    <td className="hub-dash-num">{c.uf}</td>
                    <td className="hub-dash-num">
                      {c.contrato?.status === "ativo" ? "Ativo" : (c.contrato?.status ?? "—")}
                    </td>
                    <td className="hub-dash-action">
                      <button
                        type="button"
                        className="btn btn-primary hub-dash-btn"
                        onClick={() => abrirPainel(c)}
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
    </section>
  );
}
