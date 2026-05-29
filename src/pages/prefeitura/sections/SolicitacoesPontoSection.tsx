import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, X, Paperclip, RotateCcw } from "lucide-react";
import {
  solicitacoesPontoApi,
  type SolicitacaoPonto,
  type StatusSolicitacao,
  type TipoSolicitacao,
} from "../../../lib/api/solicitacoes-ponto";
import { abonosApi, type Abono } from "../../../lib/api/abonos";
import "./solicitacoes-ponto.css";

const TIPO_LABEL: Record<TipoSolicitacao, string> = {
  incluir: "Incluir batida",
  cancelar: "Cancelar batida",
  abono: "Solicitar abono",
  mensagem: "Mensagem ao gestor",
};

const STATUS_LABEL: Record<StatusSolicitacao, string> = {
  pendente: "Pendente",
  aprovado: "Aprovada",
  reprovado: "Reprovada",
};

function fmtDataHora(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SolicitacoesPontoSection({
  prefeituraId,
}: {
  prefeituraId: string;
}) {
  const [lista, setLista] = useState<SolicitacaoPonto[]>([]);
  const [abonos, setAbonos] = useState<Abono[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | StatusSolicitacao>(
    "pendente",
  );
  const [reprovandoId, setReprovandoId] = useState<string | null>(null);
  const [motivoReprov, setMotivoReprov] = useState("");
  const [anexoAberto, setAnexoAberto] = useState<string | null>(null);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setCarregando(true);
    setErro("");
    try {
      const [sols, abs] = await Promise.all([
        solicitacoesPontoApi.listar(prefeituraId),
        abonosApi.listar(prefeituraId).catch(() => []),
      ]);
      setLista(sols);
      setAbonos(abs);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  /** Mapeia solicitacaoId → abonoId, pra saber quais abonos ainda existem. */
  const abonoBySolicitacao = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of abonos) {
      if (a.solicitacaoId) m.set(a.solicitacaoId, a.id);
    }
    return m;
  }, [abonos]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    if (filtroStatus === "todos") return lista;
    return lista.filter((s) => s.status === filtroStatus);
  }, [lista, filtroStatus]);

  const totalPendentes = useMemo(
    () => lista.filter((s) => s.status === "pendente").length,
    [lista],
  );

  async function aprovar(id: string) {
    setOcupadoId(id);
    try {
      await solicitacoesPontoApi.aprovar(id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao aprovar.");
    } finally {
      setOcupadoId(null);
    }
  }

  async function confirmarReprov(id: string) {
    if (!motivoReprov.trim()) return;
    setOcupadoId(id);
    try {
      await solicitacoesPontoApi.reprovar(id, motivoReprov.trim());
      setReprovandoId(null);
      setMotivoReprov("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao reprovar.");
    } finally {
      setOcupadoId(null);
    }
  }

  /**
   * Cancela um abono aprovado — chama DELETE /abonos/:id. A solicitação
   * em si fica como `aprovado` (histórico) mas o abono deixa de existir,
   * então o dia volta a contar como "falta" no cálculo de saldo/KPIs.
   */
  async function cancelarAbono(solicitacaoId: string, abonoId: string) {
    const ok = window.confirm(
      "Cancelar o abono aprovado? O dia volta a contar como falta no saldo do funcionário.",
    );
    if (!ok) return;
    setOcupadoId(solicitacaoId);
    try {
      await abonosApi.remover(abonoId);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao cancelar o abono.");
    } finally {
      setOcupadoId(null);
    }
  }

  return (
    <div className="sol">
      <section className="sol__card">
        <header className="sol__card-head">
          <h2 className="sol__card-titulo">
            <span aria-hidden="true">📨</span> Solicitações de ponto
            {totalPendentes > 0 && (
              <span className="sol__badge">{totalPendentes} pendentes</span>
            )}
          </h2>
          <select
            value={filtroStatus}
            onChange={(e) =>
              setFiltroStatus(e.target.value as "todos" | StatusSolicitacao)
            }
          >
            <option value="pendente">Pendentes</option>
            <option value="aprovado">Aprovadas</option>
            <option value="reprovado">Reprovadas</option>
            <option value="todos">Todas</option>
          </select>
        </header>

        {erro && <p className="sol__msg sol__msg--err">{erro}</p>}

        {carregando ? (
          <p className="sol__vazio">Carregando solicitações…</p>
        ) : filtrados.length === 0 ? (
          <p className="sol__vazio">
            {filtroStatus === "pendente"
              ? "Nenhuma solicitação pendente. 🎉"
              : "Nenhuma solicitação encontrada."}
          </p>
        ) : (
          <ul className="sol__lista">
            {filtrados.map((s) => (
              <li key={s.id} className={`sol__item sol__item--${s.status}`}>
                <div className="sol__item-topo">
                  <span className={`sol__tag sol__tag--${s.tipo}`}>
                    {TIPO_LABEL[s.tipo]}
                  </span>
                  <span className="sol__nome">{s.name}</span>
                  <span className="sol__data">{fmtDataHora(s.createdAt)}</span>
                  <span className={`sol__status sol__status--${s.status}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>

                <div className="sol__detalhes">
                  {s.tipo === "incluir" && s.timestampOriginal && (
                    <span>
                      <strong>Batida pedida:</strong>{" "}
                      {fmtDataHora(s.timestampOriginal)}
                    </span>
                  )}
                  {s.tipo === "cancelar" && s.batidaId && (
                    <span>
                      <strong>Batida-alvo:</strong>{" "}
                      <code>{s.batidaId.slice(0, 8)}…</code>
                    </span>
                  )}
                  {s.tipo === "abono" && s.data && (
                    <span>
                      <strong>Dia:</strong> {s.data.split("-").reverse().join("/")}
                    </span>
                  )}
                  {s.observacao && (
                    <span className="sol__obs">{s.observacao}</span>
                  )}
                  {s.anexoNome && s.anexoDataUrl && (
                    <button
                      type="button"
                      className="sol__anexo-link"
                      onClick={() => setAnexoAberto(s.anexoDataUrl ?? null)}
                    >
                      <Paperclip size={12} aria-hidden="true" /> {s.anexoNome}
                    </button>
                  )}
                  {s.status === "reprovado" && s.motivoReprovacao && (
                    <span className="sol__motivo-reprov">
                      <strong>Motivo da reprovação:</strong> {s.motivoReprovacao}
                    </span>
                  )}
                </div>

                {/* Abono aprovado com registro ainda ativo: permitir cancelar. */}
                {s.tipo === "abono" &&
                  s.status === "aprovado" &&
                  abonoBySolicitacao.has(s.id) && (
                    <div className="sol__acoes">
                      <button
                        type="button"
                        className="sol__btn sol__btn--err"
                        disabled={ocupadoId === s.id}
                        onClick={() =>
                          void cancelarAbono(
                            s.id,
                            abonoBySolicitacao.get(s.id) as string,
                          )
                        }
                      >
                        <RotateCcw size={13} aria-hidden="true" />
                        Cancelar abono
                      </button>
                    </div>
                  )}

                {s.status === "pendente" && (
                  <div className="sol__acoes">
                    {reprovandoId === s.id ? (
                      <>
                        <input
                          type="text"
                          className="sol__motivo-input"
                          placeholder="Motivo da reprovação"
                          value={motivoReprov}
                          onChange={(e) => setMotivoReprov(e.target.value)}
                        />
                        <button
                          type="button"
                          className="sol__btn sol__btn--err"
                          disabled={ocupadoId === s.id || !motivoReprov.trim()}
                          onClick={() => void confirmarReprov(s.id)}
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          className="sol__btn"
                          onClick={() => {
                            setReprovandoId(null);
                            setMotivoReprov("");
                          }}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="sol__btn sol__btn--ok"
                          disabled={ocupadoId === s.id}
                          onClick={() => void aprovar(s.id)}
                        >
                          <Check size={14} aria-hidden="true" />
                          Aprovar
                        </button>
                        <button
                          type="button"
                          className="sol__btn sol__btn--err"
                          onClick={() => {
                            setReprovandoId(s.id);
                            setMotivoReprov("");
                          }}
                        >
                          <X size={14} aria-hidden="true" />
                          Reprovar
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {anexoAberto && (
        <div
          className="sol__anexo-modal"
          role="presentation"
          onClick={() => setAnexoAberto(null)}
        >
          {anexoAberto.startsWith("data:image") ||
          anexoAberto.startsWith("data:application/pdf") ? (
            anexoAberto.startsWith("data:image") ? (
              <img src={anexoAberto} alt="Anexo" />
            ) : (
              <iframe src={anexoAberto} title="Anexo" />
            )
          ) : (
            <a href={anexoAberto} download>
              Baixar anexo
            </a>
          )}
        </div>
      )}
    </div>
  );
}
