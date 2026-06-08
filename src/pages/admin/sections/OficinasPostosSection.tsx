import { useEffect, useState } from "react";
import {
  parceirosApi,
  type OficinaParceiroApi,
  type ParceirosOverviewApi,
  type PostoParceiroApi,
} from "../../../lib/api/parceiros";
import { CadastroParceiroSection } from "./CadastroParceiroSection";

function StatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={`parc-badge ${ativo ? "parc-badge--ativo" : "parc-badge--inativo"}`}
    >
      {ativo ? "Ativo" : "Suspenso"}
    </span>
  );
}

function PostoRow({ posto }: { posto: PostoParceiroApi }) {
  const sub = [posto.cidadeUf, posto.bandeira].filter(Boolean).join(" · ");
  return (
    <div className="parc-row">
      <div className="parc-row__info">
        <div className="parc-row__nome">{posto.nome}</div>
        {sub && <div className="parc-row__sub">{sub}</div>}
      </div>
      <span className="parc-row__status">
        <StatusBadge ativo={posto.ativo} />
      </span>
    </div>
  );
}

function OficinaRow({ oficina }: { oficina: OficinaParceiroApi }) {
  const sub = oficina.cidadeUf || oficina.especialidade;
  return (
    <div className="parc-row">
      <div className="parc-row__info">
        <div className="parc-row__nome">{oficina.nome}</div>
        {sub && <div className="parc-row__sub">{sub}</div>}
      </div>
      <span className="parc-row__status">
        <StatusBadge ativo={oficina.ativo} />
      </span>
    </div>
  );
}

export function OficinasPostosSection() {
  const [dados, setDados] = useState<ParceirosOverviewApi>({
    postos: [],
    oficinas: [],
  });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<"overview" | "cadastro">("overview");

  useEffect(() => {
    if (modo !== "overview") return;
    let ativo = true;
    void (async () => {
      setLoading(true);
      setErro(null);
      try {
        const r = await parceirosApi.overview();
        if (ativo) setDados(r);
      } catch (e) {
        if (ativo) {
          setErro(
            e instanceof Error ? e.message : "Falha ao carregar os parceiros.",
          );
        }
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [modo]);

  if (modo === "cadastro") {
    return (
      <section id="oficinas-postos" className="aba-conteudo ativa">
        <CadastroParceiroSection onVoltar={() => setModo("overview")} />
      </section>
    );
  }

  return (
    <section id="oficinas-postos" className="aba-conteudo ativa">
      <h2>🏭 Oficinas e Postos</h2>
      <p className="topbar-user" style={{ marginBottom: 4 }}>
        Rede de parceiros credenciados para atendimento da frota.
      </p>

      {erro && !loading && (
        <p className="admin-error" style={{ marginTop: 12 }}>
          {erro}
        </p>
      )}

      <div className="parc-grid">
        <article className="parc-card">
          <div className="parc-card__head">
            <span aria-hidden="true">⛽</span>
            Postos de Combustível
            <span className="parc-card__count">{dados.postos.length}</span>
          </div>
          {loading ? (
            <div className="parc-empty">Carregando…</div>
          ) : dados.postos.length === 0 ? (
            <div className="parc-empty">Nenhum posto credenciado.</div>
          ) : (
            dados.postos.map((p) => <PostoRow key={p.id} posto={p} />)
          )}
        </article>

        <article className="parc-card">
          <div className="parc-card__head">
            <span aria-hidden="true">🔧</span>
            Oficinas Mecânicas
            <span className="parc-card__count">{dados.oficinas.length}</span>
          </div>
          {loading ? (
            <div className="parc-empty">Carregando…</div>
          ) : dados.oficinas.length === 0 ? (
            <div className="parc-empty">Nenhuma oficina credenciada.</div>
          ) : (
            dados.oficinas.map((o) => <OficinaRow key={o.id} oficina={o} />)
          )}
        </article>
      </div>

      <button
        type="button"
        className="btn btn-primary parc-novo"
        onClick={() => setModo("cadastro")}
      >
        + Cadastrar novo parceiro
      </button>
    </section>
  );
}
