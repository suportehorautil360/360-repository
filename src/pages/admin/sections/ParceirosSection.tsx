import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Plus, Users } from "lucide-react";
import {
  clientesApi,
  type ClienteOverviewApi,
} from "../../../lib/api/clientes";
import {
  parceirosApi,
  type OficinaParceiroApi,
  type ParceirosOverviewApi,
  type PostoParceiroApi,
} from "../../../lib/api/parceiros";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CadastroParceiroSection } from "./CadastroParceiroSection";
import {
  ParceiroDetalheDrawer,
  type ParceiroSelecionado,
} from "./ParceiroDetalheDrawer";
import "./parceiros.css";

function StatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={`parc-badge ${ativo ? "parc-badge--ativo" : "parc-badge--inativo"}`}
    >
      {ativo ? "Ativo" : "Suspenso"}
    </span>
  );
}

function PostoRow({
  posto,
  onAbrir,
}: {
  posto: PostoParceiroApi;
  onAbrir: (posto: PostoParceiroApi) => void;
}) {
  const sub = [posto.cidadeUf, posto.bandeira].filter(Boolean).join(" · ");
  return (
    <div className="parc-row">
      <button
        type="button"
        className="parc-row__info parc-row__info--clickable"
        onClick={() => onAbrir(posto)}
      >
        <div className="parc-row__nome">{posto.nome}</div>
        {sub ? <div className="parc-row__sub">{sub}</div> : null}
      </button>
      <span className="parc-row__status">
        <StatusBadge ativo={posto.ativo} />
        <button
          type="button"
          className="parc-row__btn"
          onClick={() => onAbrir(posto)}
        >
          <KeyRound size={14} aria-hidden />
          Detalhes
        </button>
      </span>
    </div>
  );
}

function OficinaRow({
  oficina,
  onAbrir,
}: {
  oficina: OficinaParceiroApi;
  onAbrir: (sel: ParceiroSelecionado) => void;
}) {
  const sub = oficina.cidadeUf || oficina.especialidade;
  return (
    <div className="parc-row">
      <div className="parc-row__info">
        <div className="parc-row__nome">{oficina.nome}</div>
        {sub ? <div className="parc-row__sub">{sub}</div> : null}
      </div>
      <span className="parc-row__status">
        <StatusBadge ativo={oficina.ativo} />
        <button
          type="button"
          className="parc-row__btn"
          onClick={() => onAbrir({ tipo: "oficina", parceiro: oficina })}
        >
          <KeyRound size={14} aria-hidden />
          Logins
        </button>
      </span>
    </div>
  );
}

export function ParceirosSection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [modo, setModo] = useState<"lista" | "cadastro">("lista");
  const [clientes, setClientes] = useState<ClienteOverviewApi[]>([]);
  const [prefeituraId, setPrefeituraId] = useState(
    () => searchParams.get("prefeituraId") ?? "",
  );
  const [dados, setDados] = useState<ParceirosOverviewApi>({
    postos: [],
    oficinas: [],
  });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sel, setSel] = useState<ParceiroSelecionado | null>(null);

  function abrirPosto(posto: PostoParceiroApi) {
    const qs = prefeituraId
      ? `?prefeituraId=${encodeURIComponent(prefeituraId)}`
      : "";
    navigate(`/admin/parceiros/posto/${encodeURIComponent(posto.id)}${qs}`);
  }

  const carregar = useCallback(async (clienteId: string) => {
    setLoading(true);
    setErro(null);
    try {
      const r = await parceirosApi.overview(clienteId || undefined);
      setDados(r);
    } catch (e) {
      setDados({ postos: [], oficinas: [] });
      setErro(
        e instanceof Error ? e.message : "Falha ao carregar os parceiros.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    void clientesApi
      .overview()
      .then((lista) => {
        if (!ativo) return;
        setClientes(lista);
        setPrefeituraId((cur) => cur || lista[0]?.id || "");
      })
      .catch(() => {
        if (ativo) setErro("Falha ao carregar clientes.");
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (modo !== "lista") return;
    if (!prefeituraId) {
      setDados({ postos: [], oficinas: [] });
      setLoading(false);
      return;
    }
    void carregar(prefeituraId);
  }, [modo, prefeituraId, carregar]);

  const clienteSel = clientes.find((c) => c.id === prefeituraId);
  const totalParceiros = dados.postos.length + dados.oficinas.length;

  if (modo === "cadastro") {
    return (
      <section id="oficinas-postos" className="aba-conteudo ativa">
        <CadastroParceiroSection
          onVoltar={() => setModo("lista")}
          defaultPrefeituraId={prefeituraId}
          hideLista
          onSalvo={() => {
            setModo("lista");
            if (prefeituraId) void carregar(prefeituraId);
          }}
        />
      </section>
    );
  }

  return (
    <section id="oficinas-postos" className="aba-conteudo ativa">
      <div className="parc-page-head">
        <div className="parc-page-head__text">
          <h2>Postos e oficinas</h2>
          <p className="topbar-user">
            Cadastre parceiros vinculados ao cliente. Clique em um posto para ver
            dados completos, logins (e-mail e senha na criação) e portal operacional.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModo("cadastro")}
          disabled={!prefeituraId}
        >
          <Plus size={16} aria-hidden style={{ marginRight: 6 }} />
          Cadastrar parceiro
        </button>
      </div>

      <div className="parc-toolbar">
        <div className="parc-toolbar__cliente">
          <label htmlFor="parcSelCliente">Cliente (contrato)</label>
          <Select
            value={clienteSel ? prefeituraId : undefined}
            onValueChange={setPrefeituraId}
            disabled={clientes.length === 0}
          >
            <SelectTrigger id="parcSelCliente" className="admin-select">
              <SelectValue placeholder="Selecione o cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} ({c.uf})
                  {c.tipoCliente === "locacao" ? " · Locação" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="parc-toolbar__stats">
          <div className="parc-stat">
            <strong>{dados.postos.length}</strong>
            <span>Postos</span>
          </div>
          <div className="parc-stat">
            <strong>{dados.oficinas.length}</strong>
            <span>Oficinas</span>
          </div>
          <div className="parc-stat">
            <strong>{totalParceiros}</strong>
            <span>Total</span>
          </div>
        </div>
      </div>

      {erro && !loading ? (
        <p className="admin-error" style={{ marginBottom: 12 }}>
          {erro}
        </p>
      ) : null}

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
            <div className="parc-empty">
              <Users size={18} style={{ opacity: 0.5, marginBottom: 6 }} />
              <div>
                {prefeituraId
                  ? "Nenhum posto neste cliente."
                  : "Selecione um cliente."}
              </div>
            </div>
          ) : (
            dados.postos.map((p) => (
              <PostoRow key={p.id} posto={p} onAbrir={abrirPosto} />
            ))
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
            <div className="parc-empty">
              <Users size={18} style={{ opacity: 0.5, marginBottom: 6 }} />
              <div>
                {prefeituraId
                  ? "Nenhuma oficina neste cliente."
                  : "Selecione um cliente."}
              </div>
            </div>
          ) : (
            dados.oficinas.map((o) => (
              <OficinaRow key={o.id} oficina={o} onAbrir={setSel} />
            ))
          )}
        </article>
      </div>

      <ParceiroDetalheDrawer
        selecionado={sel}
        open={sel !== null}
        onClose={() => setSel(null)}
      />
    </section>
  );
}
