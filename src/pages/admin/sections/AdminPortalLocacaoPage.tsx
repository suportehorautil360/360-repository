import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useHU360 } from "../../../lib/hu360";
import type { Prefeitura } from "../../../lib/hu360";

function clienteEhLocacao(p: Prefeitura): boolean {
  return p.tipoCliente === "locacao";
}

export function AdminPortalLocacaoPage() {
  const { prefeituras, prefeituraLabel } = useHU360();
  const navigate = useNavigate();

  const locadoras = useMemo(
    () => prefeituras.filter(clienteEhLocacao),
    [prefeituras],
  );

  return (
    <section className="aba-conteudo ativa">
      <h2>Painel Locação — selecione a empresa</h2>
      <p className="topbar-user" style={{ marginBottom: 20, maxWidth: 720 }}>
        Escolha a empresa de locação cujo painel você deseja acessar como
        administrador.
      </p>

      {locadoras.length === 0 ? (
        <p className="topbar-user">Nenhuma empresa de locação cadastrada.</p>
      ) : (
        <div className="hub-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {locadoras.map((p) => (
                <tr key={p.id}>
                  <td>{prefeituraLabel(p.id)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: "6px 18px" }}
                      onClick={() => navigate(`/locacao/${p.id}`)}
                    >
                      Entrar no painel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
