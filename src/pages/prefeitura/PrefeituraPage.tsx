import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useHU360 } from "../../lib/hu360";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { DashboardSection } from "./sections/DashboardSection";
import { AuditoriaSection } from "./sections/AuditoriaSection";
import { RiscosSection } from "./sections/RiscosSection";
import { EquipamentosSection } from "./sections/EquipamentosSection";
import { CadastrosSection } from "./sections/CadastrosSection";
import { AbrirOsSection } from "./sections/AbrirOsSection";
import { OrcamentosSection } from "./sections/OrcamentosSection";
import { FinalizarOsSection } from "./sections/FinalizarOsSection";
import { AbastecimentoSection } from "./sections/AbastecimentoSection";
import { PontosRhSection } from "./sections/PontosRhSection";
import { FrotaSection } from "./sections/FrotaSection";
import { EmergenciaTable } from "../../components/emergencia/EmergenciaTable";
import {
  PREFEITURA_BRAND,
  SECAO_LABEL,
  prefeituraNav,
} from "./prefeituraNav";
import "./prefeitura.css";
import { useLogin } from "../login/hooks/use-login";
import { usePontoAtivo } from "../../lib/api/feature-flags";

/** Placeholder das seções da referência que ainda não têm tela. */
function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <div>
      <h1>{titulo}</h1>
      <p style={{ color: "var(--text-gray)", maxWidth: "48rem" }}>
        🚧 Esta seção ainda está em construção. A estrutura já existe no menu;
        o conteúdo será habilitado em breve.
      </p>
    </div>
  );
}

export function PrefeituraPage() {
  const { id: idParam, secao } = useParams<{ id?: string; secao?: string }>();
  const navigate = useNavigate();
  const { user, handleLogin: login, logout } = useLogin();
  const { obterDadosPrefeitura, prefeituraLabel } = useHU360();

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [authMsg, setAuthMsg] = useState<{
    tone: "none" | "ok" | "err";
    text: string;
  }>({ tone: "none", text: "" });

  useEffect(() => {
    document.body.classList.add("prefeitura-root");
    return () => {
      document.body.classList.remove("prefeitura-root");
    };
  }, []);

  const prefeituraId = useMemo(() => {
    if (idParam) return idParam;
    return user?.prefeituraId ?? "";
  }, [idParam, user?.prefeituraId]);

  // Sincroniza a URL: garante /prefeitura/:id e uma seção padrão (dashboard).
  useEffect(() => {
    if (!user || !prefeituraId) return;
    if (!idParam && user.prefeituraId) {
      navigate(`/prefeitura/${user.prefeituraId}/dashboard`, { replace: true });
    } else if (idParam && !secao) {
      navigate(`/prefeitura/${idParam}/dashboard`, { replace: true });
    }
  }, [user, idParam, secao, prefeituraId, navigate]);

  const { ativo: pontoAtivo } = usePontoAtivo(prefeituraId);

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
    const r = await login(usuario.trim(), senha, navigate);
    if (r.error) {
      setAuthMsg({ tone: "err", text: r.error });
      return;
    }
    setSenha("");
  }

  function handleLogout() {
    logout(navigate);
    setUsuario("");
    setSenha("");
    setAuthMsg({ tone: "none", text: "" });
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
  const secaoAtual = secao ?? "dashboard";
  const navGroups = prefeituraNav(prefeituraId, { pontoAtivo });

  function renderSecao() {
    switch (secaoAtual) {
      case "dashboard":
        return <DashboardSection prefeituraId={prefeituraId} />;
      case "abastecimento":
        return <AbastecimentoSection dados={dados!} prefeituraId={prefeituraId} />;
      case "frota":
        return <FrotaSection prefeituraId={prefeituraId} />;
      case "equipamentos":
        return (
          <EquipamentosSection
            prefeituraId={prefeituraId}
            labelMunicipio={labelMunicipio}
          />
        );
      case "cadastros":
        return <CadastrosSection prefeituraId={prefeituraId} />;
      case "abrir-os":
        return <AbrirOsSection dados={dados!} prefeituraId={prefeituraId} />;
      case "orcamentos":
        return <OrcamentosSection prefeituraId={prefeituraId} />;
      case "pagamentos":
        return <FinalizarOsSection dados={dados!} prefeituraId={prefeituraId} />;
      case "auditoria-checklists":
        return <AuditoriaSection prefeituraId={prefeituraId} />;
      case "riscos":
        return <RiscosSection prefeituraId={prefeituraId} />;
      case "emergencia":
        return (
          <div>
            <h1>Emergências</h1>
            <p
              style={{
                color: "var(--text-gray)",
                marginBottom: 16,
                lineHeight: 1.55,
                maxWidth: "52rem",
              }}
            >
              Registros de emergência reportados pelos operadores. Clique em{" "}
              <strong>Ver emergência</strong> para visualizar todos os detalhes
              e fotos do ocorrido.
            </p>
            <EmergenciaTable prefeituraId={prefeituraId} />
          </div>
        );
      case "pontos-rh":
        return pontoAtivo ? (
          <PontosRhSection prefeituraId={prefeituraId} />
        ) : (
          <EmConstrucao titulo="Pontos (RH)" />
        );
      default:
        return <EmConstrucao titulo={SECAO_LABEL[secaoAtual] ?? "Em breve"} />;
    }
  }

  return (
    <div className="prefeitura-root">
      <div id="appShell" className="pf-app-shell">
        <Sidebar
          brand={PREFEITURA_BRAND}
          groups={navGroups}
          user={{ name: user.usuario, role: labelMunicipio }}
          onLogout={handleLogout}
        />

        <main id="main">
          <div className="app-topbar">
            <Link className="hub-link" to="/admin/dashboard">
              ← Hub Mestre
            </Link>
          </div>

          {ehOutroMunicipio ? (
            <div className="pf-hub-ctx-banner" role="status">
              Você abriu o painel <strong>{labelMunicipio}</strong> a partir do
              Hub Mestre. Sua sessão original é{" "}
              {prefeituraLabel(user.prefeituraId ?? "")}.
            </div>
          ) : null}

          {renderSecao()}
        </main>
      </div>
    </div>
  );
}
