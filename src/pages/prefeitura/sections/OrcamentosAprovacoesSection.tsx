import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import {
  osOrcamentosAprovacoesApi,
  mensagemErroAprovarOrcamento,
  mensagemErroListarOrcamentos,
  type OsComOrcamentosCard,
} from "../../../lib/api/os-orcamentos-aprovacoes";
import { DrawerNotificacoes } from "../../../components/Notificacoes/DrawerNotificacoes";
import {
  fmtBRL,
  podeAprovarOrcamento,
  prontoParaAprovar,
  statusOrdem,
  statusSolicitacao,
  totalConvidadas,
  type OrdemOrcamento,
  type SolicitacaoOrcamento,
} from "./orcamentos-aprovacoes-model";
import "./orcamentos-aprovacoes.css";
import { OrcamentoItensModal } from "./OrcamentoItensModal";
import { OrcamentoSolDetalheModal } from "./OrcamentoSolDetalheModal";

export function OrcamentosAprovacoesSection({
  prefeituraId,
}: {
  prefeituraId: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cards, setCards] = useState<OsComOrcamentosCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aprovando, setAprovando] = useState<string | null>(null);
  const [msgAcao, setMsgAcao] = useState<{
    id: string;
    text: string;
    ok: boolean;
  } | null>(null);
  const [modalOrdem, setModalOrdem] = useState<OrdemOrcamento | null>(null);
  const [modalSolicitacao, setModalSolicitacao] =
    useState<SolicitacaoOrcamento | null>(null);

  const carregar = useCallback(async () => {
    if (!prefeituraId) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const data =
        await osOrcamentosAprovacoesApi.listarCards(prefeituraId);
      setCards(data);
    } catch (err) {
      setCards([]);
      setErro(mensagemErroListarOrcamentos(err));
    } finally {
      setLoading(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Abre o modal do orçamento indicado na URL (?orcamento=id) após carregar.
  useEffect(() => {
    if (loading) return;
    const orcamentoId = searchParams.get("orcamento")?.trim();
    if (!orcamentoId) return;

    const encontrada = cards
      .flatMap((card) => card.ordens)
      .find((ord) => ord.id === orcamentoId);

    if (encontrada) {
      setModalOrdem(encontrada);
    }

    const next = new URLSearchParams(searchParams);
    next.delete("orcamento");
    setSearchParams(next, { replace: true });
  }, [loading, cards, searchParams, setSearchParams]);

  async function handleAprovar(ord: OrdemOrcamento, sol: SolicitacaoOrcamento) {
    if (!podeAprovarOrcamento(sol, ord)) return;

    const oficina = ord.oficinaNome ?? ord.operador ?? "oficina";
    const confirmado = window.confirm(
      `Aprovar orçamento de ${oficina} (${fmtBRL(ord.valorTotal)})?\n\n` +
        "As demais propostas desta O.S. serão recusadas automaticamente.",
    );
    if (!confirmado) return;

    setAprovando(ord.id);
    setMsgAcao(null);
    try {
      await osOrcamentosAprovacoesApi.aprovar(sol.id, ord.id);
      setMsgAcao({
        id: sol.id,
        text: `Orçamento de ${oficina} aprovado com sucesso!`,
        ok: true,
      });
      await carregar();
    } catch (err) {
      setMsgAcao({
        id: sol.id,
        text: mensagemErroAprovarOrcamento(err),
        ok: false,
      });
    } finally {
      setAprovando(null);
    }
  }

  return (
    <section className="oap-page">
      <div className="oap-wrap">
        <div className="oap-title-row">
          <h1 className="oap-title">Orçamentos e Aprovações</h1>
          <DrawerNotificacoes prefeituraId={prefeituraId} variant="escuro" />
        </div>
        <p className="oap-subtitle">
          Cada O.S. convida todas as oficinas credenciadas compatíveis com o
          segmento e a linha do equipamento.
          Compare os valores e aprove o melhor — as demais propostas serão
          recusadas automaticamente.
        </p>

        <div className="oap-toolbar">
          <button
            type="button"
            className="oap-btn-reload"
            onClick={() => void carregar()}
            disabled={loading}
          >
            {loading ? "Carregando…" : "↻ Recarregar"}
          </button>
          <span className="oap-toolbar__count">
            {cards.length} O.S. abertas
          </span>
        </div>

        {erro ? <div className="oap-erro">{erro}</div> : null}

        {loading ? (
          <div className="oap-loading">Buscando dados…</div>
        ) : cards.length === 0 ? (
          <div className="oap-empty-page">Nenhuma O.S. aberta no momento.</div>
        ) : (
          <div className="oap-cards">
            {cards.map(({ solicitacao: sol, ordens: ordensDoOs }) => {
              const st = statusSolicitacao(sol.status);
              const convidadas = totalConvidadas(sol);
              const pronto = prontoParaAprovar(sol, ordensDoOs);
              const msgAtual = msgAcao?.id === sol.id ? msgAcao : null;

              return (
                <article key={sol.id} className="oap-card">
                  <header className="oap-card__head">
                    <div className="oap-card__intro">
                      <h2 className="oap-card__titulo">
                        {sol.protocolo}
                        <span className={`oap-badge ${st.cls}`}>
                          {st.label}
                        </span>
                      </h2>
                      <p className="oap-card__resumo">{sol.equipamento}</p>
                    </div>
                    <div className="oap-card__aside">
                      <div className="oap-card__contador">
                        <strong
                          className={
                            ordensDoOs.length > 0
                              ? undefined
                              : "oap-card__contador--pendente"
                          }
                        >
                          {ordensDoOs.length}/{convidadas} orçamento(s)
                          recebido(s)
                        </strong>
                        {pronto ? (
                          <div className="oap-card__pronto">
                            ✔ Pronto para aprovar
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="oap-btn oap-btn--detalhe"
                        onClick={() => setModalSolicitacao(sol)}
                      >
                        Ver detalhes
                      </button>
                    </div>
                  </header>

                  {msgAtual ? (
                    <div
                      className={`oap-msg ${msgAtual.ok ? "oap-msg--ok" : "oap-msg--err"}`}
                    >
                      {msgAtual.text}
                    </div>
                  ) : null}

                  {ordensDoOs.length === 0 ? (
                    <p className="oap-empty-card">
                      Nenhum orçamento enviado ainda.
                    </p>
                  ) : (
                    <div className="oap-table-scroll">
                      <table className="oap-table">
                        <thead>
                          <tr>
                            <th>Protocolo</th>
                            <th>Operador (oficina)</th>
                            <th>Valor total</th>
                            <th>Status</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ordensDoOs.map((ord) => {
                            const os = statusOrdem(ord.status);
                            const podeAprovar = podeAprovarOrcamento(sol, ord);
                            const isAprovando = aprovando === ord.id;

                            return (
                              <tr key={ord.id}>
                                <td>
                                  <strong>{ord.protocolo}</strong>
                                </td>
                                <td>{ord.oficinaNome ?? ord.operador}</td>
                                <td className="oap-table__valor">
                                  {fmtBRL(ord.valorTotal)}
                                </td>
                                <td>
                                  <span className={`oap-ordem ${os.cls}`}>
                                    {os.label}
                                  </span>
                                </td>
                                <td>
                                  <div className="oap-acoes">
                                    <button
                                      type="button"
                                      className="oap-btn oap-btn--itens"
                                      onClick={() => setModalOrdem(ord)}
                                    >
                                      Ver itens
                                    </button>
                                    {podeAprovar ? (
                                      <button
                                        type="button"
                                        className="oap-btn oap-btn--aprovar"
                                        disabled={
                                          isAprovando || aprovando !== null
                                        }
                                        onClick={() =>
                                          void handleAprovar(ord, sol)
                                        }
                                      >
                                        {isAprovando
                                          ? "Aprovando…"
                                          : "✓ Aprovar"}
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalSolicitacao ? (
          <OrcamentoSolDetalheModal
            key={modalSolicitacao.id}
            sol={modalSolicitacao}
            orcamentosRecebidos={
              cards.find((c) => c.solicitacao.id === modalSolicitacao.id)
                ?.ordens.length ?? 0
            }
            onFechar={() => setModalSolicitacao(null)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {modalOrdem ? (
          <OrcamentoItensModal
            key={modalOrdem.id}
            ordem={modalOrdem}
            solicitacao={
              cards.find((c) => c.solicitacao.id === modalOrdem.solicitacaoOsId)
                ?.solicitacao ?? null
            }
            aprovando={aprovando === modalOrdem.id}
            onFechar={() => setModalOrdem(null)}
            onAprovar={
              (() => {
                const sol = cards.find(
                  (c) => c.solicitacao.id === modalOrdem.solicitacaoOsId,
                )?.solicitacao;
                if (!sol || !podeAprovarOrcamento(sol, modalOrdem)) {
                  return undefined;
                }
                return () => {
                  void handleAprovar(modalOrdem, sol).then(() =>
                    setModalOrdem(null),
                  );
                };
              })()
            }
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}
