import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  isAdminAuthenticated,
  setAdminAuthenticated,
} from "../../admin/adminSession";
import { getAdminSecret } from "../../lib/api/admin-secret";
import { useHU360Auth } from "../../lib/hu360";
import logoUrl from "../../assets/logo.jpeg";
import "./admin.css";
import { useLogin } from "../login/hooks/use-login";

/** Usuário do seed HU360 que recebe a sessão quando o admin entra. */
const ADMIN_USUARIO_HU360 = "admin";

/**
 * Login comum do admin: usuário + senha (Firestore), igual aos outros portais.
 * A senha administrativa (ADMIN_SECRET) deixa de ser a tela de entrada.
 */
export function AdminLoginPage() {
  const auth = useHU360Auth();
  const navigate = useNavigate();
  const { user, handleLogin } = useLogin();

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [validando, setValidando] = useState(false);

  const jaAutenticado = user?.type === "admin" || isAdminAuthenticated();

  useEffect(() => {
    if (!jaAutenticado) return;
    if (auth.loading) return;
    if (auth.user) return;
    auth.loginPorUsuario(ADMIN_USUARIO_HU360, { persist: false });
  }, [jaAutenticado, auth.loading, auth.user, auth]);

  if (jaAutenticado) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro("");

    const loginUsuario = usuario.trim();
    if (!loginUsuario || !senha) {
      setErro("Preencha usuário e senha.");
      return;
    }

    setValidando(true);
    try {
      // navigate no-op: decidimos o destino depois de validar o type
      const result = await handleLogin(loginUsuario, senha, (() => {}) as never);
      if (result?.error) {
        setErro(result.error);
        return;
      }

      const logado = useLogin.getState().user;
      if (!logado || logado.type !== "admin") {
        useLogin.setState({ user: null });
        setErro("Acesso apenas para administradores.");
        return;
      }

      const secret = getAdminSecret();
      setAdminAuthenticated(secret || undefined);
      auth.loginPorUsuario(ADMIN_USUARIO_HU360, { persist: false });
      setSenha("");
      navigate("/admin/dashboard", { replace: true });
    } catch {
      setErro("Não foi possível entrar. Tente novamente.");
    } finally {
      setValidando(false);
    }
  }

  return (
    <div className="admin-root">
      <header className="admin-header">
        <Link to="/login-prefeitura" className="admin-back">
          ← Voltar ao login da prefeitura
        </Link>
      </header>

      <section
        className="admin-screen admin-screen--bg"
        aria-labelledby="admin-login-title"
        style={{ backgroundImage: `url(${logoUrl})` }}
      >
        <div className="admin-card">
          <h1 id="admin-login-title" className="admin-title">
            Painel administrativo
          </h1>
          <p className="admin-lead">
            Entre com usuário e senha de administrador para acessar o hub.
          </p>
          <form onSubmit={(e) => void handleSubmit(e)} className="admin-form">
            <label htmlFor="admin-usuario">Usuário</label>
            <input
              id="admin-usuario"
              name="usuario"
              autoComplete="username"
              value={usuario}
              onChange={(ev) => {
                setUsuario(ev.target.value);
                setErro("");
              }}
              placeholder="Digite seu usuário"
              disabled={validando}
            />
            <label htmlFor="admin-senha">Senha</label>
            <input
              id="admin-senha"
              name="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(ev) => {
                setSenha(ev.target.value);
                setErro("");
              }}
              placeholder="Digite sua senha"
              disabled={validando}
            />
            {erro ? (
              <p className="admin-error" role="alert">
                {erro}
              </p>
            ) : null}
            <button type="submit" className="admin-submit" disabled={validando}>
              {validando ? "Autenticando…" : "Entrar"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
