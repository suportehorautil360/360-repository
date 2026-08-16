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
      const off = await autenticarOffline(ident, senha).catch(() => null);
      if (!off) return false;
      entrar(off.funcionario, off.empresa);
      return true;
    }

    try {
      const r = await autenticarViaSupabase(ident, senha);
      if (!r.ok) {
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
        await salvarCredencialOffline({ funcionario: f, empresa: empresaNome, senha });
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
      </div>
    </section>
  );
}
