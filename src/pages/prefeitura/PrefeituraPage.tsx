import { useEffect, useMemo } from "react";
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
import { OrcamentosAprovacoesSection } from "./sections/OrcamentosAprovacoesSection";
import { NotasFiscaisSection } from "./sections/NotasFiscaisSection";
import { NotasFiscaisOficinasSection } from "./sections/NotasFiscaisOficinasSection";
import { FinalizarOsSection } from "./sections/FinalizarOsSection";
import { AbastecimentoVisaoGeralSection } from "./sections/AbastecimentoVisaoGeralSection";
import { ConsumoCustoSection } from "./sections/ConsumoCustoSection";
import { CreditoSection } from "./sections/CreditoSection";
import { LubrificacaoSection } from "./sections/LubrificacaoSection";
import { CargasComboioSection } from "./sections/CargasComboioSection";
import { PostosSection } from "./sections/PostosSection";
import { AbastecimentoSection } from "./sections/AbastecimentoSection";
import { PontosRhSection } from "./sections/PontosRhSection";
import { SolicitacoesPontoSection } from "./sections/SolicitacoesPontoSection";
import { ConfiguracoesSection } from "./sections/ConfiguracoesSection";
import { FrotaSection } from "./sections/FrotaSection";
import { FrentesTrabalhoSection } from "./sections/FrentesTrabalhoSection";
import { AlocacaoSection } from "./sections/AlocacaoSection";
import { RevisoesSection } from "./sections/RevisoesSection";
import { PreventivaSection } from "./sections/PreventivaSection";
import { PlanoPreventivoSection } from "./sections/PlanoPreventivoSection";
import { AuditoriaDevolucaoSection } from "./sections/AuditoriaDevolucaoSection";
import { EmergenciaTable } from "../../components/emergencia/EmergenciaTable";
import { PREFEITURA_BRAND, SECAO_LABEL, prefeituraNav } from "./prefeituraNav";
import "./prefeitura.css";
import { useLogin } from "../login/hooks/use-login";
import { useResolvedFlags } from "../../lib/api/feature-flags";
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

function SemAcesso({ titulo }: { titulo: string }) {
  return (
    <div>
      <h1>{titulo}</h1>
      <p style={{ color: "var(--text-gray)", maxWidth: "48rem" }}>
        🔒 Esta funcionalidade não está habilitada para o seu município. Fale com
        o administrador do Hora Útil 360 para liberá-la.
      </p>
    </div>
  );
}

const SLUG_FLAG: Record<string, string> = {
  "abastecimento-visao-geral": "abastecimento",
  abastecimento: "abastecimento",
  "consumo-custo": "abastecimento",
  credito: "abastecimento",
  lubrificacao: "abastecimento",
  "cargas-comboio": "abastecimento",
  postos: "abastecimento",
  "notas-fiscais": "abastecimento",
  equipamentos: "frota",
  "frentes-trabalho": "frota",
  alocacao: "frota",
  "abrir-os": "manutencao",
  "plano-preventivo": "manutencao",
  revisoes: "manutencao",
  preventiva: "manutencao",
  "auditoria-devolucao": "manutencao",
  orcamentos: "manutencao",
  "notas-fiscais-oficinas": "manutencao",
  funcionarios: "pessoas",
  "pontos-rh": "ponto",
  "solicitacoes-ponto": "ponto",
  "auditoria-checklists": "qualidade",
  riscos: "qualidade",
  emergencia: "qualidade",
};

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
  const { user, logout } = useLogin();
  const { obterDadosPrefeitura, prefeituraLabel } = useHU360();

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

  const { flags } = useResolvedFlags(prefeituraId);
  const pontoAtivo = flags.ponto;
  const abastecimentoAtivo = flags.abastecimento;
  const badges = usePrefeituraBadges(prefeituraId, pontoAtivo, abastecimentoAtivo);

  const dados = useMemo(
    () => (prefeituraId ? obterDadosPrefeitura(prefeituraId) : null),
    [prefeituraId, obterDadosPrefeitura],
  );

  function handleLogout() {
    logout(navigate);
  }

  if (!user) {
    return null;
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
              to="/login-prefeitura"
              style={{
                color: "var(--main-orange)",
                display: "block",
                marginTop: 12,
              }}
            >
              ← Voltar ao login
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const labelMunicipio = prefeituraLabel(prefeituraId);
  // Quando estamos numa rota dedicada de funcionário, o item ativo do menu
  // continua sendo "Funcionários".
  const secaoAtual =
    funcSubPagina || ehPontoDia
      ? "funcionarios"
      : equipNovo || equipEditId
        ? "equipamentos"
        : (secao ?? "dashboard");
  const navGroups = prefeituraNav(prefeituraId, {
    flags,
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
    const flagExigida = SLUG_FLAG[secaoAtual];
    if (flagExigida && !flags[flagExigida]) {
      return <SemAcesso titulo={SECAO_LABEL[secaoAtual] ?? "Sem acesso"} />;
    }
    switch (secaoAtual) {
      case "dashboard":
        return <DashboardSection prefeituraId={prefeituraId} />;
      case "abastecimento-visao-geral":
        return (
          <AbastecimentoVisaoGeralSection
            dados={dados!}
            prefeituraId={prefeituraId}
          />
        );
      case "consumo-custo":
        return (
          <ConsumoCustoSection dados={dados!} prefeituraId={prefeituraId} />
        );
      case "credito":
        return <CreditoSection dados={dados!} prefeituraId={prefeituraId} />;
      case "abastecimento":
        return (
          <AbastecimentoSection dados={dados!} prefeituraId={prefeituraId} />
        );
      case "lubrificacao":
        return (
          <LubrificacaoSection dados={dados!} prefeituraId={prefeituraId} />
        );
      case "cargas-comboio":
        return (
          <CargasComboioSection dados={dados!} prefeituraId={prefeituraId} />
        );
      case "postos":
        return <PostosSection dados={dados!} prefeituraId={prefeituraId} />;
      case "notas-fiscais":
        return <NotasFiscaisSection prefeituraId={prefeituraId} />;
      case "frota":
        return <FrotaSection prefeituraId={prefeituraId} />;
      case "frentes-trabalho":
        return <FrentesTrabalhoSection prefeituraId={prefeituraId} />;
      case "alocacao":
        return <AlocacaoSection prefeituraId={prefeituraId} />;
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
        return <AbrirOsSection prefeituraId={prefeituraId} />;
      case "plano-preventivo":
        return <PlanoPreventivoSection prefeituraId={prefeituraId} />;
      case "orcamentos":
        return <OrcamentosAprovacoesSection prefeituraId={prefeituraId} />;
      case "notas-fiscais-oficinas":
        return <NotasFiscaisOficinasSection prefeituraId={prefeituraId} />;
      case "pagamentos":
        return (
          <FinalizarOsSection dados={dados!} prefeituraId={prefeituraId} />
        );
      case "auditoria-devolucao":
        return <AuditoriaDevolucaoSection prefeituraId={prefeituraId} />;
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
        return <PontosRhSection prefeituraId={prefeituraId} />;
      case "solicitacoes-ponto":
        return <SolicitacoesPontoSection prefeituraId={prefeituraId} />;
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
          className="pf-sidebar"
          brand={PREFEITURA_BRAND}
          groups={navGroups}
          user={{ name: user.usuario, role: labelMunicipio }}
          onLogout={handleLogout}
        />

        <main id="main">
          {renderSecao()}
        </main>
      </div>
    </div>
  );
}
