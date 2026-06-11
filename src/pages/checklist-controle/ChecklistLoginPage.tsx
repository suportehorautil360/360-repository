import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDoc, doc as firestoreDoc } from "firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import { funcionariosApi } from "../../lib/funcionarios/funcionarios";
import { formatarCpf, limparCpf } from "../../lib/funcionarios/cpf";
import type { OperadorSession } from "./useOperadorSession";
import { useOperadorSession } from "./useOperadorSession";
import {
  autenticarOffline,
  removerCredencialOffline,
  salvarCredencialOffline,
} from "./credenciais-offline";
import "../login/login.css";

const MOTIVO_MSG: Record<string, string> = {
  "nao-encontrado": "CPF ou login não encontrado. Verifique com o gestor.",
  "sem-senha": "Funcionário sem senha cadastrada. Procure o gestor.",
  "senha-invalida": "Identificador ou senha incorretos.",
  inativo: "Acesso inativo. Procure o gestor da prefeitura.",
};

export function ChecklistLoginPage() {
  const navigate = useNavigate();
  const { setSession } = useOperadorSession();

  // Identificador pode ser CPF (11 dígitos) OU login gerado (primeiroNome+3 últimos do CPF).
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  /** Detecta CPF: se a entrada tem ≥ 11 dígitos, formata como CPF. Senão, deixa cru. */
  const ehCpf = limparCpf(identificador).length === 11;
  const valorExibido = ehCpf ? formatarCpf(identificador) : identificador;

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

    function entrar(f: {
      nome: string;
      prefeituraId: string;
      id: string;
      cpf?: string;
      tipo?: OperadorSession["tipo"];
    }, empresaNome: string) {
      const sess: OperadorSession = {
        nome: f.nome,
        idCliente: f.prefeituraId,
        empresa: empresaNome,
        funcionarioId: f.id,
        cpf: f.cpf,
        tipo: f.tipo,
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
      const r = await funcionariosApi.autenticar(ident, senha);
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

      // Nome legível da prefeitura (fallback no próprio id).
      let empresaNome = f.prefeituraId || "Prefeitura";
      if (f.prefeituraId) {
        try {
          const cli = await getDoc(
            firestoreDoc(db, "clientes", f.prefeituraId),
          );
          const nome = cli.exists() ? String(cli.data().nome ?? "").trim() : "";
          if (nome) empresaNome = nome;
        } catch {
          /* usa fallback */
        }
      }

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

  return (
    <section className="auth-screen" aria-labelledby="checklist-login-title">
      <div className="auth-card">
        <h1 id="checklist-login-title" className="auth-title">
          Controle Checklist
        </h1>
        <p className="auth-subtitle">
          Entre com seu CPF ou login + senha para acessar o controle.
        </p>

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
      </div>
    </section>
  );
}
