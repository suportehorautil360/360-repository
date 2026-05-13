import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "@firebase/firestore";
import { db } from "../../../lib/firebase/firebase";

interface OrcamentosSectionProps {
  prefeituraId: string;
}

interface SolicitacaoOS {
  id: string;
  protocolo: string;
  equipamento: string;
  linha: string;
  operador: string;
  relato: string;
  oficinas: string[];
  oficinasIds?: string[];
  oficinasResponderam?: string[];
  status: string;
  criadoEm: { seconds: number } | null;
}

interface ItemOrdem {
  descricao: string;
  valor: number;
}

interface OrdemServico {
  id: string;
  protocolo: string;
  solicitacaoOsId: string;
  operador: string;
  oficinaNome?: string;
  oficinaId?: string;
  equipamento: string;
  defeito: string;
  itens: ItemOrdem[];
  valorTotal: number;
  status: string;
  criadoEm: { seconds: number } | null;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusLabel(status: string) {
  if (status === "aguardando_orcamento")
    return { text: "Aguardando orçamento", color: "#92400e", bg: "#fef3c7" };
  if (status === "aguardando_aprovacao")
    return { text: "Aguardando aprovação", color: "#1e40af", bg: "#dbeafe" };
  if (status === "aprovado")
    return { text: "Aprovado", color: "#15803d", bg: "#dcfce7" };
  if (status === "recusado")
    return { text: "Recusado", color: "#dc2626", bg: "#fee2e2" };
  return { text: status, color: "#555", bg: "#f3f4f6" };
}

export function OrcamentosSection({ prefeituraId }: OrcamentosSectionProps) {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoOS[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(false);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [aprovando, setAprovando] = useState<string | null>(null);
  const [msgAcao, setMsgAcao] = useState<{
    id: string;
    text: string;
    ok: boolean;
  } | null>(null);

  // Modal de detalhes do orçamento
  const [modalOrdem, setModalOrdem] = useState<OrdemServico | null>(null);

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setLoading(true);
    setErroCarregar(null);
    try {
      // 1. Busca todas as solicitações do município
      const snapSol = await getDocs(
        query(
          collection(db, "solicitacoesOS"),
          where("prefeituraId", "==", prefeituraId),
        ),
      );

      const sols = snapSol.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<SolicitacaoOS, "id">) }))
        .sort(
          (a, b) => (b.criadoEm?.seconds ?? 0) - (a.criadoEm?.seconds ?? 0),
        );
      setSolicitacoes(sols);

      // 2. Busca ordensServico pelo solicitacaoOsId (relacionamento direto)
      if (sols.length === 0) {
        setOrdens([]);
        return;
      }

      const ids = sols.map((s) => s.id);
      // Firestore "in" suporta até 30 valores por chamada
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 30) {
        chunks.push(ids.slice(i, i + 30));
      }

      const ordensAll: OrdemServico[] = [];
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
              ...(d.data() as Omit<OrdemServico, "id">),
            });
          });
        }),
      );
      setOrdens(ordensAll);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[OrcamentosSection] erro ao carregar:", msg, err);
      setErroCarregar(msg);
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
      const batch = writeBatch(db);

      // Aprovar a ordem selecionada
      batch.update(doc(db, "ordensServico", ordemId), { status: "aprovado" });

      // Recusar as demais ordens da mesma solicitação
      ordens
        .filter(
          (o) =>
            o.solicitacaoOsId === solicitacaoId &&
            o.id !== ordemId &&
            o.status === "aguardando_aprovacao",
        )
        .forEach((o) => {
          batch.update(doc(db, "ordensServico", o.id), { status: "recusado" });
        });

      // Atualizar a solicitação para aprovado
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

  // Mostra todas as OS abertas (incluindo as que ainda aguardam orçamento)
  const solicitacoesVisiveis = solicitacoes;

  return (
    <>
      <h1>Orçamentos &amp; Aprovação</h1>
      <p
        style={{
          color: "var(--text-gray)",
          marginBottom: 16,
          maxWidth: 820,
          lineHeight: 1.5,
        }}
      >
        Cada O.S. pode receber orçamentos de até 3 oficinas credenciadas.
        Compare os valores e aprove o melhor — as demais propostas serão
        recusadas automaticamente.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: "auto", padding: "8px 16px", margin: 0 }}
          onClick={() => {
            void carregar();
          }}
          disabled={loading}
        >
          {loading ? "Carregando..." : "↻ Recarregar"}
        </button>
        <span
          style={{ fontSize: "0.85rem", color: "#888", alignSelf: "center" }}
        >
          {solicitacoesVisiveis.length} O.S. abertas
        </span>
      </div>

      {erroCarregar ? (
        <div
          className="card"
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#dc2626",
            padding: 16,
            marginBottom: 16,
            fontSize: "0.88rem",
          }}
        >
          <strong>Erro ao carregar dados:</strong> {erroCarregar}
          <br />
          <small style={{ color: "#555" }}>
            prefeituraId recebido: <code>{prefeituraId || "(vazio)"}</code>
          </small>
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "#888" }}>Buscando dados...</p>
      ) : solicitacoesVisiveis.length === 0 ? (
        <div
          className="card"
          style={{ color: "#888", textAlign: "center", padding: 32 }}
        >
          Nenhuma O.S. aberta no momento.
        </div>
      ) : (
        solicitacoesVisiveis.map((sol) => {
          const ordensDoOS = ordens.filter((o) => o.solicitacaoOsId === sol.id);
          const sl = statusLabel(sol.status);
          const dataStr = sol.criadoEm
            ? new Date(sol.criadoEm.seconds * 1000).toLocaleDateString("pt-BR")
            : "—";
          const msgAtual = msgAcao?.id === sol.id ? msgAcao : null;
          const totalConvidadas =
            sol.oficinasIds?.length ?? sol.oficinas?.length ?? 0;
          const temOrcamento = ordensDoOS.some(
            (o) => o.status === "aguardando_aprovacao",
          );

          return (
            <div key={sol.id} className="card" style={{ marginBottom: 20 }}>
              {/* Cabeçalho da OS */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 4px" }}>
                    {sol.protocolo}
                    <span
                      style={{
                        marginLeft: 10,
                        fontSize: "0.75rem",
                        fontWeight: 400,
                        background: sl.bg,
                        color: sl.color,
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      {sl.text.toUpperCase()}
                    </span>
                  </h3>
                  <p style={{ margin: "2px 0", fontSize: "0.88rem" }}>
                    <strong>Equipamento:</strong> {sol.equipamento}{" "}
                    &nbsp;·&nbsp;
                    <strong>Linha:</strong> {sol.linha} &nbsp;·&nbsp;
                    <strong>Data:</strong> {dataStr}
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "0.85rem",
                      color: "#555",
                    }}
                  >
                    <strong>Relato:</strong> {sol.relato}
                  </p>
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#888",
                    textAlign: "right",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: temOrcamento ? "#15803d" : "#92400e",
                    }}
                  >
                    {ordensDoOS.length}/
                    {totalConvidadas > 0 ? totalConvidadas : 3} orçamento(s)
                    recebido(s)
                  </span>
                  {temOrcamento && sol.status !== "aprovado" ? (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#15803d",
                        marginTop: 2,
                      }}
                    >
                      ✔ Pronto para aprovar
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Mensagem de feedback */}
              {msgAtual ? (
                <p
                  style={{
                    marginBottom: 12,
                    padding: "10px 14px",
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    background: msgAtual.ok ? "#f0fdf4" : "#fef2f2",
                    color: msgAtual.ok ? "#15803d" : "#dc2626",
                    border: `1px solid ${msgAtual.ok ? "#86efac" : "#fca5a5"}`,
                  }}
                >
                  {msgAtual.text}
                </p>
              ) : null}

              {/* Tabela de orçamentos */}
              {ordensDoOS.length === 0 ? (
                <p style={{ color: "#888", fontSize: "0.88rem" }}>
                  Nenhum orçamento enviado ainda.
                </p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Protocolo</th>
                        <th>Operador (oficina)</th>
                        <th>Defeito relatado</th>
                        <th style={{ textAlign: "right" }}>Valor Total</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordensDoOS.map((ord) => {
                        const os = statusLabel(ord.status);
                        const isAprovando = aprovando === ord.id;
                        const podeAprovar =
                          ord.status === "aguardando_aprovacao" &&
                          sol.status !== "aprovado";
                        return (
                          <tr key={ord.id}>
                            <td>
                              <strong>{ord.protocolo}</strong>
                            </td>
                            <td>{ord.oficinaNome ?? ord.operador}</td>
                            <td style={{ maxWidth: 260, fontSize: "0.85rem" }}>
                              {ord.defeito}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 700 }}>
                              {fmtBRL(ord.valorTotal)}
                            </td>
                            <td>
                              <span
                                style={{
                                  background: os.bg,
                                  color: os.color,
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  fontSize: "0.78rem",
                                  fontWeight: 600,
                                }}
                              >
                                {os.text}
                              </span>
                            </td>
                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  flexWrap: "wrap",
                                }}
                              >
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  style={{
                                    margin: 0,
                                    padding: "5px 10px",
                                    fontSize: "0.78rem",
                                    width: "auto",
                                  }}
                                  onClick={() => setModalOrdem(ord)}
                                >
                                  Ver itens
                                </button>
                                {podeAprovar ? (
                                  <button
                                    type="button"
                                    className="btn btn-success"
                                    style={{
                                      margin: 0,
                                      padding: "5px 10px",
                                      fontSize: "0.78rem",
                                      width: "auto",
                                      opacity: isAprovando ? 0.7 : 1,
                                      cursor: isAprovando
                                        ? "not-allowed"
                                        : "pointer",
                                    }}
                                    disabled={isAprovando || aprovando !== null}
                                    onClick={() => {
                                      void handleAprovar(ord.id, sol.id);
                                    }}
                                  >
                                    {isAprovando ? "Aprovando..." : "✓ Aprovar"}
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
            </div>
          );
        })
      )}

      {/* Modal de itens do orçamento */}
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
            <p
              style={{
                fontSize: "0.88rem",
                color: "#555",
                margin: "8px 0 14px",
              }}
            >
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
                {modalOrdem.itens.map((it, i) => (
                  <tr key={i}>
                    <td>{it.descricao}</td>
                    <td style={{ textAlign: "right" }}>{fmtBRL(it.valor)}</td>
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
    </>
  );
}
