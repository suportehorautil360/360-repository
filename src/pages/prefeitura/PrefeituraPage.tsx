import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useHU360, useHU360Auth } from "../../lib/hu360";
import { DashboardSection } from "./sections/DashboardSection";
import { AuditoriaSection } from "./sections/AuditoriaSection";
import { RiscosSection } from "./sections/RiscosSection";
import { EquipamentosSection } from "./sections/EquipamentosSection";
import { CadastrosSection } from "./sections/CadastrosSection";
import { AbrirOsSection } from "./sections/AbrirOsSection";
import { OrcamentosSection } from "./sections/OrcamentosSection";
import { FinalizarOsSection } from "./sections/FinalizarOsSection";
import { AbastecimentoSection } from "./sections/AbastecimentoSection";
import "./prefeitura.css";

type PrefAba =
  | "dash"
  | "auditoria"
  | "riscos"
  | "equipamentos"
  | "cadastros"
  | "criar-os"
  | "orcamentos-pref"
  | "finalizar-os"
  | "abastecimento";

const ABAS: { id: PrefAba; label: string }[] = [
  { id: "dash", label: "📊 Dashboard Geral" },
  { id: "auditoria", label: "📋 Auditoria de Checklists" },
  { id: "riscos", label: "⚠️ Triagem de Riscos" },
  { id: "equipamentos", label: "🛠️ Equipamentos" },
  { id: "cadastros", label: "👤 Cadastros" },
  { id: "criar-os", label: "📝 Abrir O.S." },
  { id: "orcamentos-pref", label: "📑 Orçamentos & Aprovação" },
  { id: "finalizar-os", label: "✅ Checklist, NF & Pagamento" },
  { id: "abastecimento", label: "⛽ Abastecimento & postos" },
];

export function PrefeituraPage() {
  const { id: idParam } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user, login, logout } = useHU360Auth();
  const { obterDadosPrefeitura, prefeituraLabel } = useHU360();

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [authMsg, setAuthMsg] = useState<{
    tone: "none" | "ok" | "err";
    text: string;
  }>({
    tone: "none",
    text: "",
  });
  const [aba, setAba] = useState<PrefAba>("dash");

  useEffect(() => {
    document.body.classList.add("prefeitura-root");
    return () => {
      document.body.classList.remove("prefeitura-root");
    };
  }, []);

  // Sincroniza a URL com o município efetivamente em foco.
  const prefeituraId = useMemo(() => {
    if (idParam) return idParam;
    return user?.prefeituraId ?? "";
  }, [idParam, user?.prefeituraId]);

  useEffect(() => {
    if (!user) return;
    if (idParam && idParam !== user.prefeituraId) {
      // Hub abriu o portal apontando outro município: respeita a URL.
      return;
    }
    if (!idParam && user.prefeituraId) {
      navigate(`/prefeitura/${user.prefeituraId}`, { replace: true });
    }
  }, [user, idParam, navigate]);

  const dados = useMemo(
    () => (prefeituraId ? obterDadosPrefeitura(prefeituraId) : null),
    [prefeituraId, obterDadosPrefeitura],
  );

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthMsg({ tone: "none", text: "" });
    if (!usuario.trim() || !senha) {
      setAuthMsg({ tone: "err", text: "Informe usuário e senha." });
      return;
    }
    const r = await login(usuario.trim(), senha);
    if (!r.ok) {
      setAuthMsg({ tone: "err", text: r.msg ?? "Login ou senha inválidos." });
      return;
    }
    setSenha("");
  }

  async function handleLogout() {
    await logout();
    setUsuario("");
    setSenha("");
    setAuthMsg({ tone: "none", text: "" });
    navigate("/prefeitura", { replace: true });
  }

  if (!user) {
    return (
      <div className="prefeitura-root">
        <section id="authScreen" className="auth-screen">
          <div className="auth-card">
            <h1>Acesso ao sistema</h1>
            <p className="sub">Use o mesmo login do Hub Mestre horautil360.</p>
            <form id="loginForm" onSubmit={handleLogin}>
              <label htmlFor="loginUsuario">Usuário</label>
              <input
                id="loginUsuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
                placeholder="Digite seu usuário"
                autoComplete="username"
              />
              <label htmlFor="loginSenha">Senha</label>
              <input
                id="loginSenha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                placeholder="Digite sua senha"
                autoComplete="current-password"
              />
              <button className="btn" type="submit">
                Entrar
              </button>
              <div
                id="authMsg"
                className={`auth-msg ${
                  authMsg.tone === "ok"
                    ? "ok"
                    : authMsg.tone === "err"
                      ? "err"
                      : ""
                }`}
              >
                {authMsg.text}
              </div>
            </form>
            <p
              style={{
                marginTop: 16,
                fontSize: "0.8rem",
                color: "var(--text-gray)",
                borderTop: "1px dashed #2d3748",
                paddingTop: 12,
              }}
            >
              Cada usuário vê só sua prefeitura: <strong>admin</strong> (Três
              Lagoas) · <strong>gestor</strong> (Curitiba) ·{" "}
              <strong>admin.bh</strong> (BH).
            </p>
            <Link
              to="/"
              style={{
                display: "block",
                marginTop: 14,
                color: "var(--main-orange)",
                fontSize: "0.88rem",
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              ← Voltar ao Hub
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!dados || !prefeituraId) {
    return (
      <div className="prefeitura-root">
        <section className="auth-screen">
          <div className="auth-card">
            <h1>Município não localizado</h1>
            <p className="sub">
              Não foi possível carregar dados para{" "}
              {idParam || "o município solicitado"}.
            </p>
            <Link
              to="/admin/dashboard"
              style={{
                color: "var(--main-orange)",
                display: "block",
                marginTop: 12,
              }}
            >
              ← Voltar ao Hub
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const labelMunicipio = prefeituraLabel(prefeituraId);
  const ehOutroMunicipio = idParam && idParam !== user.prefeituraId;

  return (
    <div className="prefeitura-root">
      <div id="appShell" className="pf-app-shell">
        <aside id="sidebar">
          <div className="logo">
            <h2>horautil360</h2>
            <p
              id="prefCtxNome"
              style={{
                fontSize: "0.75rem",
                color: "var(--main-orange)",
                marginTop: 8,
                fontWeight: 600,
              }}
            >
              {labelMunicipio}
            </p>
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--text-gray)",
                marginTop: 4,
              }}
            >
              Dados exclusivos deste município
            </p>
          </div>

          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`nav-item ${aba === a.id ? "active" : ""}`}
              onClick={() => setAba(a.id)}
            >
              {a.label}
            </button>
          ))}
        </aside>

        <main id="main">
          <div className="app-topbar">
            <Link className="hub-link" to="/admin/dashboard">
              ← Hub Mestre
            </Link>
            <div className="app-topbar-actions">
              <span id="usuarioLogado" className="topbar-user">
                {user.nome} ({user.usuario})
              </span>
              <button
                type="button"
                className="btn btn-outline"
                style={{ width: "auto", margin: 0, padding: "8px 14px" }}
                onClick={handleLogout}
              >
                Sair
              </button>
            </div>
          </div>

          {ehOutroMunicipio ? (
            <div
              id="pf-banner-hub-ctx"
              className="pf-hub-ctx-banner"
              role="status"
            >
              Você abriu o painel <strong>{labelMunicipio}</strong> a partir do
              Hub Mestre. Sua sessão original é{" "}
              {prefeituraLabel(user.prefeituraId)}.
            </div>
          ) : null}

          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--text-gray)",
              margin: "0 0 18px",
              lineHeight: 1.4,
            }}
          >
            Cadastro ou exclusão de logins (prefeitura, oficina ou posto) é
            feito somente no <strong>Hub Mestre</strong>, em{" "}
            <strong>Controle → Acessos e logins</strong>.
            <span style={{ display: "block", marginTop: 10 }}>
              <strong>Oficinas e postos credenciados</strong> também são geridos
              no Hub (aba <strong>Oficinas e postos</strong>), no contexto deste
              município.
              <Link
                to="/admin/oficinas-postos"
                className="btn btn-outline"
                style={{
                  width: "auto",
                  marginTop: 8,
                  padding: "8px 14px",
                  fontSize: "0.78rem",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Abrir Hub — Oficinas e postos
              </Link>
            </span>
          </p>

          <div
            id="dash"
            className={`tab-content ${aba === "dash" ? "active" : ""}`}
          >
            <DashboardSection dados={dados} />
          </div>

          <div
            id="auditoria"
            className={`tab-content ${aba === "auditoria" ? "active" : ""}`}
          >
            <AuditoriaSection prefeituraId={prefeituraId} />
          </div>

          <div
            id="riscos"
            className={`tab-content ${aba === "riscos" ? "active" : ""}`}
          >
            <RiscosSection dados={dados} />
          </div>

          <div
            id="equipamentos"
            className={`tab-content ${aba === "equipamentos" ? "active" : ""}`}
          >
            <EquipamentosSection
              prefeituraId={prefeituraId}
              labelMunicipio={labelMunicipio}
            />
          </div>

          <div
            id="cadastros"
            className={`tab-content ${aba === "cadastros" ? "active" : ""}`}
          >
            <CadastrosSection prefeituraId={prefeituraId} />
          </div>

          <div
            id="criar-os"
            className={`tab-content ${aba === "criar-os" ? "active" : ""}`}
          >
            <AbrirOsSection dados={dados} prefeituraId={prefeituraId} />
          </div>

          <div
            id="orcamentos-pref"
            className={`tab-content ${aba === "orcamentos-pref" ? "active" : ""}`}
          >
            <OrcamentosSection prefeituraId={prefeituraId} />
          </div>

          <div
            id="finalizar-os"
            className={`tab-content ${aba === "finalizar-os" ? "active" : ""}`}
          >
            <FinalizarOsSection dados={dados} prefeituraId={prefeituraId} />
          </div>

          <div
            id="abastecimento"
            className={`tab-content ${aba === "abastecimento" ? "active" : ""}`}
          >
            <AbastecimentoSection dados={dados} prefeituraId={prefeituraId} />
          </div>
        </main>
      </div>
    </div>
  );
}
