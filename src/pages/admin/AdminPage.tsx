import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  isAdminAuthenticated,
  isAdminSecretConfigured,
  setAdminAuthenticated,
  verifyAdminSecret,
} from "../../admin/adminSession";
import { useHU360Auth } from "../../lib/hu360";
import { AdminLayout } from "./AdminLayout";
import logoUrl from "../../assets/logo.jpeg";
import "./admin.css";
import { useLogin } from "../login/hooks/use-login";

/** Usuário do seed HU360 que recebe a sessão quando o admin entra via env. */
const ADMIN_USUARIO_HU360 = "admin";

export function AdminPage() {
  const auth = useHU360Auth();
  const { user } = useLogin();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const secretOk = isAdminSecretConfigured();
  const sessionAuthenticated = isAdminAuthenticated() || user?.type === "admin";

  useEffect(() => {
    if (!sessionAuthenticated) return;
    if (auth.loading) return;
    if (auth.user) return;
    auth.loginPorUsuario(ADMIN_USUARIO_HU360);
  }, [sessionAuthenticated, auth.loading, auth.user, auth]);

  if (sessionAuthenticated) {
    return <AdminLayout />;
  }
  function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (!secretOk) {
      setErro(
        "Defina VITE_ADMIN_SECRET no arquivo .env na raiz do projeto e reinicie o servidor.",
      );
      return;
    }
    if (!verifyAdminSecret(senha)) {
      setErro("Senha incorreta.");
      return;
    }
    setAdminAuthenticated();
    auth.loginPorUsuario(ADMIN_USUARIO_HU360);
    setSenha("");
  }

  return (
    <div className="admin-root">
      <header className="admin-header">
        <Link to="/" className="admin-back">
          ← Voltar ao portal
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
            Área restrita. Informe a senha configurada em{" "}
            <code className="admin-code">VITE_ADMIN_SECRET</code> no seu{" "}
            <code className="admin-code">.env</code> local.
          </p>
          {!secretOk ? (
            <p className="admin-warn" role="alert">
              Nenhuma senha foi configurada. Crie um arquivo{" "}
              <code className="admin-code">.env</code> na raiz com:{" "}
              <code className="admin-code">
                VITE_ADMIN_SECRET=sua_senha_forte
              </code>
            </p>
          ) : null}
          <form onSubmit={handleLogin} className="admin-form">
            <label htmlFor="admin-senha">Senha</label>
            <input
              id="admin-senha"
              name="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(ev) => setSenha(ev.target.value)}
              placeholder="Senha de acesso"
            />
            {erro ? (
              <p className="admin-error" role="alert">
                {erro}
              </p>
            ) : null}
            <button type="submit" className="admin-submit">
              Entrar
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
