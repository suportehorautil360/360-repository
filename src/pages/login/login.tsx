import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { setAdminAuthenticated } from "../../admin/adminSession";
import {
  type AuthMessageTone,
  tratarUsuarioApiPosto,
} from "../../portal/postoLoginFlow";
import { carregarUsuarios } from "../../portal/postoPortalLegacy";
import "./login.css";
import { useLogin } from "./hooks/use-login";

/** Credenciais que abrem o painel administrativo (`/admin`). */
const ADMIN_LOGIN_EMAIL = "jeffersonadmin@adm.com";
const ADMIN_LOGIN_PASSWORD = "1234";

/** Props da camada de interface — apenas dados e callbacks, sem lógica de negócio. */
export type LoginViewProps = {
  usuario: string;
  senha: string;
  mensagemAuth: string;
  mensagemTone: AuthMessageTone;
  onUsuarioChange: (value: string) => void;
  onSenhaChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

/** Apresentação: marcação e classes do protótipo estático. */
export function LoginView({
  usuario,
  senha,
  mensagemAuth,
  mensagemTone,
  onUsuarioChange,
  onSenhaChange,
}: LoginViewProps) {
  const navigate = useNavigate();
  const { handleLogin } = useLogin();
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const statusClass =
    mensagemTone !== "none" ? `status status--${mensagemTone}` : "status";

  return (
    <section
      id="authScreen"
      className="auth-screen"
      aria-labelledby="auth-heading"
    >
      <div className="auth-card">
        <h1 id="auth-heading" className="auth-title">
          Acesso ao Controle
        </h1>
        <p className="auth-subtitle">
          Entre com login e senha para abrir o painel.
        </p>
        <form
          id="loginForm"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoginError("");
            setLoading(true);
            const result = await handleLogin(usuario, senha, navigate);
            setLoading(false);
            if (result?.error) setLoginError(result.error);
          }}
          className="auth-form"
        >
          <label htmlFor="loginUsuario">Usuario</label>
          <input
            id="loginUsuario"
            name="usuario"
            required
            autoComplete="username"
            placeholder="Digite seu usuario"
            value={usuario}
            onChange={(e) => onUsuarioChange(e.target.value)}
          />
          <label htmlFor="loginSenha">Senha</label>
          <input
            id="loginSenha"
            name="senha"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Digite sua senha"
            value={senha}
            onChange={(e) => {
              onSenhaChange(e.target.value);
              setLoginError("");
            }}
          />
          {loginError && (
            <span
              style={{
                color: "var(--danger, #ef4444)",
                fontSize: "0.82rem",
                marginTop: "-6px",
              }}
            >
              {loginError}
            </span>
          )}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Autenticando..." : "Entrar no painel"}
          </button>
          <div id="authMsg" className={statusClass} role="status">
            {mensagemAuth}
          </div>
        </form>
        <p className="quick-access">
          <Link
            to="/checklist-login"
            style={{ color: "var(--secondary, #3b82f6)", fontWeight: 600 }}
          >
            Controle checklist operacional (operador)
          </Link>
          {" · "}
        </p>
      </div>
    </section>
  );
}

function useLoginForm(
  resetNonce: number,
  navigate: ReturnType<typeof useNavigate>,
): LoginViewProps {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagemAuth, setMensagemAuth] = useState("");
  const [mensagemTone, setMensagemTone] = useState<AuthMessageTone>("none");

  useEffect(() => {
    setUsuario("");
    setSenha("");
    setMensagemAuth("");
    setMensagemTone("none");
  }, [resetNonce]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagemAuth("");
    setMensagemTone("none");

    const u = usuario.trim();
    if (!u || !senha) {
      setMensagemAuth("Preencha usuário e senha.");
      setMensagemTone("error");
      return;
    }

    if (
      u.toLowerCase() === ADMIN_LOGIN_EMAIL.toLowerCase() &&
      senha === ADMIN_LOGIN_PASSWORD
    ) {
      setAdminAuthenticated();
      navigate("/admin", { replace: true });
      return;
    }

    const sync = window.HU360Sync;
    if (sync?.apiEnabled()) {
      setMensagemAuth("Autenticando...");
      setMensagemTone("loading");
      try {
        const res = await sync.login(u, senha);
        if (!res.ok || !res.user) {
          setMensagemAuth(res?.msg ?? "Login ou senha inválidos.");
          setMensagemTone("error");
          return;
        }
        const feedback = tratarUsuarioApiPosto(res.user);
        if (feedback) {
          setMensagemAuth(feedback.text);
          setMensagemTone(feedback.tone);
          return;
        }
        setMensagemAuth("");
        setMensagemTone("none");
      } catch {
        setMensagemAuth("Erro de rede ou servidor.");
        setMensagemTone("error");
      }
      return;
    }

    const user = carregarUsuarios().find(
      (row) => row.usuario === u && row.senha === senha,
    );
    if (!user) {
      setMensagemAuth("Login ou senha inválidos.");
      setMensagemTone("error");
      return;
    }
    const feedback = tratarUsuarioApiPosto(user);
    if (feedback) {
      setMensagemAuth(feedback.text);
      setMensagemTone(feedback.tone);
      return;
    }
    setMensagemAuth("");
    setMensagemTone("none");
  }

  return {
    usuario,
    senha,
    mensagemAuth,
    mensagemTone,
    onUsuarioChange: setUsuario,
    onSenhaChange: setSenha,
    onSubmit: handleSubmit,
  };
}

type LoginProps = {
  resetNonce?: number;
};

export default function Login({ resetNonce = 0 }: LoginProps) {
  const navigate = useNavigate();
  const form = useLoginForm(resetNonce, navigate);
  return <LoginView {...form} />;
}
