import {
  type FormEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  type ChecklistApiRow,
  criarDadosDemo,
  type ChecklistApp,
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

type LocacaoSecao = "dash" | "auditoria" | "riscos" | "equipamentos";

const COR_INFO = "#78716c";
const COR_ERRO = "#dc2626";

interface AuthMsg {
  texto: string;
  cor: string;
}

const AUTH_MSG_LIMPA: AuthMsg = { texto: "", cor: COR_INFO };

function locFormatCriadoEmBr(s: string | undefined): string {
  if (!s) return "—";
  const t = String(s).replace("T", " ").trim();
  const p = t.split(/[- :]/);
  if (p.length >= 5) {
    return `${p[2]}/${p[1]}/${p[0]} ${p[3]}:${p[4]}`;
  }
  return t;
}

type ModalChecklist =
  | {
      kind: "app";
      titulo: string;
      subtitulo: string;
      checklist: ChecklistApp;
      colStatus: string;
    }
  | {
      kind: "qr";
      titulo: string;
      subtitulo: string;
      checklist: ChecklistApp;
      row: ChecklistApiRow;
    };

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

function observacoesRodape(c: ChecklistApp): string {
  const oc = c.observacoesCampo;
  const op = (c as ChecklistApp & { observacoesOperador?: string })
    .observacoesOperador;
  if (oc != null && oc !== "") return oc;
  return op ?? "";
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

  const rBase = useMemo(
    () =>
      prefeituraIdEff ? (criarDadosDemo(prefeituraIdEff).riscos ?? []) : [],
    [prefeituraIdEff],
  );
  const rList =
    dados?.riscos?.length && dados.riscos.length > 0 ? dados.riscos : rBase;

  const equip = useEquipamentosCadastro(prefeituraIdEff ?? undefined);

  // Estado de login
  //@ts-ignore
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  //@ts-ignore
  const [authMsg, setAuthMsg] = useState<AuthMsg>({ texto: "", cor: COR_INFO });

  // Navegação
  const [secaoAtiva, setSecaoAtiva] = useState<LocacaoSecao>("dash");

  const [modalChecklist, setModalChecklist] = useState<ModalChecklist | null>(
    null,
  );

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

  //@ts-ignore
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

  function abrirChecklistCard() {
    setSecaoAtiva("auditoria");
  }

  function fecharChecklist() {
    setModalChecklist(null);
  }

  function abrirChecklistAuditoria(indice: number) {
    if (!prefeituraIdEff) return;
    const row = {
      ...audBase[indice],
      ...audLista[indice],
    };
    const c = row.checklistApp;
    if (!c) {
      window.alert(
        "Checklist do aplicativo indisponível para este registro. Atualize a página ou limpe o armazenamento local.",
      );
      return;
    }
    setModalChecklist({
      kind: "app",
      titulo: "Checklist do aplicativo (campo)",
      subtitulo: `${row.equipamento} · ${row.operador} · ${row.hora}`,
      checklist: c,
      colStatus: "Indicador",
    });
  }

  function abrirChecklistCampoQr(idx: number) {
    const row = checklistsCampo[idx];
    if (!row) {
      window.alert("Registro indisponível.");
      return;
    }
    const c = checklistQrSintetico(row);
    setModalChecklist({
      kind: "qr",
      titulo: "Inspeção QR (servidor)",
      subtitulo: `${row.chassis_qr || "—"} · ${locFormatCriadoEmBr(row.criado_em)}`,
      checklist: c,
      row,
    });
  }

  function limparCtxHubModulo() {
    limparLocacaoPrefCtxHub();
    bumpPrefCtx();
  }

  if (!user || !dados) {
    return <Navigate to="/login-operacional?destino=locacao" replace />;
  }

  const labelPrefLogin = prefeituraLabel(user.prefeituraId ?? "");
  const labelEff = prefeituraIdEff
    ? prefeituraLabel(prefeituraIdEff)
    : labelPrefLogin;
  const usuarioLogadoTexto = `Conectado: ${user.usuario} · ${labelPrefLogin}`;
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
              <strong>aplicativo de campo</strong> e inspeções via QR
              sincronizadas. Use o índice de confiabilidade e abra o
              detalhamento quando necessário.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Operador</th>
                  <th>Equipamento</th>
                  <th>Chassis</th>
                  <th>Fotos anexas</th>
                  <th>Índice confiabilidade</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody id="loc-tbody-auditoria">
                {audLista.map((row, idx) => {
                  const merged = { ...audBase[idx], ...row };
                  const idxCell = merged.alerta ? (
                    <td style={{ color: "#ef4444" }}>{merged.indice}</td>
                  ) : (
                    <td>{merged.indice}</td>
                  );
                  return (
                    <tr key={`aud-${merged.hora}-${idx}`}>
                      <td>{merged.hora}</td>
                      <td>{merged.operador}</td>
                      <td>{merged.equipamento}</td>
                      <td style={{ fontSize: "0.82rem" }}>
                        {merged.chassis?.trim() ? merged.chassis : "—"}
                      </td>
                      <td>{merged.fotos} Fotos</td>
                      {idxCell}
                      <td>
                        <button
                          type="button"
                          className="btn-ver-checklist"
                          onClick={() => abrirChecklistAuditoria(idx)}
                        >
                          Ver checklist do app
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {checklistsCampo.map((r, ci) => {
                  const horaDisp = locFormatCriadoEmBr(r.criado_em);
                  const oleo = String(r.status_oleo || "").toLowerCase();
                  const filt = String(r.status_filtros || "").toLowerCase();
                  const alerta = oleo === "critico" || filt === "critico";
                  const indice = alerta
                    ? "Crítico"
                    : oleo === "ok" && filt === "ok"
                      ? "Alto"
                      : "Médio";
                  const idxCellC = alerta ? (
                    <td style={{ color: "#ef4444" }}>{indice}</td>
                  ) : (
                    <td>{indice}</td>
                  );
                  return (
                    <tr key={`cc-${r.id}-${ci}`}>
                      <td>{horaDisp}</td>
                      <td>QR / campo</td>
                      <td>{r.chassis_qr || "—"}</td>
                      <td style={{ fontSize: "0.82rem" }}>
                        {r.chassis_qr || "—"}
                      </td>
                      <td>0 Fotos</td>
                      {idxCellC}
                      <td>
                        <button
                          type="button"
                          className="btn-ver-checklist"
                          onClick={() => abrirChecklistCampoQr(ci)}
                        >
                          Ver inspeção QR
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {audLista.length === 0 && checklistsCampo.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ textAlign: "center", color: "var(--text-gray)" }}
                    >
                      Nenhum checklist no período.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
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
              prefeitura vinculada ao login). Inclusão e importação de
              equipamentos ficam no{" "}
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
                      <td style={{ fontSize: "0.82rem" }}>{eq.linha || "—"}</td>
                      <td style={{ fontSize: "0.82rem" }}>
                        {eq.obra?.trim() ? eq.obra : "—"}
                      </td>
                    </tr>
                  ))}
                  {equip.lista.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
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
        </div>
      </div>

      <div
        id="loc-modal-checklist-overlay"
        className={`loc-modal-overlay ${modalChecklist ? "" : "loc-hidden"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="loc-modal-checklist-h2"
        onClick={(e) => {
          if (e.target === e.currentTarget) fecharChecklist();
        }}
      >
        <div
          className="loc-modal-box"
          onClick={(e) => e.stopPropagation()}
          role="document"
        >
          <button
            type="button"
            className="loc-modal-fechar"
            onClick={fecharChecklist}
            aria-label="Fechar"
          >
            ×
          </button>
          {modalChecklist ? (
            <>
              <h2 id="loc-modal-checklist-h2" className="loc-modal-titulo">
                {modalChecklist.titulo}
              </h2>
              <p id="loc-modal-checklist-sub" className="loc-modal-sub">
                {modalChecklist.subtitulo}
              </p>
              <div id="loc-modal-checklist-meta" className="loc-checklist-meta">
                <div>
                  <span>Protocolo (aplicativo)</span>
                  {modalChecklist.checklist.protocolo || "—"}
                </div>
                <div>
                  <span>Sincronizado em</span>
                  {modalChecklist.checklist.sincronizadoEm || "—"}
                </div>
                <div>
                  <span>Versão do app</span>
                  {modalChecklist.checklist.versaoApp || "—"}
                </div>
                <div>
                  <span>Referência O.S. / chamado</span>
                  {modalChecklist.checklist.referenciaOs || "—"}
                </div>
                <div>
                  <span>Horímetro / odômetro no momento</span>
                  {modalChecklist.checklist.horimetroCampo || "—"}
                </div>
                {modalChecklist.kind === "qr" ? (
                  <>
                    <div>
                      <span>ID no servidor</span>
                      {String(modalChecklist.row.id)}
                    </div>
                    {modalChecklist.row.veiculo_id != null ? (
                      <div>
                        <span>Veículo vinculado (ID)</span>
                        {String(modalChecklist.row.veiculo_id)}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div id="loc-modal-checklist-corpo">
                {(modalChecklist.checklist.secoes || []).map((sec, si) => (
                  <div key={si} className="loc-checklist-secao">
                    <h4>{sec.titulo || ""}</h4>
                    <table className="loc-modal-tabela">
                      <thead>
                        <tr>
                          <th>Verificação</th>
                          <th>Resposta registrada</th>
                          <th>
                            {modalChecklist.kind === "app"
                              ? modalChecklist.colStatus
                              : "Indicador"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sec.itens || []).map((it, ii) => (
                          <tr key={ii}>
                            <td>{it.item}</td>
                            <td>{it.resposta}</td>
                            <td>
                              {it.conforme ? (
                                <span className="loc-badge-conf sim">
                                  Conforme
                                </span>
                              ) : (
                                <span className="loc-badge-conf nao">
                                  Atenção
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
              <p id="loc-modal-checklist-obs" className="loc-modal-obs">
                {(() => {
                  const o = observacoesRodape(modalChecklist.checklist);
                  return o ? `Observações: ${o}` : "";
                })()}
              </p>
              <p id="loc-modal-checklist-fotos" className="loc-modal-obs">
                {modalChecklist.checklist.fotosResumo
                  ? `Anexos fotográficos: ${modalChecklist.checklist.fotosResumo}`
                  : ""}
              </p>
              <p
                id="loc-modal-checklist-assin"
                style={{
                  marginTop: 16,
                  fontSize: "0.82rem",
                  color: "#64748b",
                }}
              >
                {modalChecklist.checklist.assinaturaDigital || ""}
              </p>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
