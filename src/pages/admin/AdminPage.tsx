import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  isAdminAuthenticated,
  setAdminAuthenticated,
  verifyAdminSecret,
} from "../../admin/adminSession";
import {
  getAdminSecret,
  verifyAdminSecretWithBackend,
} from "../../lib/api/admin-secret";
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
  const [validando, setValidando] = useState(false);

  const hasAdminSecret = Boolean(getAdminSecret());
  const sessionAuthenticated =
    (isAdminAuthenticated() || user?.type === "admin") && hasAdminSecret;

  useEffect(() => {
    if (!sessionAuthenticated) return;
    if (auth.loading) return;
    if (auth.user) return;
    auth.loginPorUsuario(ADMIN_USUARIO_HU360, { persist: false });
  }, [sessionAuthenticated, auth.loading, auth.user, auth]);

  if (sessionAuthenticated) {
    return <AdminLayout />;
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (!senha.trim()) {
      setErro("Informe a senha administrativa.");
      return;
    }
    setValidando(true);
    try {
      const okLocal = verifyAdminSecret(senha);
      const ok =
        okLocal || (await verifyAdminSecretWithBackend(senha));
      if (!ok) {
        setErro("Senha administrativa incorreta.");
        return;
      }
      setAdminAuthenticated(senha);
      auth.loginPorUsuario(ADMIN_USUARIO_HU360, { persist: false });
      setSenha("");
    } catch {
      setErro("Não foi possível validar a senha. Tente novamente.");
    } finally {
      setValidando(false);
    }
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
            {user?.type === "admin"
              ? "Confirme a senha administrativa para acessar integrações com o servidor (suporte dos postos, WhatsApp, etc.)."
              : "Área restrita. Informe a senha administrativa (mesmo valor de ADMIN_SECRET no servidor)."}
          </p>
          <form onSubmit={(e) => void handleLogin(e)} className="admin-form">
            <label htmlFor="admin-senha">Senha administrativa</label>
            <input
              id="admin-senha"
              name="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(ev) => setSenha(ev.target.value)}
              placeholder="Senha de acesso"
              disabled={validando}
            />
            {erro ? (
              <p className="admin-error" role="alert">
                {erro}
              </p>
            ) : null}
            <button type="submit" className="admin-submit" disabled={validando}>
              {validando ? "Validando…" : "Entrar"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
