import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../lib/firebase/firebase";
import {
  fmtBRL,
  fmtDataOs,
  fmtLinha,
  isMockRegistro,
  listaSolicitacoesParaExibicao,
  ORDENS_MOCK,
  ordensParaExibicao,
  prontoParaAprovar,
  SOLICITACOES_MOCK,
  statusOrdem,
  statusSolicitacao,
  totalConvidadas,
  type OrdemOrcamento,
  type SolicitacaoOrcamento,
} from "./orcamentos-aprovacoes-model";
import "./orcamentos-aprovacoes.css";

export function OrcamentosAprovacoesSection({
  prefeituraId,
}: {
  prefeituraId: string;
}) {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoOrcamento[]>([]);
  const [ordens, setOrdens] = useState<OrdemOrcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aprovando, setAprovando] = useState<string | null>(null);
  const [msgAcao, setMsgAcao] = useState<{
    id: string;
    text: string;
    ok: boolean;
  } | null>(null);
  const [modalOrdem, setModalOrdem] = useState<OrdemOrcamento | null>(null);
  const [mockSolicitacoes, setMockSolicitacoes] = useState(SOLICITACOES_MOCK);
  const [mockOrdens, setMockOrdens] = useState(ORDENS_MOCK);

  const carregar = useCallback(async () => {
    if (!prefeituraId) {
      setSolicitacoes([]);
      setOrdens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const snapSol = await getDocs(
        query(
          collection(db, "solicitacoesOS"),
          where("prefeituraId", "==", prefeituraId),
        ),
      );

      const sols = snapSol.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SolicitacaoOrcamento, "id">),
        }))
        .sort(
          (a, b) => (b.criadoEm?.seconds ?? 0) - (a.criadoEm?.seconds ?? 0),
        );
      setSolicitacoes(sols);

      if (sols.length === 0) {
        setOrdens([]);
        return;
      }

      const ids = sols.map((s) => s.id);
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 30) {
        chunks.push(ids.slice(i, i + 30));
      }

      const ordensAll: OrdemOrcamento[] = [];
      await Promise.all(
        chunks.map(async (chunk) => {
          const snap = await getDocs(
            query(
              collection(db, "ordensServico"),
              where("solicitacaoOsId", "in", chunk),
            ),
          );
          snap.docs.forEach((d) => {
            ordensAll.push({
              id: d.id,
              ...(d.data() as Omit<OrdemOrcamento, "id">),
            });
          });
        }),
      );
      setOrdens(ordensAll);
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar orçamentos.",
      );
    } finally {
      setLoading(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const solicitacoesExibir = useMemo(() => {
    const base = listaSolicitacoesParaExibicao(solicitacoes);
    return base.map(
      (s) =>
        mockSolicitacoes.find((m) => m.id === s.id) ?? s,
    );
  }, [solicitacoes, mockSolicitacoes]);

  const ordensExibir = useMemo(
    () => ordensParaExibicao(ordens, solicitacoesExibir, mockOrdens),
    [ordens, solicitacoesExibir, mockOrdens],
  );

  function aplicarAprovacaoLocal(ordemId: string, solicitacaoId: string): void {
    setMockOrdens((prev) =>
      prev.map((o) => {
        if (o.solicitacaoOsId !== solicitacaoId) return o;
        if (o.id === ordemId) return { ...o, status: "aprovado" };
        if (o.status === "aguardando_aprovacao") {
          return { ...o, status: "recusado" };
        }
        return o;
      }),
    );
    setMockSolicitacoes((prev) =>
      prev.map((s) =>
        s.id === solicitacaoId ? { ...s, status: "aprovado" } : s,
      ),
    );
  }

  async function handleAprovar(ordemId: string, solicitacaoId: string) {
    setAprovando(ordemId);
    setMsgAcao(null);
    try {
      if (isMockRegistro(solicitacaoId) || isMockRegistro(ordemId)) {
        aplicarAprovacaoLocal(ordemId, solicitacaoId);
        setMsgAcao({
          id: solicitacaoId,
          text: "Orçamento aprovado com sucesso!",
          ok: true,
        });
        return;
      }

      const batch = writeBatch(db);
      batch.update(doc(db, "ordensServico", ordemId), { status: "aprovado" });

      ordensExibir
        .filter(
          (o) =>
            o.solicitacaoOsId === solicitacaoId &&
            o.id !== ordemId &&
            o.status === "aguardando_aprovacao" &&
            !isMockRegistro(o.id),
        )
        .forEach((o) => {
          batch.update(doc(db, "ordensServico", o.id), { status: "recusado" });
        });

      batch.update(doc(db, "solicitacoesOS", solicitacaoId), {
        status: "aprovado",
      });

      await batch.commit();
      setMsgAcao({
        id: solicitacaoId,
        text: "Orçamento aprovado com sucesso!",
        ok: true,
      });
      await carregar();
    } catch {
      setMsgAcao({
        id: solicitacaoId,
        text: "Erro ao aprovar. Tente novamente.",
        ok: false,
      });
    } finally {
      setAprovando(null);
    }
  }

  function ordensDaSolicitacao(solId: string): OrdemOrcamento[] {
    return ordensExibir.filter((o) => o.solicitacaoOsId === solId);
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
            {solicitacoesExibir.length} O.S. abertas
          </span>
        </div>

        {erro ? <div className="oap-erro">{erro}</div> : null}

        {loading ? (
          <div className="oap-loading">Buscando dados…</div>
        ) : solicitacoesExibir.length === 0 ? (
          <div className="oap-empty-page">Nenhuma O.S. aberta no momento.</div>
        ) : (
          <div className="oap-cards">
            {solicitacoesExibir.map((sol) => {
              const ordensDoOs = ordensDaSolicitacao(sol.id);
              const st = statusSolicitacao(sol.status);
              const convidadas = totalConvidadas(sol);
              const pronto = prontoParaAprovar(sol, ordensDoOs);
              const msgAtual = msgAcao?.id === sol.id ? msgAcao : null;

              return (
                <article key={sol.id} className="oap-card">
                  <header className="oap-card__head">
                    <div>
                      <h2 className="oap-card__titulo">
                        {sol.protocolo}
                        <span className={`oap-badge ${st.cls}`}>
                          {st.label}
                        </span>
                      </h2>
                      <p className="oap-card__meta">
                        <strong>Equipamento:</strong> {sol.equipamento}{" "}
                        &nbsp;·&nbsp;
                        <strong>Linha:</strong> {fmtLinha(sol.linha)}{" "}
                        &nbsp;·&nbsp;
                        <strong>Data:</strong> {fmtDataOs(sol.criadoEm)}
                      </p>
                      <p className="oap-card__relato">
                        <strong>Relato:</strong> {sol.relato}
                      </p>
                    </div>
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
                            <th>Defeito relatado</th>
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
                                <td
                                  className="oap-table__defeito"
                                  title={ord.defeito}
                                >
                                  {ord.defeito}
                                </td>
                                <td className="oap-table__valor">
                                  {fmtBRL(ord.valorTotal)}
                                </td>
                                <td>
                                  <span
                                    className={`oap-ordem ${os.cls}`}
                                  >
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
