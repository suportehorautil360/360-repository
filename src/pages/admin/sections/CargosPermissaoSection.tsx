import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useHU360 } from "../../../lib/hu360";
import { CARGOS_PREDEF } from "../../../lib/funcionarios/cargos";
import {
  cargosPermissaoApi,
  GRUPOS_MENU,
  matrizCargosGrupos,
  normalizarCargo,
  type PorCargo,
} from "../../../lib/acesso/cargos-permissao";

function CargoPermRow({
  id,
  nome,
  uf,
}: {
  id: string;
  nome: string;
  uf: string;
}) {
  const [mapa, setMapa] = useState<PorCargo | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    cargosPermissaoApi
      .obter(id)
      .then((m) => vivo && setMapa(m))
      .catch(() => vivo && setMapa({}));
    return () => {
      vivo = false;
    };
  }, [id]);

  const matriz = mapa ? matrizCargosGrupos(mapa) : null;

  async function toggle(cargoLabel: string, grupo: string) {
    if (!mapa) return;
    const chave = normalizarCargo(cargoLabel);
    const atuais = matrizCargosGrupos(mapa)[cargoLabel] ?? [];
    const ligado = atuais.includes(grupo);
    const proximosGrupos = ligado
      ? atuais.filter((g) => g !== grupo)
      : [...atuais, grupo];

    const proximoMapa: PorCargo = {
      ...mapa,
      [chave]: proximosGrupos,
    };

    setSalvando(true);
    try {
      const salvos = await cargosPermissaoApi.salvar(id, proximoMapa);
      setMapa(salvos);
      toast.success(
        `${cargoLabel}: ${grupo} ${ligado ? "removido" : "liberado"} em ${nome}.`,
      );
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <article className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: "0.95rem" }}>
        {nome}{" "}
        <span style={{ color: "var(--muted)", fontWeight: 500 }}>({uf})</span>
      </h3>
      <div className="hub-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Cargo</th>
              {GRUPOS_MENU.map((g) => (
                <th key={g} style={{ textAlign: "center" }}>
                  {g}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matriz === null ? (
              <tr>
                <td
                  colSpan={1 + GRUPOS_MENU.length}
                  style={{ color: "var(--muted)" }}
                >
                  Carregando…
                </td>
              </tr>
            ) : (
              CARGOS_PREDEF.map((cargo) => (
                <tr key={cargo}>
                  <td>{cargo}</td>
                  {GRUPOS_MENU.map((grupo) => {
                    const checked = (matriz[cargo] ?? []).includes(grupo);
                    return (
                      <td key={grupo} style={{ textAlign: "center" }}>
                        <label className="hu-switch">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={salvando}
                            onChange={() => void toggle(cargo, grupo)}
                          />
                          <span className="hu-switch__track" aria-hidden="true">
                            <span className="hu-switch__thumb" />
                          </span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function CargosPermissaoSection() {
  const { prefeituras } = useHU360();

  return (
    <section id="cargos-permissao" className="aba-conteudo ativa">
      <h2>Cargos e acessos</h2>
      <p className="topbar-user" style={{ marginBottom: 14 }}>
        Defina quais grupos do menu da prefeitura cada cargo pode ver. Sem
        configuração salva, vale o padrão do sistema.
      </p>

      {prefeituras.length === 0 ? (
        <article className="card">
          <p style={{ color: "var(--muted)", margin: 0 }}>
            Nenhuma prefeitura cadastrada.
          </p>
        </article>
      ) : (
        prefeituras.map((p) => (
          <CargoPermRow key={p.id} id={p.id} nome={p.nome} uf={p.uf} />
        ))
      )}
    </section>
  );
}
