import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { funcionariosApi } from "../../lib/funcionarios/funcionarios";
import { formatarCpf, limparCpf } from "../../lib/funcionarios/cpf";
import { autenticarViaSupabase } from "../../lib/supabase/checklist-login-adapter";
import type { OperadorSession } from "./useOperadorSession";
import { useOperadorSession } from "./useOperadorSession";
import {
  autenticarOffline,
  removerCredencialOffline,
  salvarCredencialOffline,
} from "./credenciais-offline";
import { NomeOperadorDialog } from "./NomeOperadorDialog";
import "../login/login.css";

const MOTIVO_MSG: Record<string, string> = {
  "nao-encontrado": "CPF ou login não encontrado. Verifique com o gestor.",
  "sem-senha": "Funcionário sem senha cadastrada. Procure o gestor.",
  "senha-invalida": "Identificador ou senha incorretos.",
  inativo: "Acesso inativo. Procure o gestor da prefeitura.",
  "multi-empresa": "Cadastro em mais de uma empresa. Escolha abaixo.",
};

type OpcaoEmpresa = {
  companyId: string;
  companyLegacyId: string | null;
  companyName: string | null;
  operatorId: string;
  nome: string;
};

const MOTIVO_CHASSI: Record<string, string> = {
  "nao-encontrado": "Chassi não encontrado. Confirme o número com o gestor.",
  conflito: "Chassi vinculado a mais de uma empresa. Contate o suporte.",
  "nao-habilita": "Esse chassi não permite login direto. Use CPF/Login.",
  "sem-conexao":
    "Sem conexão. Esse aparelho não conhece esse chassi — conecte à internet ou peça pra alguém logar online primeiro.",
  erro: "Não foi possível validar o chassi. Tente novamente.",
};

const LAST_MODO_KEY = "hu360-checklist-login-modo";

type Modo = "cpf" | "chassi";

export function ChecklistLoginPage() {
  const navigate = useNavigate();
  const { setSession } = useOperadorSession();

  const [modo, setModo] = useState<Modo>(() => {
    if (typeof localStorage === "undefined") return "cpf";
    return localStorage.getItem(LAST_MODO_KEY) === "chassi" ? "chassi" : "cpf";
  });
  useEffect(() => {
    localStorage.setItem(LAST_MODO_KEY, modo);
  }, [modo]);

  // --- CPF / Senha (fluxo original preservado) ---
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  // Quando o mesmo CPF/login existe em mais de uma empresa, guardamos as
  // opções aqui pra renderizar um mini-dialog de escolha (fluxo v4 da Edge).
  const [opcoesEmpresa, setOpcoesEmpresa] = useState<OpcaoEmpresa[] | null>(
    null,
  );

  const ehCpf = limparCpf(identificador).length === 11;
  const valorExibido = ehCpf ? formatarCpf(identificador) : identificador;

  // --- Chassi ---
  const [chassi, setChassi] = useState("");
  const [loadingChassi, setLoadingChassi] = useState(false);
  const [erroChassi, setErroChassi] = useState("");
  const [resolvido, setResolvido] = useState<
    | null
    | { empresaId: string; empresaNome: string; idMaquina: string; chassi: string }
  >(null);
  const [modalNomeAberto, setModalNomeAberto] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ident = identificador.trim();
    if (!ident) {
      setErro("Informe seu CPF ou login.");
      return;
    }
    if (!senha) {
      setErro("Informe a senha.");
      return;
    }
    await tentarLogin(ident, senha, undefined);
  }

  async function escolherEmpresa(opcao: OpcaoEmpresa) {
    setOpcoesEmpresa(null);
    await tentarLogin(identificador.trim(), senha, opcao.companyId);
  }

  async function tentarLogin(
    ident: string,
    senhaAtual: string,
    companyId: string | undefined,
  ) {
    setErro("");
    setLoading(true);

    function entrar(
      f: {
        nome: string;
        prefeituraId: string;
        id: string;
        cpf?: string;
        tipo?: OperadorSession["tipo"];
      },
      empresaNome: string,
    ) {
      const sess: OperadorSession = {
        nome: f.nome,
        idCliente: f.prefeituraId,
        empresa: empresaNome,
        funcionarioId: f.id,
        cpf: f.cpf,
        tipo: f.tipo,
        modoLogin: "cpf-senha",
      };
      setSession(sess);
      navigate("/checklist-controle", { replace: true });
    }

    // Sem rede, a credencial guardada no aparelho (último login online,
    // válida por 7 dias) permite entrar offline.
    async function tentarOffline(): Promise<boolean> {
      const off = await autenticarOffline(ident, senhaAtual).catch(() => null);
      if (!off) return false;
      entrar(off.funcionario, off.empresa);
      return true;
    }

    try {
      const r = await autenticarViaSupabase(ident, senhaAtual, companyId);
      if (!r.ok) {
        // Multi-empresa: mostra seletor sem gastar tentativa de erro.
        if (r.motivo === "multi-empresa" && r.opcoes) {
          setOpcoesEmpresa(r.opcoes as OpcaoEmpresa[]);
          setLoading(false);
          return;
        }
        // Offline, a consulta pode resolver "vazia" pelo cache do Firestore
        // — antes de negar, tenta a credencial offline. Se também não der,
        // a mensagem explica a regra do offline (dizer "não encontrado"
        // faria o operador achar que o cadastro sumiu).
        if (!navigator.onLine) {
          if (await tentarOffline()) return;
          setErro(
            "Sem conexão. Para entrar offline é preciso já ter feito login neste aparelho nos últimos 7 dias.",
          );
          setLoading(false);
          return;
        }
        // O servidor negou de verdade: a credencial local não vale mais.
        if (r.motivo === "senha-invalida" || r.motivo === "inativo") {
          removerCredencialOffline(ident);
        }
        setErro(MOTIVO_MSG[r.motivo] ?? "Não foi possível entrar.");
        setLoading(false);
        return;
      }

      const f = r.funcionario;

      // Nome legível da prefeitura vem no mesmo round-trip do login-operador.
      const empresaNome =
        (r as { companyName?: string | null }).companyName ??
        f.prefeituraId ??
        "Prefeitura";

      // Guarda a credencial para os próximos logins sem rede (best-effort).
      try {
        await salvarCredencialOffline({ funcionario: f, empresa: empresaNome, senha: senhaAtual });
      } catch {
        /* sem espaço — login offline fica indisponível, login normal segue */
      }

      entrar(f, empresaNome);
    } catch {
      if (await tentarOffline()) return;
      if (!navigator.onLine) {
        setErro(
          "Sem conexão. Para entrar offline é preciso já ter feito login neste aparelho nos últimos 7 dias.",
        );
      } else {
        setErro("Erro ao consultar o banco de dados. Tente novamente.");
      }
      setLoading(false);
    }
  }

  async function handleSubmitChassi(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const c = chassi.trim();
    if (!c) {
      setErroChassi("Digite o chassi da máquina.");
      return;
    }
    setErroChassi("");
    setLoadingChassi(true);
    try {
      const r = await funcionariosApi.autenticarPorChassi(c);
      if (!r.ok) {
        setErroChassi(MOTIVO_CHASSI[r.motivo] ?? "Não foi possível validar o chassi.");
        return;
      }
      setResolvido({
        empresaId: r.empresaId,
        empresaNome: r.empresaNome,
        idMaquina: r.idMaquina,
        chassi: r.chassi,
      });
      setModalNomeAberto(true);
    } finally {
      setLoadingChassi(false);
    }
  }

  function onConfirmarNome(nome: string) {
    if (!resolvido) return;
    const sess: OperadorSession = {
      nome,
      idCliente: resolvido.empresaId,
      empresa: resolvido.empresaNome,
      idMaquina: resolvido.idMaquina,
      chassis: resolvido.chassi,
      modoLogin: "chassi",
      nomeInformado: nome,
    };
    setSession(sess);
    setModalNomeAberto(false);
    navigate("/checklist-controle", { replace: true });
  }

  const toggleWrap: React.CSSProperties = {
    display: "flex",
    gap: 4,
    marginBottom: 16,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    padding: 3,
  };
  const toggleBtn = (ativo: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "8px 12px",
    borderRadius: 6,
    border: "none",
    background: ativo ? "var(--primary)" : "transparent",
    color: ativo ? "#1a1205" : "inherit",
    cursor: "pointer",
    fontWeight: ativo ? 600 : 400,
    fontSize: "0.9rem",
    transition: "background 120ms ease",
  });

  return (
    <section className="auth-screen" aria-labelledby="checklist-login-title">
      <div className="auth-card">
        <h1 id="checklist-login-title" className="auth-title">
          Controle Checklist
        </h1>
        <p className="auth-subtitle">
          {modo === "cpf"
            ? "Entre com seu CPF ou login + senha para acessar o controle."
            : "Digite o chassi da máquina para acessar o controle."}
        </p>

        <div style={toggleWrap} role="tablist" aria-label="Modo de login">
          <button
            type="button"
            role="tab"
            aria-selected={modo === "cpf"}
            onClick={() => setModo("cpf")}
            style={toggleBtn(modo === "cpf")}
          >
            CPF / Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === "chassi"}
            onClick={() => setModo("chassi")}
            style={toggleBtn(modo === "chassi")}
          >
            Chassi
          </button>
        </div>

        {modo === "cpf" ? (
          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="checklist-id">CPF ou Login</label>
            <input
              id="checklist-id"
              inputMode={ehCpf ? "numeric" : "text"}
              autoComplete="username"
              placeholder="CPF (000.000.000-00) ou login (joao123)"
              value={valorExibido}
              onChange={(e) => {
                setIdentificador(e.target.value);
                setErro("");
              }}
            />
            <label htmlFor="checklist-senha">Senha</label>
            <input
              id="checklist-senha"
              type="password"
              autoComplete="current-password"
              placeholder="Sua senha"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                setErro("");
              }}
            />
            {erro && (
              <span
                style={{
                  color: "var(--danger, #ef4444)",
                  fontSize: "0.82rem",
                  marginTop: "-6px",
                }}
              >
                {erro}
              </span>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Verificando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmitChassi} className="auth-form">
            <label htmlFor="checklist-chassi">Chassi da máquina</label>
            <input
              id="checklist-chassi"
              autoComplete="off"
              placeholder="Ex.: 9BWZZZ377VT004251"
              value={chassi}
              onChange={(e) => {
                setChassi(e.target.value.toUpperCase().replace(/\s+/g, ""));
                setErroChassi("");
              }}
            />
            {erroChassi && (
              <span
                style={{
                  color: "var(--danger, #ef4444)",
                  fontSize: "0.82rem",
                  marginTop: "-6px",
                }}
              >
                {erroChassi}
              </span>
            )}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loadingChassi}
            >
              {loadingChassi ? "Verificando..." : "Entrar"}
            </button>
          </form>
        )}

        <NomeOperadorDialog
          open={modalNomeAberto}
          onConfirmar={onConfirmarNome}
          onCancelar={() => setModalNomeAberto(false)}
        />

        {opcoesEmpresa ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="escolher-empresa-title"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: 16,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpcoesEmpresa(null);
            }}
          >
            <div
              style={{
                background: "var(--surface, #1a1b26)",
                borderRadius: 12,
                padding: 24,
                maxWidth: 420,
                width: "100%",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <h2
                id="escolher-empresa-title"
                style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}
              >
                Escolha a empresa
              </h2>
              <p
                style={{
                  margin: "6px 0 16px",
                  fontSize: "0.85rem",
                  opacity: 0.75,
                }}
              >
                Seu CPF ou login está cadastrado em mais de uma empresa.
                Selecione qual você quer acessar agora.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {opcoesEmpresa.map((op) => (
                  <button
                    key={op.companyId}
                    type="button"
                    onClick={() => escolherEmpresa(op)}
                    disabled={loading}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.04)",
                      color: "inherit",
                      cursor: loading ? "not-allowed" : "pointer",
                      textAlign: "left",
                      fontSize: "0.95rem",
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {op.companyName ?? "Empresa"}
                    </div>
                    <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                      Perfil: {op.nome}
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOpcoesEmpresa(null)}
                disabled={loading}
                style={{
                  marginTop: 16,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  opacity: 0.7,
                  width: "100%",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
