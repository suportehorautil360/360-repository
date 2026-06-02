import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useHU360 } from "../../../lib/hu360";
import { featureFlagsApi } from "../../../lib/api/feature-flags";

/** Linha de uma prefeitura com o toggle da flag de Ponto. */
function FlagRow({ id, nome, uf }: { id: string; nome: string; uf: string }) {
  const [ponto, setPonto] = useState<boolean | null>(null); // null = carregando
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    featureFlagsApi
      .obter(id)
      .then((f) => vivo && setPonto(f.ponto === true))
      .catch(() => vivo && setPonto(false));
    return () => {
      vivo = false;
    };
  }, [id]);

  async function toggle() {
    if (ponto === null) return;
    const novo = !ponto;
    setSalvando(true);
    try {
      const flags = await featureFlagsApi.obter(id);
      await featureFlagsApi.salvar(id, { ...flags, ponto: novo });
      setPonto(novo);
      toast.success(`Ponto ${novo ? "ativado" : "desativado"} para ${nome}.`);
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <tr>
      <td>
        {nome} <span style={{ color: "var(--muted)" }}>({uf})</span>
      </td>
      <td style={{ textAlign: "right" }}>
        <label className="hu-switch">
          <input
            type="checkbox"
            checked={ponto ?? false}
            disabled={ponto === null || salvando}
            onChange={() => void toggle()}
          />
          <span className="hu-switch__track" aria-hidden="true">
            <span className="hu-switch__thumb" />
          </span>
          <span className="hu-switch__label">
            {ponto === null ? "…" : ponto ? "Ativo" : "Inativo"}
          </span>
        </label>
      </td>
    </tr>
  );
}

export function FuncionalidadesSection() {
  const { prefeituras } = useHU360();

  return (
    <section id="funcionalidades" className="aba-conteudo ativa">
      <h2>Funcionalidades</h2>
      <p className="topbar-user" style={{ marginBottom: 14 }}>
        Ative ou desative recursos por cliente. Hoje: <strong>Ponto</strong>{" "}
        (registro de ponto pelo operador e aprovação do RH). Desativado por
        padrão.
      </p>

      <article className="card">
        <div className="hub-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Prefeitura / cliente</th>
                <th style={{ textAlign: "right" }}>Ponto</th>
              </tr>
            </thead>
            <tbody>
              {prefeituras.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ color: "var(--muted)" }}>
                    Nenhuma prefeitura cadastrada.
                  </td>
                </tr>
              ) : (
                prefeituras.map((p) => (
                  <FlagRow key={p.id} id={p.id} nome={p.nome} uf={p.uf} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
