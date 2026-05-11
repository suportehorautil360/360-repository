import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useHU360 } from "../../../lib/hu360";
import type { Prefeitura } from "../../../lib/hu360";

function clienteEhPrefeitura(p: Prefeitura): boolean {
  return !p.tipoCliente || p.tipoCliente === "prefeitura";
}

export function AdminPortalPostoPage() {
  const { prefeituras, prefeituraLabel } = useHU360();
  const navigate = useNavigate();

  const prefsMunicipio = useMemo(
    () => prefeituras.filter(clienteEhPrefeitura),
    [prefeituras],
  );

  return (
    <section className="aba-conteudo ativa">
      <h2>Portal Posto — selecione o município</h2>
      <p className="topbar-user" style={{ marginBottom: 20, maxWidth: 720 }}>
        Escolha o município cujo portal de posto você deseja acessar como
        administrador.
      </p>

      {prefsMunicipio.length === 0 ? (
        <p className="topbar-user">Nenhuma prefeitura cadastrada.</p>
      ) : (
        <div className="hub-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Município</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {prefsMunicipio.map((p) => (
                <tr key={p.id}>
                  <td>{prefeituraLabel(p.id)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: "6px 18px" }}
                      onClick={() => navigate(`/posto/${p.id}`)}
                    >
                      Entrar no portal
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
