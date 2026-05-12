import {
  type FormEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ListaChecklistHistoricoLocal } from "../../components/checklistHistorico/ChecklistHistoricoLista";
import { checklistAppToHistoricoRow } from "../../components/checklistHistorico/checklistAppToHistoricoRow";
import {
  type ChecklistApiRow,
  criarDadosDemo,
  type ChecklistApp,
  sincronizarLocacaoComFirestore,
  useEmpresasTerceirasLocacao,
  useEquipamentosCadastro,
  useHU360,
  useHU360Auth,
} from "../../lib/hu360";
import { locDesenharDashboardGraficos } from "./locacaoCharts";
import { mergePrefeituraModuloLocacao } from "./locacaoMerge";
import {
  limparLocacaoPrefCtxHub,
  locPrefeituraIdParaUi,
} from "./locacaoPrefCtx";
import "./locacao.css";
import { useLogin } from "../login/hooks/use-login";

type LocacaoSecao = "dash" | "auditoria" | "riscos" | "equipamentos" | "terceiros";

const COR_INFO = "#78716c";
const COR_ERRO = "#dc2626";

interface AuthMsg {
  texto: string;
  cor: string;
}

const AUTH_MSG_LIMPA: AuthMsg = { texto: "", cor: COR_INFO };

function checklistQrSintetico(row: ChecklistApiRow): ChecklistApp {
  const oleoOk = String(row.status_oleo || "").toLowerCase() === "ok";
  const filtOk = String(row.status_filtros || "").toLowerCase() === "ok";
  return {
    protocolo: `CHK-QR-${row.id}`,
    referenciaOs: "Inspeção registrada via QR",
    sincronizadoEm: row.criado_em,
    versaoApp: "horautil360",
    horimetroCampo: "—",
    secoes: [
      {
        titulo: "Campos da inspeção",
        itens: [
          { item: "Chassis (QR)", resposta: row.chassis_qr, conforme: true },
          {
            item: "Óleo",
            resposta: row.status_oleo,
            conforme: oleoOk,
          },
          {
            item: "Filtros",
            resposta: row.status_filtros,
            conforme: filtOk,
          },
        ],
      },
    ],
    observacoesCampo: row.observacoes || "",
    fotosResumo: "",
    assinaturaDigital: `Registro ID ${row.id} · horautil360`,
  };
}

export function LocacaoPage() {
  const { login, logout } = useHU360Auth();
  const { user, setUser } = useLogin();
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { obterDadosPrefeitura, prefeituraLabel, prefeituras } = useHU360();
  const [prefCtxGen, setPrefCtxGen] = useState(0);
  const bumpPrefCtx = () => setPrefCtxGen((g) => g + 1);
  const prevUsuarioRef = useRef<string | undefined>(undefined);
  const canvasChRef = useRef<HTMLCanvasElement>(null);
  const canvasOpRef = useRef<HTMLCanvasElement>(null);

  const isAdmin = user?.type === "admin";

  useEffect(() => {
    if (!user?.usuario) {
      prevUsuarioRef.current = undefined;
      return;
    }
    if (prevUsuarioRef.current && prevUsuarioRef.current !== user.usuario) {
      limparLocacaoPrefCtxHub();
      bumpPrefCtx();
    }
    prevUsuarioRef.current = user.usuario;
  }, [user?.usuario]);

  const prefeituraIdEff = useMemo(() => {
    if (!user) return null;
    if (isAdmin && paramId) return paramId;
    return locPrefeituraIdParaUi(user, prefeituras);
  }, [user, prefeituras, prefCtxGen, isAdmin, paramId]);

  const dados = useMemo(
    () => (prefeituraIdEff ? obterDadosPrefeitura(prefeituraIdEff) : null),
    [prefeituraIdEff, obterDadosPrefeitura],
  );

  const pmMerged = useMemo(() => {
    if (!prefeituraIdEff) return null;
    return mergePrefeituraModuloLocacao(
      prefeituraIdEff,
      obterDadosPrefeitura,
      criarDadosDemo,
    );
  }, [prefeituraIdEff, obterDadosPrefeitura]);

  const checklistsCampo = useMemo(
    () => dados?.prefeituraModulo?.checklistsCampo ?? [],
    [dados],
  );

  console.log("Dados prefeitura locação:", user);

  const audBase = useMemo(
    () =>
      prefeituraIdEff ? (criarDadosDemo(prefeituraIdEff).auditoria ?? []) : [],
    [prefeituraIdEff],
  );
  const audLista = dados?.auditoria?.length ? dados.auditoria : audBase;

  const auditoriaHistoricoRows = useMemo(() => {
    const out: Record<string, unknown>[] = [];
    audLista.forEach((row, idx) => {
      const merged = { ...audBase[idx], ...row };
      const c = merged.checklistApp;
      if (!c) return;
      const id = `loc-aud-app-${idx}`;
      const statusResumo = `${merged.indice} · ${merged.fotos} fotos${merged.alerta ? " · alerta" : ""}`;
      out.push(
        checklistAppToHistoricoRow(id, c, {
          dataHora: merged.hora,
          operador: merged.operador,
          equipamento: merged.equipamento,
          chassis: merged.chassis?.trim() || undefined,
          statusResumo,
        }),
      );
    });
    checklistsCampo.forEach((r) => {
      const c = checklistQrSintetico(r);
      const oleo = String(r.status_oleo || "").toLowerCase();
      const filt = String(r.status_filtros || "").toLowerCase();
      const alerta = oleo === "critico" || filt === "critico";
      const indice = alerta
        ? "Crítico"
        : oleo === "ok" && filt === "ok"
          ? "Alto"
          : "Médio";
      const id = `loc-aud-qr-${r.id}`;
      out.push(
        checklistAppToHistoricoRow(id, c, {
          dataHora: r.criado_em,
          operador: "QR / campo",
          equipamento: r.chassis_qr || "—",
          chassis: r.chassis_qr || "—",
          statusResumo: `${indice} · inspeção servidor`,
        }),
      );
    });
    out.sort((a, b) =>
      String(b.Data_Hora ?? "").localeCompare(String(a.Data_Hora ?? ""), undefined, {
        numeric: true,
      }),
    );
    return out;
  }, [audLista, audBase, checklistsCampo]);

  const rBase = useMemo(
    () =>
      prefeituraIdEff ? (criarDadosDemo(prefeituraIdEff).riscos ?? []) : [],
    [prefeituraIdEff],
  );
  const rList =
    dados?.riscos?.length && dados.riscos.length > 0 ? dados.riscos : rBase;

  const [locModuloRefresh, setLocModuloRefresh] = useState(0);
  const [syncLocacaoLoading, setSyncLocacaoLoading] = useState(false);
  const [syncLocacaoMsg, setSyncLocacaoMsg] = useState<string | null>(null);

  const equip = useEquipamentosCadastro(prefeituraIdEff ?? undefined, locModuloRefresh);
  const terceiras = useEmpresasTerceirasLocacao(prefeituraIdEff ?? undefined, locModuloRefresh);

  const empresaLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of terceiras.lista) {
      m.set(e.id, e.nome);
    }
    return m;
  }, [terceiras.lista]);

  // Estado de login
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [authMsg, setAuthMsg] = useState<AuthMsg>({ texto: "", cor: COR_INFO });

  // Navegação
  const [secaoAtiva, setSecaoAtiva] = useState<LocacaoSecao>("dash");

  const [auditoriaExpandidoId, setAuditoriaExpandidoId] = useState<string | null>(null);

  const [tercNome, setTercNome] = useState("");
  const [tercCnpj, setTercCnpj] = useState("");
  const [tercContato, setTercContato] = useState("");
  const [tercObs, setTercObs] = useState("");
  const [tercMsg, setTercMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    document.body.classList.add("locacao-root");
    return () => {
      document.body.classList.remove("locacao-root");
    };
  }, []);

  useLayoutEffect(() => {
    if (secaoAtiva !== "dash" || !pmMerged?.dashboardGraficos) return;
    const id = requestAnimationFrame(() => {
      locDesenharDashboardGraficos(
        canvasChRef.current,
        canvasOpRef.current,
        pmMerged.dashboardGraficos,
      );
    });
    return () => cancelAnimationFrame(id);
  }, [secaoAtiva, pmMerged, prefeituraIdEff]);

  useEffect(() => {
    if (secaoAtiva !== "dash") return;
    const ro = new ResizeObserver(() => {
      if (pmMerged?.dashboardGraficos) {
        locDesenharDashboardGraficos(
          canvasChRef.current,
          canvasOpRef.current,
          pmMerged.dashboardGraficos,
        );
      }
    });
    const el1 = canvasChRef.current?.parentElement;
    const el2 = canvasOpRef.current?.parentElement;
    if (el1) ro.observe(el1);
    if (el2 && el2 !== el1) ro.observe(el2);
    return () => ro.disconnect();
  }, [secaoAtiva, pmMerged]);

  function navegar(secao: LocacaoSecao) {
    setSecaoAtiva(secao);
  }

  useEffect(() => {
    if (secaoAtiva !== "auditoria") setAuditoriaExpandidoId(null);
  }, [secaoAtiva]);

  function abrirChecklistCard() {
    setSecaoAtiva("auditoria");
  }

  async function handleLogout() {
    limparLocacaoPrefCtxHub();
    bumpPrefCtx();
    if (isAdmin) {
      navigate("/admin/portal-locacao", { replace: true });
      return;
    }
    await logout();
    setUser({ id: "", usuario: "", type: "locacao" });
    navigate("/login-operacional?destino=locacao", { replace: true });
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthMsg({ texto: "Autenticando...", cor: COR_INFO });
    const res = await login(usuario.trim(), senha);
    if (!res.ok) {
      setAuthMsg({
        texto: res.msg ?? "Login ou senha inválidos.",
        cor: COR_ERRO,
      });
      return;
    }
    setAuthMsg(AUTH_MSG_LIMPA);
    setSenha("");
    bumpPrefCtx();
  }

  function limparCtxHubModulo() {
    limparLocacaoPrefCtxHub();
    bumpPrefCtx();
  }

  function handleCadastroEmpresaTerceira(e: FormEvent) {
    e.preventDefault();
    setTercMsg(null);
    const r = terceiras.adicionar({
      nome: tercNome,
      cnpj: tercCnpj,
      contato: tercContato,
      observacoes: tercObs,
    });
    setTercMsg({ tone: r.ok ? "ok" : "err", text: r.msg });
    if (r.ok) {
      setTercNome("");
      setTercCnpj("");
      setTercContato("");
      setTercObs("");
    }
  }

  function handleRemoverEmpresaTerceira(id: string) {
    if (
      !window.confirm(
        "Remover esta empresa? Os equipamentos direcionados a ela voltarão para «Locadora».",
      )
    ) {
      return;
    }
    equip.limparReferenciasEmpresa(id);
    terceiras.remover(id);
  }

  async function handleSincronizarLocacaoFirestore() {
    if (!prefeituraIdEff) return;
    setSyncLocacaoLoading(true);
    setSyncLocacaoMsg(null);
    const r = await sincronizarLocacaoComFirestore(prefeituraIdEff);
    setSyncLocacaoLoading(false);
    setSyncLocacaoMsg(r.msg);
    if (r.ok) setLocModuloRefresh((x) => x + 1);
  }

  if (!user || !dados) {
    return <Navigate to="/login-operacional?destino=locacao" replace />;
  }

  const labelPrefLogin = prefeituraLabel(user.prefeituraId);
  const labelEff = prefeituraIdEff
    ? prefeituraLabel(prefeituraIdEff)
    : labelPrefLogin;
  const nomeUsuario = user.nome || user.usuario;
  const usuarioLogadoTexto = `Conectado: ${nomeUsuario} (${user.perfil || "—"}) · ${labelPrefLogin}`;
  const mostrarBannerCtx =
    !!prefeituraIdEff && prefeituraIdEff !== user.prefeituraId;

  const h = dados.hubDashboard;
  const ccDash = checklistsCampo;
  const totalChecklists = (Number(h.checklists) || 0) + ccDash.length;

  return (
    <>
      <div id="appShell">
        <div id="sidebar">
          <div className="logo">
            <h2 style={{ margin: 0, color: "var(--main-orange)" }}>
              horautil360
            </h2>
            <p
              id="locCtxNome"
              style={{
                fontSize: "0.75rem",
                color: "var(--main-orange)",
                marginTop: 8,
                fontWeight: 600,
              }}
            >
              {labelEff} · Locação
            </p>
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--text-gray)",
                marginTop: 4,
              }}
            >
              Gestão da frota em locação
            </p>
          </div>

          {(
            [
              { id: "dash", label: "📊 Dashboard geral" },
              { id: "auditoria", label: "📋 Auditoria de checklists" },
              { id: "riscos", label: "⚠️ Triagem de risco" },
              { id: "equipamentos", label: "🛠️ Equipamentos" },
              { id: "terceiros", label: "🏢 Empresas terceiras" },
            ] as Array<{ id: LocacaoSecao; label: string }>
          ).map((it) => (
            <div
              key={it.id}
              className={`nav-item ${secaoAtiva === it.id ? "active" : ""}`}
              onClick={() => navegar(it.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navegar(it.id);
                }
              }}
            >
              {it.label}
            </div>
          ))}
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
                className="btn btn-outline loc-btn-sair"
                style={{
                  width: "auto",
                  margin: 0,
                  padding: "10px 16px",
                }}
                onClick={handleLogout}
              >
                Sair
              </button>
            </div>
          </div>
          <div
            id="loc-banner-hub-ctx"
            className={`loc-hub-ctx-banner ${mostrarBannerCtx ? "" : "hidden"}`}
            role="status"
          >
            {mostrarBannerCtx ? (
              <>
                <span style={{ flex: 1 }}>
                  Você está visualizando a base <strong>{labelEff}</strong>{" "}
                  (mesmos dados da prefeitura de referência).
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{
                    width: "auto",
                    margin: 0,
                    padding: "8px 14px",
                    textTransform: "none",
                    fontSize: "0.82rem",
                  }}
                  onClick={limparCtxHubModulo}
                >
                  Usar base do meu login
                </button>
              </>
            ) : null}
          </div>

          <div
            id="dash"
            className={`tab-content ${secaoAtiva === "dash" ? "active" : ""}`}
          >
            <h1>Dashboard geral</h1>
            <p className="loc-intro">
              Indicadores da <strong>sua base de frota</strong> (equipamentos
              sob gestão de locação) e inspeções recebidas. Os gráficos usam o
              mesmo conjunto de dados do módulo municipal, com textos adaptados
              para operação de locação.
            </p>
            <div className="card-grid">
              <div className="card">
                <h3>Equipamentos na base</h3>
                <p id="loc-d-ativos">{h.ativos} und.</p>
              </div>
              <div
                className="card card-clickable"
                onClick={abrirChecklistCard}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    abrirChecklistCard();
                  }
                }}
              >
                <h3>Checklists / inspeções (período)</h3>
                <p id="loc-d-checklists">{totalChecklists}</p>
              </div>
              <div className="card">
                <h3>Em manutenção</h3>
                <p id="loc-d-manut">{String(h.manutencao).padStart(2, "0")}</p>
              </div>
            </div>
            <p
              id="loc-dash-graficos-periodo"
              className="loc-intro"
              style={{ marginTop: 0 }}
            >
              {pmMerged?.dashboardGraficos?.tituloPeriodo ??
                `Período corrente — ${labelEff}`}
            </p>
            <div className="dash-graficos-grid">
              <div className="card chart-wrap">
                <h3>Inspeções recebidas</h3>
                <p className="chart-sub">Volume no mês por semana</p>
                <canvas ref={canvasChRef} id="loc-chart-checklists" />
              </div>
              <div className="card chart-wrap wide">
                <h3>Top 5 operadores — inspeções com alta confiabilidade</h3>
                <p className="chart-sub">
                  Ranking por quantidade de checklists com qualidade alta no
                  período
                </p>
                <canvas ref={canvasOpRef} id="loc-chart-operadores" />
              </div>
            </div>
          </div>

          <div
            id="auditoria"
            className={`tab-content ${secaoAtiva === "auditoria" ? "active" : ""}`}
          >
            <h1>Auditoria de checklists</h1>
            <p className="loc-intro">
              Avalie a qualidade dos checklists vindos do{" "}
              <strong>aplicativo de campo</strong> e inspeções via QR sincronizadas. Use a lista
              abaixo: expanda cada registro para ver horímetro, observações e itens (Sim/Não), no
              mesmo modelo do painel operacional.
            </p>
            <div className="card" style={{ marginTop: 16 }}>
              <div
                className="hu360-dash-checklists-panel"
                style={{ marginTop: 0, maxWidth: "100%" }}
              >
                <div className="hu360-dash-checklists-panel__head">
                  <h3 className="hu360-dash-checklists-panel__title">Registros</h3>
                </div>
                <ListaChecklistHistoricoLocal
                  rows={auditoriaHistoricoRows}
                  expandidoId={auditoriaExpandidoId}
                  setExpandidoId={setAuditoriaExpandidoId}
                  mensagemVazia="Nenhum checklist no período."
                />
              </div>
            </div>
          </div>

          <div
            id="riscos"
            className={`tab-content ${secaoAtiva === "riscos" ? "active" : ""}`}
          >
            <h1>Triagem de risco</h1>
            <p className="loc-intro">
              Priorize falhas relatadas em campo por{" "}
              <strong>nível de risco</strong>, equipamento e ação recomendada
              (oficina, agendar revisão ou correção simples).
            </p>
            <table>
              <thead>
                <tr>
                  <th>Risco</th>
                  <th>Equipamento</th>
                  <th>Defeito</th>
                  <th>Operador</th>
                  <th>Ação sugerida</th>
                </tr>
              </thead>
              <tbody id="loc-tbody-riscos">
                {rList.map((row, idx) => {
                  const merged = { ...rBase[idx], ...row };
                  return (
                    <tr key={`r-${merged.equipamento}-${idx}`}>
                      <td>{merged.nivel}</td>
                      <td>{merged.equipamento}</td>
                      <td>{merged.defeito}</td>
                      <td>{merged.operador}</td>
                      <td>{merged.acao}</td>
                    </tr>
                  );
                })}
                {rList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ textAlign: "center", color: "var(--text-gray)" }}
                    >
                      Nenhum risco priorizado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div
            id="equipamentos"
            className={`tab-content ${secaoAtiva === "equipamentos" ? "active" : ""}`}
          >
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--text-gray)",
                margin: "0 0 14px",
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: "#cbd5e1" }}>Clientes</span>
              &nbsp;/&nbsp;
              <strong
                id="loc-eq-bc-cliente"
                style={{ color: "var(--main-orange)" }}
              >
                {labelEff}
              </strong>
              &nbsp;/&nbsp;
              <span style={{ color: "#e2e8f0" }}>Equipamentos</span>
            </p>
            <h1>Equipamentos em locação</h1>
            <p className="loc-intro" style={{ marginTop: 0 }}>
              Visualização da frota cadastrada para o cliente (mesma base da
              prefeitura vinculada ao login). O <strong>tomador / empresa terceira</strong>{" "}
              por equipamento é definido na aba <strong>Empresas terceiras</strong>. Inclusão e
              importação de equipamentos ficam no{" "}
              <Link
                to="/admin/equipamentos-locacao"
                style={{ color: "var(--main-orange)" }}
              >
                Hub administrativo
              </Link>{" "}
              (aba Equipamentos locação).
            </p>

            <div className="card">
              <h3>Equipamentos cadastrados</h3>
              <table style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Tipo / descrição</th>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>Chassis</th>
                    <th>Tomador / terceiro</th>
                    <th>Linha</th>
                    <th>Obra</th>
                  </tr>
                </thead>
                <tbody id="loc-eq-tbody">
                  {equip.lista.map((eq) => (
                    <tr key={eq.id}>
                      <td>
                        <strong>
                          {eq.descricao || eq.modelo || "Equipamento"}
                        </strong>
                      </td>
                      <td>{eq.marca}</td>
                      <td>{eq.modelo}</td>
                      <td style={{ fontSize: "0.82rem" }}>{eq.chassis}</td>
                      <td style={{ fontSize: "0.82rem", maxWidth: 200 }}>
                        {eq.empresaTerceiraId
                          ? empresaLabelById.get(eq.empresaTerceiraId) ?? "—"
                          : "Locadora"}
                      </td>
                      <td style={{ fontSize: "0.82rem" }}>{eq.linha || "—"}</td>
                      <td style={{ fontSize: "0.82rem" }}>
                        {eq.obra?.trim() ? eq.obra : "—"}
                      </td>
                    </tr>
                  ))}
                  {equip.lista.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          color: "var(--text-gray)",
                        }}
                      >
                        Nenhum equipamento cadastrado ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div
            id="terceiros"
            className={`tab-content ${secaoAtiva === "terceiros" ? "active" : ""}`}
          >
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--text-gray)",
                margin: "0 0 14px",
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: "#cbd5e1" }}>Clientes</span>
              &nbsp;/&nbsp;
              <strong style={{ color: "var(--main-orange)" }}>{labelEff}</strong>
              &nbsp;/&nbsp;
              <span style={{ color: "#e2e8f0" }}>Empresas terceiras</span>
            </p>
            <h1>Empresas terceiras (tomadores)</h1>
            <p className="loc-intro" style={{ marginTop: 0 }}>
              Cadastre <strong>empresas às quais a locadora direciona</strong> o uso do
              equipamento (sublocação / obra de terceiro). Depois associe cada máquina pelo
              chassi na tabela abaixo. Equipamentos sem associação permanecem como{" "}
              <strong>Locadora</strong>.
            </p>

            <div
              className="card"
              style={{
                marginBottom: 16,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
                justifyContent: "space-between",
              }}
            >
              <div style={{ flex: "1 1 220px" }}>
                <h3 style={{ margin: "0 0 6px" }}>Sincronizar com o servidor</h3>
                <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--text-gray)" }}>
                  Envia empresas terceiras e vínculos por chassi ao Firestore e reimporta a
                  base (inclui equipamentos cadastrados só no Hub).
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                style={{ margin: 0, flexShrink: 0 }}
                disabled={syncLocacaoLoading || !prefeituraIdEff}
                onClick={() => void handleSincronizarLocacaoFirestore()}
              >
                {syncLocacaoLoading ? "Sincronizando…" : "Sincronizar agora"}
              </button>
              {syncLocacaoMsg ? (
                <p
                  style={{
                    width: "100%",
                    margin: 0,
                    fontSize: "0.86rem",
                    color: syncLocacaoMsg.includes("Falha") ? "#fca5a5" : "#86efac",
                  }}
                >
                  {syncLocacaoMsg}
                </p>
              ) : null}
            </div>

            <div className="card">
              <h3>Nova empresa terceira</h3>
              <form
                onSubmit={handleCadastroEmpresaTerceira}
                style={{ marginTop: 12, maxWidth: 480 }}
              >
                <label htmlFor="loc-terc-nome">Nome da empresa</label>
                <input
                  id="loc-terc-nome"
                  value={tercNome}
                  onChange={(e) => setTercNome(e.target.value)}
                  placeholder="Ex.: Construtora Horizonte Ltda."
                  autoComplete="organization"
                />
                <label htmlFor="loc-terc-cnpj" style={{ marginTop: 12 }}>
                  CNPJ (opcional)
                </label>
                <input
                  id="loc-terc-cnpj"
                  value={tercCnpj}
                  onChange={(e) => setTercCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  autoComplete="off"
                />
                <label htmlFor="loc-terc-contato" style={{ marginTop: 12 }}>
                  Contato (opcional)
                </label>
                <input
                  id="loc-terc-contato"
                  value={tercContato}
                  onChange={(e) => setTercContato(e.target.value)}
                  placeholder="E-mail ou telefone"
                  autoComplete="off"
                />
                <label htmlFor="loc-terc-obs" style={{ marginTop: 12 }}>
                  Observações (opcional)
                </label>
                <textarea
                  id="loc-terc-obs"
                  value={tercObs}
                  onChange={(e) => setTercObs(e.target.value)}
                  rows={2}
                  placeholder="Obra, contrato, período da sublocação…"
                />
                <div style={{ marginTop: 16 }}>
                  <button type="submit" className="btn btn-outline" style={{ margin: 0 }}>
                    Salvar empresa
                  </button>
                </div>
                {tercMsg ? (
                  <p
                    style={{
                      marginTop: 12,
                      marginBottom: 0,
                      fontSize: "0.88rem",
                      color: tercMsg.tone === "ok" ? "#86efac" : "#fca5a5",
                    }}
                  >
                    {tercMsg.text}
                  </p>
                ) : null}
              </form>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <h3>Empresas cadastradas</h3>
              {terceiras.lista.length === 0 ? (
                <p style={{ color: "var(--text-gray)", marginTop: 12, marginBottom: 0 }}>
                  Nenhuma empresa terceira ainda. Cadastre acima para poder direcionar
                  equipamentos.
                </p>
              ) : (
                <table style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>CNPJ</th>
                      <th>Contato</th>
                      <th>Cadastro</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {terceiras.lista.map((em) => (
                      <tr key={em.id}>
                        <td>
                          <strong>{em.nome}</strong>
                          {em.observacoes ? (
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--text-gray)",
                                marginTop: 4,
                                maxWidth: 280,
                              }}
                            >
                              {em.observacoes}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ fontSize: "0.82rem" }}>{em.cnpj?.trim() ? em.cnpj : "—"}</td>
                        <td style={{ fontSize: "0.82rem" }}>
                          {em.contato?.trim() ? em.contato : "—"}
                        </td>
                        <td style={{ fontSize: "0.82rem" }}>{em.criadoEm}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ margin: 0, padding: "6px 12px", fontSize: "0.82rem" }}
                            onClick={() => handleRemoverEmpresaTerceira(em.id)}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <h3>Direcionar máquinas (por chassi)</h3>
              <p style={{ color: "var(--text-gray)", fontSize: "0.88rem", marginTop: 0 }}>
                Escolha o tomador de cada equipamento já cadastrado na base deste cliente.
              </p>
              {equip.lista.length === 0 ? (
                <p style={{ color: "var(--text-gray)", marginBottom: 0 }}>
                  Não há equipamentos na base. Cadastre frota no Hub administrativo.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ marginTop: 12, minWidth: 560 }}>
                    <thead>
                      <tr>
                        <th>Equipamento</th>
                        <th>Chassis</th>
                        <th>Tomador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equip.lista.map((eq) => (
                        <tr key={eq.id}>
                          <td>
                            <strong>{eq.descricao || eq.modelo || "Equipamento"}</strong>
                            <div style={{ fontSize: "0.78rem", color: "var(--text-gray)" }}>
                              {eq.marca} {eq.modelo}
                            </div>
                          </td>
                          <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                            {eq.chassis}
                          </td>
                          <td>
                            <select
                              aria-label={`Tomador para ${eq.chassis}`}
                              value={eq.empresaTerceiraId ?? ""}
                              onChange={(e) =>
                                equip.definirEmpresaTerceira(
                                  eq.id,
                                  e.target.value || undefined,
                                )
                              }
                              style={{
                                maxWidth: 260,
                                fontSize: "0.86rem",
                                padding: "8px 10px",
                                borderRadius: 8,
                              }}
                            >
                              <option value="">Locadora (sem terceiro)</option>
                              {terceiras.lista.map((em) => (
                                <option key={em.id} value={em.id}>
                                  {em.nome}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
