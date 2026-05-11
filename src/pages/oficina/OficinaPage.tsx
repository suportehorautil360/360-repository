import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useHU360 } from "../../lib/hu360";
import { useLogin } from "../login/hooks/use-login";
import "./oficina.css";

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
  const [itensOrcamento, setItensOrcamento] = useState<ItemOrcamento[]>(() => [
    novoItemOrcamento(),
  ]);

  useEffect(() => {
    document.body.classList.add("oficina-root");
    return () => {
      document.body.classList.remove("oficina-root");
    };
  }, []);

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
          <div className="card">
            <h3 id="of-h-os">Requisição: {om.osReq}</h3>
            <p>
              <strong>Equipamento:</strong>{" "}
              <span id="of-txt-equip">{om.equipLabel}</span>
            </p>
            <p>
              <strong>Defeito Relatado:</strong>{" "}
              <span id="of-txt-defeito">{om.defeito}</span>
            </p>
            <hr />
            <h4>Lançar Orçamento para esta O.S.</h4>
            <div style={{ display: "grid", gap: 10 }}>
              {itensOrcamento.map((item, idx) => {
                const podeRemover = itensOrcamento.length > 1;
                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 40px",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <input
                      type="text"
                      placeholder={`Descrição da Peça / Serviço${
                        itensOrcamento.length > 1 ? ` (${idx + 1})` : ""
                      }`}
                      value={item.descricao}
                      onChange={(e) =>
                        atualizarItemOrcamento(idx, "descricao", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      placeholder="Valor R$"
                      value={item.valor}
                      onChange={(e) =>
                        atualizarItemOrcamento(idx, "valor", e.target.value)
                      }
                    />
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
                        cursor: podeRemover ? "pointer" : "not-allowed",
                        fontWeight: 700,
                        fontSize: "1.15rem",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
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
            <button
              type="button"
              className="btn btn-orange"
              style={{
                width: "100%",
                marginTop: 20,
                background: "var(--primary-black)",
              }}
            >
              ENVIAR ORÇAMENTO PARA PREFEITURA
            </button>
          </div>
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
