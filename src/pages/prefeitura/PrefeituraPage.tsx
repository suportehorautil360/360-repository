import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useHU360 } from "../../lib/hu360";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { DashboardSection } from "./sections/DashboardSection";
import { AuditoriaSection } from "./sections/AuditoriaSection";
import { RiscosSection } from "./sections/RiscosSection";
import { EquipamentosSection } from "./sections/EquipamentosSection";
import { EquipamentoFormPage } from "./sections/EquipamentoFormPage";
import { DiaPontoSection } from "./sections/DiaPontoSection";
import { CadastrosSection } from "./sections/CadastrosSection";
import { FuncionariosSection } from "./sections/FuncionariosSection";
import { FuncionarioFormPage } from "./sections/FuncionarioFormPage";
import { HistoricoPontoSection } from "./sections/HistoricoPontoSection";
import { AbrirOsSection } from "./sections/AbrirOsSection";
import { OrcamentosSection } from "./sections/OrcamentosSection";
import { FinalizarOsSection } from "./sections/FinalizarOsSection";
import { AbastecimentoSection } from "./sections/AbastecimentoSection";
import { PontosRhSection } from "./sections/PontosRhSection";
import { SolicitacoesPontoSection } from "./sections/SolicitacoesPontoSection";
import { ConfiguracoesSection } from "./sections/ConfiguracoesSection";
import { FrotaSection } from "./sections/FrotaSection";
import { FrentesTrabalhoSection } from "./sections/FrentesTrabalhoSection";
import { AlocacaoSection } from "./sections/AlocacaoSection";
import { RelatoriosSection } from "./sections/RelatoriosSection";
import { RevisoesSection } from "./sections/RevisoesSection";
import { PreventivaSection } from "./sections/PreventivaSection";
import { EmergenciaTable } from "../../components/emergencia/EmergenciaTable";
import { PREFEITURA_BRAND, SECAO_LABEL, prefeituraNav } from "./prefeituraNav";
import "./prefeitura.css";
import { useLogin } from "../login/hooks/use-login";
import {
  usePontoAtivo,
  useAbastecimentoAtivo,
} from "../../lib/api/feature-flags";
import { usePrefeituraBadges } from "./usePrefeituraBadges";

/** Placeholder das seções da referência que ainda não têm tela. */
function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <div>
      <h1>{titulo}</h1>
      <p style={{ color: "var(--text-gray)", maxWidth: "48rem" }}>
        🚧 Esta seção ainda está em construção. A estrutura já existe no menu; o
        conteúdo será habilitado em breve.
      </p>
    </div>
  );
}

export function PrefeituraPage() {
  const {
    id: idParam,
    secao,
    funcId,
  } = useParams<{
    id?: string;
    secao?: string;
    funcId?: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Sub-rotas de /funcionarios — todas dentro de /prefeitura/:id mas com
  // tela própria: /novo, /:funcId/editar, /:funcId/historico.
  const funcSubPagina: "novo" | "editar" | "historico" | null =
    location.pathname.endsWith("/funcionarios/novo")
      ? "novo"
      : /\/funcionarios\/[^/]+\/editar$/.test(location.pathname)
        ? "editar"
        : /\/funcionarios\/[^/]+\/historico$/.test(location.pathname)
          ? "historico"
          : null;
  // Compat: nome antigo usado em vários pontos do componente.
  const funcFormModo: "novo" | "editar" | null =
    funcSubPagina === "novo" || funcSubPagina === "editar"
      ? funcSubPagina
      : null;
  // Sub-rotas dedicadas de equipamento: cadastro e edição.
  const equipNovo = location.pathname.endsWith("/equipamentos/novo");
  const equipEditId =
    location.pathname.match(/\/equipamentos\/([^/]+)\/editar$/)?.[1] ?? null;
  // Tela dedicada de um dia de ponto: /funcionarios/:funcId/historico/:dia
  const pontoDiaMatch = location.pathname.match(
    /\/funcionarios\/([^/]+)\/historico\/([^/]+)$/,
  );
  const ehPontoDia = !!pontoDiaMatch;
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
  // As rotas dedicadas (/funcionarios/novo, /funcionarios/:id/editar) não
  // têm `secao` no useParams; aí o redirect padrão não deve disparar.
  useEffect(() => {
    if (!user || !prefeituraId) return;
    if (funcSubPagina || equipNovo || equipEditId || ehPontoDia) return;
    if (!idParam && user.prefeituraId) {
      navigate(`/prefeitura/${user.prefeituraId}/dashboard`, { replace: true });
    } else if (idParam && !secao) {
      navigate(`/prefeitura/${idParam}/dashboard`, { replace: true });
    }
  }, [
    user,
    idParam,
    secao,
    prefeituraId,
    navigate,
    funcSubPagina,
    equipNovo,
    equipEditId,
    ehPontoDia,
  ]);

  const { ativo: pontoAtivo } = usePontoAtivo(prefeituraId);
  const { ativo: abastecimentoAtivo } = useAbastecimentoAtivo(prefeituraId);
  const badges = usePrefeituraBadges(prefeituraId, pontoAtivo);

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
  // Quando estamos numa rota dedicada de funcionário, o item ativo do menu
  // continua sendo "Funcionários".
  const secaoAtual =
    funcSubPagina || ehPontoDia
      ? "funcionarios"
      : equipNovo || equipEditId
        ? "equipamentos"
        : (secao ?? "dashboard");
  const navGroups = prefeituraNav(prefeituraId, {
    pontoAtivo,
    abastecimentoAtivo,
    badges,
  });

  function renderSecao() {
    if (pontoDiaMatch) {
      return (
        <DiaPontoSection
          prefeituraId={prefeituraId}
          funcId={pontoDiaMatch[1]}
          dia={pontoDiaMatch[2]}
        />
      );
    }
    if (equipNovo) {
      return <EquipamentoFormPage prefeituraId={prefeituraId} modo="novo" />;
    }
    if (equipEditId) {
      return <EquipamentoFormPage prefeituraId={prefeituraId} modo="editar" />;
    }
    if (funcSubPagina === "historico" && funcId) {
      return (
        <HistoricoPontoSection prefeituraId={prefeituraId} funcId={funcId} />
      );
    }
    if (funcFormModo) {
      return (
        <FuncionarioFormPage prefeituraId={prefeituraId} modo={funcFormModo} />
      );
    }
    switch (secaoAtual) {
      case "dashboard":
        return <DashboardSection prefeituraId={prefeituraId} />;
      case "abastecimento":
        return abastecimentoAtivo ? (
          <AbastecimentoSection dados={dados!} prefeituraId={prefeituraId} />
        ) : (
          <EmConstrucao titulo="Abastecimentos" />
        );
      case "frota":
        return <FrotaSection prefeituraId={prefeituraId} />;
      case "frentes-trabalho":
        return <FrentesTrabalhoSection prefeituraId={prefeituraId} />;
      case "alocacao":
        return <AlocacaoSection prefeituraId={prefeituraId} />;
      case "relatorios":
        return <RelatoriosSection prefeituraId={prefeituraId} />;
      case "revisoes":
        return <RevisoesSection prefeituraId={prefeituraId} />;
      case "preventiva":
        return <PreventivaSection prefeituraId={prefeituraId} />;
      case "equipamentos":
        return (
          <EquipamentosSection
            prefeituraId={prefeituraId}
            labelMunicipio={labelMunicipio}
          />
        );
      case "cadastros":
        return <CadastrosSection prefeituraId={prefeituraId} />;
      case "funcionarios":
        return <FuncionariosSection prefeituraId={prefeituraId} />;
      case "abrir-os":
        return <AbrirOsSection dados={dados!} prefeituraId={prefeituraId} />;
      case "orcamentos":
        return <OrcamentosSection prefeituraId={prefeituraId} />;
      case "pagamentos":
        return (
          <FinalizarOsSection dados={dados!} prefeituraId={prefeituraId} />
        );
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
      case "solicitacoes-ponto":
        return pontoAtivo ? (
          <SolicitacoesPontoSection prefeituraId={prefeituraId} />
        ) : (
          <EmConstrucao titulo="Solicitações de Ponto" />
        );
      case "configuracoes":
        return <ConfiguracoesSection prefeituraId={prefeituraId} />;
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
