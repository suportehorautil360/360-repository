import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useHU360 } from "../../../lib/hu360";
import {
  featureFlagsApi,
  FEATURE_FLAGS,
  type FeatureFlags,
} from "../../../lib/api/feature-flags";

const FLAGS = FEATURE_FLAGS;

/** Linha de uma prefeitura com um toggle por funcionalidade. */
function FlagRow({ id, nome, uf }: { id: string; nome: string; uf: string }) {
  const [flags, setFlags] = useState<FeatureFlags | null>(null); // null = carregando
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    featureFlagsApi
      .obter(id)
      .then((f) => vivo && setFlags(f))
      .catch(() => vivo && setFlags({}));
    return () => {
      vivo = false;
    };
  }, [id]);

  async function toggle(f: (typeof FLAGS)[number]) {
    if (flags === null) return;
    const atual = flags[f.key] ?? f.default;
    const novo = !atual;
    setSalvando(true);
    try {
      // Relê antes de salvar pra não sobrescrever outras flags concorrentes.
      const atuais = await featureFlagsApi.obter(id);
      const proximos = { ...atuais, [f.key]: novo };
      await featureFlagsApi.salvar(id, proximos);
      setFlags(proximos);
      toast.success(
        `${f.label} ${novo ? "ativado" : "desativado"} para ${nome}.`,
      );
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
      {FLAGS.map((f) => {
        const valor = flags?.[f.key] ?? f.default;
        return (
          <td key={f.key} style={{ textAlign: "right" }}>
            <label className="hu-switch">
              <input
                type="checkbox"
                checked={valor}
                disabled={flags === null || salvando}
                onChange={() => void toggle(f)}
              />
              <span className="hu-switch__track" aria-hidden="true">
                <span className="hu-switch__thumb" />
              </span>
              <span className="hu-switch__label">
                {flags === null ? "…" : valor ? "Ativo" : "Inativo"}
              </span>
            </label>
          </td>
        );
      })}
    </tr>
  );
}

export function FuncionalidadesSection() {
  const { prefeituras } = useHU360();

  return (
    <section id="funcionalidades" className="aba-conteudo ativa">
      <h2>Funcionalidades</h2>
      <p className="topbar-user" style={{ marginBottom: 14 }}>
        Ative ou desative recursos por cliente. Desativados por padrão.
      </p>

      <article className="card">
        <div className="hub-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Prefeitura / cliente</th>
                {FLAGS.map((f) => (
                  <th key={f.key} style={{ textAlign: "right" }}>
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prefeituras.length === 0 ? (
                <tr>
                  <td
                    colSpan={1 + FLAGS.length}
                    style={{ color: "var(--muted)" }}
                  >
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
