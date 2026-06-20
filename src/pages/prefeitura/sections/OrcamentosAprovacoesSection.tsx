import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  osOrcamentosAprovacoesApi,
  mensagemErroAprovarOrcamento,
  mensagemErroListarOrcamentos,
  type OsComOrcamentosCard,
} from "../../../lib/api/os-orcamentos-aprovacoes";
import {
  fmtBRL,
  prontoParaAprovar,
  statusOrdem,
  statusSolicitacao,
  totalConvidadas,
  type OrdemOrcamento,
  type SolicitacaoOrcamento,
} from "./orcamentos-aprovacoes-model";
import "./orcamentos-aprovacoes.css";
import { OrcamentoSolDetalheModal } from "./OrcamentoSolDetalheModal";

export function OrcamentosAprovacoesSection({
  prefeituraId,
}: {
  prefeituraId: string;
}) {
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

  async function handleAprovar(ordemId: string, solicitacaoId: string) {
    setAprovando(ordemId);
    setMsgAcao(null);
    try {
      await osOrcamentosAprovacoesApi.aprovar(solicitacaoId, ordemId);
      setMsgAcao({
        id: solicitacaoId,
        text: "Orçamento aprovado com sucesso!",
        ok: true,
      });
      await carregar();
    } catch (err) {
      setMsgAcao({
        id: solicitacaoId,
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
        <h1 className="oap-title">Orçamentos e Aprovações</h1>
        <p className="oap-subtitle">
          Cada O.S. pode receber orçamentos de até 3 oficinas credenciadas.
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
                            const podeAprovar =
                              ord.status === "aguardando_aprovacao" &&
                              sol.status !== "aprovado";
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
                                          void handleAprovar(ord.id, sol.id)
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

      {modalOrdem ? (
        <div
          className="pf-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setModalOrdem(null)}
        >
          <div className="pf-modal-box" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pf-modal-fechar"
              onClick={() => setModalOrdem(null)}
              aria-label="Fechar"
            >
              ×
            </button>
            <h2 className="pf-modal-titulo">
              Orçamento — {modalOrdem.protocolo}
            </h2>
            <p className="pf-modal-sub">
              Oficina: {modalOrdem.oficinaNome ?? modalOrdem.operador}{" "}
              &nbsp;·&nbsp; Equipamento: {modalOrdem.equipamento}
            </p>
            <p className="pf-modal-meta">
              <strong>Defeito:</strong> {modalOrdem.defeito}
            </p>
            <table className="pf-modal-tabela">
              <thead>
                <tr>
                  <th>Item / Serviço</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {(modalOrdem.itens ?? []).map((it, i) => (
                  <tr key={i}>
                    <td>{it.descricao}</td>
                    <td style={{ textAlign: "right" }}>
                      {fmtBRL(it.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="pf-modal-total">
              Total: {fmtBRL(modalOrdem.valorTotal)}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
