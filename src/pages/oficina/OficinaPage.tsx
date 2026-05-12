import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "@firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import { useHU360 } from "../../lib/hu360";
import { useLogin } from "../login/hooks/use-login";
import "./oficina.css";

function gerarProtocolo(): string {
  const ano = new Date().getFullYear();
  const seq = String(Math.floor(Date.now() / 1000) % 1000).padStart(3, "0");
  return `${ano}-${seq}`;
}

interface SolicitacaoOS {
  id: string;
  protocolo: string;
  prefeituraId: string;
  equipamento: string;
  linha: string;
  operador: string;
  horimetro: string;
  relato: string;
  oficinas: string[];
  oficinasIds?: string[];
  status: string;
  criadoEm: { seconds: number } | null;
}

type OficinaSecao = "novas-os" | "orcamentos" | "checklist-dev" | "faturamento";

interface ItemOrcamento {
  descricao: string;
  valor: string;
}

function novoItemOrcamento(): ItemOrcamento {
  return { descricao: "", valor: "" };
}

export function OficinaPage() {
  const { user, setUser } = useLogin();
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { obterDadosPrefeitura, prefeituraLabel } = useHU360();

  const isAdmin = user?.type === "admin";
  const efetivoPrefeituraId = isAdmin
    ? (paramId ?? "")
    : (user?.prefeituraId ?? "");

  const [secaoAtiva, setSecaoAtiva] = useState<OficinaSecao>("novas-os");
  const [protocolo, setProtocolo] = useState(() => gerarProtocolo());
  const [itensOrcamento, setItensOrcamento] = useState<ItemOrcamento[]>(() => [
    novoItemOrcamento(),
  ]);
  const [osErro, setOsErro] = useState("");
  const [osSaving, setOsSaving] = useState(false);
  const [osSucesso, setOsSucesso] = useState("");

  // Solicitações de O.S. abertas pela prefeitura
  const [osList, setOsList] = useState<SolicitacaoOS[]>([]);
  const [osListLoading, setOsListLoading] = useState(false);
  const [osExpandidaId, setOsExpandidaId] = useState<string | null>(null);

  const loadOsList = useCallback(async () => {
    if (!efetivoPrefeituraId) return;
    setOsListLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "solicitacoesOS"),
          where("prefeituraId", "==", efetivoPrefeituraId),
          where("status", "==", "aguardando_orcamento"),
          orderBy("criadoEm", "desc"),
        ),
      );
      const allDocs = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SolicitacaoOS, "id">),
      }));
      // If the logged-in user has an officinaId, show only O.S. targeting that oficina
      const userOficinaId = user?.officinaId;
      const filtered =
        userOficinaId && !isAdmin
          ? allDocs.filter(
              (os) => !os.oficinasIds || os.oficinasIds.includes(userOficinaId),
            )
          : allDocs;
      setOsList(filtered);
    } catch {
      // silently fail — list stays empty
    } finally {
      setOsListLoading(false);
    }
  }, [efetivoPrefeituraId]);

  useEffect(() => {
    document.body.classList.add("oficina-root");
    return () => {
      document.body.classList.remove("oficina-root");
    };
  }, []);

  useEffect(() => {
    void loadOsList();
  }, [loadOsList]);

  const dados = useMemo(
    () =>
      efetivoPrefeituraId ? obterDadosPrefeitura(efetivoPrefeituraId) : null,
    [efetivoPrefeituraId, obterDadosPrefeitura],
  );

  function navegar(secao: OficinaSecao) {
    setSecaoAtiva(secao);
  }

  function adicionarItemOrcamento() {
    setItensOrcamento((prev) => [...prev, novoItemOrcamento()]);
  }

  function removerItemOrcamento(idx: number) {
    setItensOrcamento((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
    );
  }

  function atualizarItemOrcamento(
    idx: number,
    campo: keyof ItemOrcamento,
    valor: string,
  ) {
    setItensOrcamento((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item)),
    );
  }

  async function handleEnviarOrcamento() {
    setOsErro("");
    setOsSucesso("");

    const osSel = osList.find((o) => o.id === osExpandidaId);

    if (!protocolo.trim()) {
      setOsErro("Informe o protocolo da O.S.");
      return;
    }

    const itensSemDescricao = itensOrcamento.filter(
      (it) => !it.descricao.trim(),
    );
    const itensSemValor = itensOrcamento.filter((it) => !it.valor.trim());

    if (itensSemDescricao.length > 0 || itensSemValor.length > 0) {
      const msgs: string[] = [];
      if (itensSemDescricao.length > 0)
        msgs.push(`${itensSemDescricao.length} item(ns) sem descrição`);
      if (itensSemValor.length > 0)
        msgs.push(`${itensSemValor.length} item(ns) sem valor`);
      setOsErro(`Para salvar, preencha todos os campos: ${msgs.join(" e ")}.`);
      return;
    }

    setOsSaving(true);
    try {
      await addDoc(collection(db, "ordensServico"), {
        protocolo: protocolo.trim(),
        prefeituraId: efetivoPrefeituraId,
        solicitacaoOsId: osExpandidaId ?? null,
        operador: user?.usuario ?? "",
        equipamento: osSel?.equipamento ?? om.equipLabel,
        defeito: osSel?.relato ?? om.defeito,
        itens: itensOrcamento.map((it) => ({
          descricao: it.descricao.trim(),
          valor: parseFloat(it.valor.replace(",", ".")) || 0,
        })),
        valorTotal: itensOrcamento.reduce(
          (acc, it) => acc + (parseFloat(it.valor.replace(",", ".")) || 0),
          0,
        ),
        status: "aguardando_aprovacao",
        criadoEm: serverTimestamp(),
      });
      setOsSucesso(
        `Orçamento enviado com sucesso! Protocolo: ${protocolo.trim()}`,
      );
      setItensOrcamento([novoItemOrcamento()]);
      setProtocolo(gerarProtocolo());
      setOsExpandidaId(null);
    } catch {
      setOsErro("Erro ao enviar orçamento. Tente novamente.");
    } finally {
      setOsSaving(false);
    }
  }

  async function handleLogout() {
    if (isAdmin) {
      navigate("/admin/portal-oficina", { replace: true });
      return;
    }
    setUser({ id: "", usuario: "", type: "oficina" });
    navigate("/login-operacional?destino=oficina", { replace: true });
  }

  if (!user?.id || !dados) {
    return <Navigate to="/login-operacional?destino=oficina" replace />;
  }

  const om = dados.oficinaModulo;
  const labelPref = prefeituraLabel(efetivoPrefeituraId);
  const nomeUsuario = user.usuario;
  const usuarioLogadoTexto = `Conectado: ${nomeUsuario} (·) · ${labelPref}`;

  return (
    <div id="appShell">
      <div id="sidebar">
        <div className="logo-area">
          <h2 style={{ color: "var(--hu360-primary)", margin: 0 }}>
            horautil360
          </h2>
          <small>Portal da oficina</small>
          <p
            id="of-ctx-pref"
            style={{
              margin: "10px 0 0",
              fontSize: "0.75rem",
              color: "var(--main-orange)",
              fontWeight: 600,
            }}
          >
            {labelPref}
          </p>
        </div>
        <div
          className={`nav-item ${secaoAtiva === "novas-os" ? "active" : ""}`}
          onClick={() => navegar("novas-os")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navegar("novas-os");
            }
          }}
        >
          📥 NOVAS O.S. RECEBIDAS
        </div>
        <div
          className={`nav-item ${secaoAtiva === "orcamentos" ? "active" : ""}`}
          onClick={() => navegar("orcamentos")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navegar("orcamentos");
            }
          }}
        >
          📊 MEUS ORÇAMENTOS
        </div>
        <div
          className={`nav-item ${
            secaoAtiva === "checklist-dev" ? "active" : ""
          }`}
          onClick={() => navegar("checklist-dev")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navegar("checklist-dev");
            }
          }}
        >
          📋 CHECKLIST DEVOLUÇÃO
        </div>
        <div
          className={`nav-item ${secaoAtiva === "faturamento" ? "active" : ""}`}
          onClick={() => navegar("faturamento")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navegar("faturamento");
            }
          }}
        >
          💰 NOTA FISCAL / NF-e
        </div>
      </div>

      <div id="main">
        <div className="app-topbar">
          <Link to="/admin/dashboard" className="hub-link">
            ← Hub Mestre
          </Link>
          <div className="app-topbar-actions">
            <span id="usuarioLogado">{usuarioLogadoTexto}</span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                width: "auto",
                margin: 0,
                padding: "10px 16px",
                textTransform: "none",
              }}
              onClick={handleLogout}
            >
              Sair
            </button>
          </div>
        </div>
        <p
          style={{
            fontSize: "0.85rem",
            color: "#555",
            margin: "0 0 18px",
            lineHeight: 1.4,
          }}
        >
          Para <strong>cadastrar ou remover</strong> usuários (prefeitura,
          oficina ou posto), use o Hub:{" "}
          <strong>Controle → Acessos e logins</strong>.
        </p>

        <div
          id="novas-os"
          className={`tab-content ${secaoAtiva === "novas-os" ? "active" : ""}`}
        >
          <h1>O.S. recebidas da prefeitura</h1>
          <p
            style={{
              color: "#555",
              fontSize: "0.95rem",
              maxWidth: 820,
              lineHeight: 1.5,
            }}
          >
            A prefeitura pode disparar a mesma demanda para{" "}
            <strong>três oficinas credenciadas</strong> para classificação do
            equipamento e cotação. Aqui você lança seu orçamento; na prefeitura
            o gestor compara as três propostas e aprova uma.
          </p>

          {/* Lista de O.S. abertas pela prefeitura */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: "auto", padding: "8px 16px", margin: 0 }}
              onClick={() => {
                void loadOsList();
              }}
              disabled={osListLoading}
            >
              {osListLoading ? "Carregando..." : "↻ Recarregar"}
            </button>
            <span style={{ fontSize: "0.85rem", color: "#888" }}>
              {osList.length} O.S. aguardando orçamento
            </span>
          </div>

          {osListLoading ? (
            <p style={{ color: "#888" }}>Buscando ordens de serviço...</p>
          ) : osList.length === 0 ? (
            <div
              className="card"
              style={{ color: "#888", textAlign: "center", padding: 32 }}
            >
              Nenhuma O.S. aguardando orçamento no momento.
            </div>
          ) : (
            osList.map((os) => {
              const isExpanded = osExpandidaId === os.id;
              const dataStr = os.criadoEm
                ? new Date(os.criadoEm.seconds * 1000).toLocaleDateString(
                    "pt-BR",
                  )
                : "—";
              return (
                <div
                  key={os.id}
                  className="card"
                  style={{
                    marginBottom: 16,
                    borderLeftColor: isExpanded
                      ? "var(--main-orange)"
                      : undefined,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div>
                      <h3 style={{ margin: "0 0 6px" }}>
                        {os.protocolo}
                        <span
                          style={{
                            marginLeft: 10,
                            fontSize: "0.75rem",
                            fontWeight: 400,
                            background: "#fef3c7",
                            color: "#92400e",
                            padding: "2px 8px",
                            borderRadius: 4,
                          }}
                        >
                          AGUARDANDO ORÇAMENTO
                        </span>
                      </h3>
                      <p style={{ margin: "2px 0", fontSize: "0.9rem" }}>
                        <strong>Equipamento:</strong> {os.equipamento}
                      </p>
                      <p style={{ margin: "2px 0", fontSize: "0.9rem" }}>
                        <strong>Linha:</strong> {os.linha} &nbsp;·&nbsp;{" "}
                        <strong>Operador:</strong> {os.operador} &nbsp;·&nbsp;{" "}
                        <strong>Data:</strong> {dataStr}
                      </p>
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: "0.88rem",
                          color: "#555",
                        }}
                      >
                        <strong>Relato:</strong> {os.relato}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-orange"
                      style={{ width: "auto", padding: "10px 18px", margin: 0 }}
                      onClick={() => {
                        if (isExpanded) {
                          setOsExpandidaId(null);
                        } else {
                          setOsExpandidaId(os.id);
                          setProtocolo(gerarProtocolo());
                          setItensOrcamento([novoItemOrcamento()]);
                          setOsErro("");
                          setOsSucesso("");
                        }
                      }}
                    >
                      {isExpanded ? "Fechar" : "Responder com Orçamento"}
                    </button>
                  </div>

                  {isExpanded ? (
                    <div
                      style={{
                        marginTop: 20,
                        borderTop: "1px solid #e5e7eb",
                        paddingTop: 16,
                      }}
                    >
                      <h4 style={{ marginTop: 0 }}>
                        Lançar Orçamento — {os.protocolo}
                      </h4>
                      <div style={{ marginBottom: 16 }}>
                        <label
                          htmlFor="of-protocolo"
                          style={{
                            display: "block",
                            marginBottom: 4,
                            fontWeight: 600,
                          }}
                        >
                          Protocolo do Orçamento
                        </label>
                        <input
                          id="of-protocolo"
                          type="text"
                          value={protocolo}
                          onChange={(e) => setProtocolo(e.target.value)}
                          placeholder="Ex: 2026-048"
                          style={{ maxWidth: 200 }}
                        />
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: "0.8rem",
                            color: "#888",
                          }}
                        >
                          Formato: AAAA-NNN. Gerado automaticamente, mas pode
                          ser editado.
                        </p>
                      </div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {itensOrcamento.map((item, idx) => {
                          const podeRemover = itensOrcamento.length > 1;
                          const semDescricao =
                            !!osErro && !item.descricao.trim();
                          const semValor = !!osErro && !item.valor.trim();
                          return (
                            <div key={idx} style={{ display: "grid", gap: 4 }}>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "2fr 1fr 40px",
                                  gap: 12,
                                  alignItems: "flex-start",
                                }}
                              >
                                <div>
                                  <input
                                    type="text"
                                    placeholder={`Descrição da Peça / Serviço${
                                      itensOrcamento.length > 1
                                        ? ` (${idx + 1})`
                                        : ""
                                    }`}
                                    value={item.descricao}
                                    style={
                                      semDescricao
                                        ? { borderColor: "#dc2626" }
                                        : undefined
                                    }
                                    onChange={(e) => {
                                      atualizarItemOrcamento(
                                        idx,
                                        "descricao",
                                        e.target.value,
                                      );
                                      setOsErro("");
                                    }}
                                  />
                                  {semDescricao ? (
                                    <span
                                      style={{
                                        color: "#dc2626",
                                        fontSize: "0.78rem",
                                      }}
                                    >
                                      Descrição obrigatória
                                    </span>
                                  ) : null}
                                </div>
                                <div>
                                  <input
                                    type="number"
                                    placeholder="Valor R$"
                                    value={item.valor}
                                    style={
                                      semValor
                                        ? { borderColor: "#dc2626" }
                                        : undefined
                                    }
                                    onChange={(e) => {
                                      atualizarItemOrcamento(
                                        idx,
                                        "valor",
                                        e.target.value,
                                      );
                                      setOsErro("");
                                    }}
                                  />
                                  {semValor ? (
                                    <span
                                      style={{
                                        color: "#dc2626",
                                        fontSize: "0.78rem",
                                      }}
                                    >
                                      Valor obrigatório
                                    </span>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removerItemOrcamento(idx)}
                                  disabled={!podeRemover}
                                  aria-label="Remover item"
                                  title={
                                    podeRemover
                                      ? "Remover item"
                                      : "É necessário ao menos 1 item"
                                  }
                                  style={{
                                    marginTop: 6,
                                    padding: "10px 0",
                                    background: "transparent",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 5,
                                    color: podeRemover ? "#dc2626" : "#cbd5e1",
                                    cursor: podeRemover
                                      ? "pointer"
                                      : "not-allowed",
                                    fontWeight: 700,
                                    fontSize: "1.15rem",
                                    lineHeight: 1,
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        className="btn btn-orange"
                        style={{ marginTop: 15 }}
                        onClick={adicionarItemOrcamento}
                      >
                        ADICIONAR ITEM
                      </button>
                      {osErro ? (
                        <p
                          style={{
                            color: "#dc2626",
                            fontWeight: 600,
                            marginTop: 14,
                            fontSize: "0.9rem",
                            border: "1px solid #fca5a5",
                            background: "#fef2f2",
                            padding: "10px 14px",
                            borderRadius: 6,
                          }}
                        >
                          {osErro}
                        </p>
                      ) : null}
                      {osSucesso ? (
                        <p
                          style={{
                            color: "#15803d",
                            fontWeight: 600,
                            marginTop: 14,
                            fontSize: "0.9rem",
                            border: "1px solid #86efac",
                            background: "#f0fdf4",
                            padding: "10px 14px",
                            borderRadius: 6,
                          }}
                        >
                          {osSucesso}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-orange"
                        style={{
                          width: "100%",
                          marginTop: 20,
                          background: "var(--primary-black)",
                          opacity: osSaving ? 0.7 : 1,
                          cursor: osSaving ? "not-allowed" : "pointer",
                        }}
                        onClick={() => {
                          void handleEnviarOrcamento();
                        }}
                        disabled={osSaving}
                      >
                        {osSaving
                          ? "ENVIANDO..."
                          : "ENVIAR ORÇAMENTO PARA PREFEITURA"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div
          id="orcamentos"
          className={`tab-content ${secaoAtiva === "orcamentos" ? "active" : ""}`}
        >
          <h1>Acompanhamento de Propostas</h1>
          <div className="card" style={{ borderLeftColor: "var(--warning)" }}>
            <h3>
              <span id="of-orc-titulo-os">O.S. {om.osReq}</span> -{" "}
              <span className="status-badge bg-waiting">
                AGUARDANDO APROVAÇÃO
              </span>
            </h3>
            <p>
              Seu Orçamento:{" "}
              <strong id="of-orc-valor">{om.orcamentoValor}</strong>
            </p>
            <hr />
            <h4 style={{ color: "var(--main-orange)" }}>
              Comparativo de Mercado (Transparência Pública)
            </h4>
            <table>
              <thead>
                <tr>
                  <th>Orçamento</th>
                  <th>Valor da Proposta</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="of-tbody-comp">
                {om.comparativo.map((row, i) => {
                  const label = `Orçamento ${i + 1}`;
                  return (
                    <tr
                      key={`${row.concorrente}-${i}`}
                      style={
                        row.destaque ? { background: "#fff7ed" } : undefined
                      }
                    >
                      <td>{row.destaque ? <b>{label}</b> : label}</td>
                      <td>{row.destaque ? <b>{row.valor}</b> : row.valor}</td>
                      <td>{row.destaque ? <b>{row.status}</b> : row.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div
          id="checklist-dev"
          className={`tab-content ${
            secaoAtiva === "checklist-dev" ? "active" : ""
          }`}
        >
          <h1>Checklist de Entrega do Equipamento</h1>
          <div className="card">
            <h3 id="of-check-equip">Equipamento: {om.checklistTitulo}</h3>
            <label htmlFor="of-check-relatorio">
              Relatório do Serviço Realizado
            </label>
            <textarea
              id="of-check-relatorio"
              placeholder="Descreva tudo que foi feito detalhadamente..."
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
                marginTop: 20,
              }}
            >
              <div>
                <label htmlFor="of-check-foto-nova">
                  📸 Foto Peça Nova Instalada
                </label>
                <input id="of-check-foto-nova" type="file" accept="image/*" />
              </div>
              <div>
                <label htmlFor="of-check-foto-velha">
                  📸 Foto Peça Velha Substituída
                </label>
                <input id="of-check-foto-velha" type="file" accept="image/*" />
              </div>
              <div>
                <label htmlFor="of-check-foto-pronto">
                  📸 Foto do Equipamento Pronto
                </label>
                <input id="of-check-foto-pronto" type="file" accept="image/*" />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-orange"
              style={{ width: "100%", marginTop: 30 }}
            >
              FINALIZAR SERVIÇO E NOTIFICAR BANCO DE DADOS
            </button>
          </div>
        </div>

        <div
          id="faturamento"
          className={`tab-content ${
            secaoAtiva === "faturamento" ? "active" : ""
          }`}
        >
          <h1>Anexar Nota Fiscal para Pagamento</h1>
          <div className="card">
            <h3 id="of-nf-titulo">O.S. {om.osReq} - Serviço Concluído</h3>
            <p>
              Valor a Faturar:
              <strong id="of-nf-valor">{om.orcamentoValor}</strong>
            </p>
            <label htmlFor="of-nf-input">Número da Nota Fiscal (NF-e)</label>
            <input
              id="of-nf-input"
              type="text"
              placeholder={om.nfPlaceholder}
            />
            <label htmlFor="of-nf-arquivo">
              Anexar Arquivo da Nota (PDF / XML)
            </label>
            <input id="of-nf-arquivo" type="file" />
            <button
              type="button"
              className="btn btn-orange"
              style={{ width: "100%", marginTop: 20 }}
            >
              Enviar nota para horautil360
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
