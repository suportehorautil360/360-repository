import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useLogin } from "../login/hooks/use-login";
import { PrefeituraLoginNetwork } from "./PrefeituraLoginNetwork";
import "./prefeitura-login.css";

export function PrefeituraLoginPage() {
  const navigate = useNavigate();
  const { user, handleLogin } = useLogin();

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const loginUsuario = usuario.trim();
    if (!loginUsuario || !senha) {
      setMensagem("Preencha usuário e senha.");
      return;
    }

    setLoading(true);
    setMensagem("Autenticando…");

    const result = await handleLogin(loginUsuario, senha, navigate);

    setLoading(false);
    if (result?.error) {
      setMensagem(result.error);
      return;
    }

    setMensagem("");
    setSenha("");
  }

  if (user?.type === "prefeitura" && user.prefeituraId) {
    return (
      <Navigate
        to={`/prefeitura/${user.prefeituraId}/dashboard`}
        replace
      />
    );
  }

  return (
    <section className="pf-login" aria-labelledby="prefeitura-login-title">
      <div className="pf-login-visual">
        <PrefeituraLoginNetwork />
      </div>

      <div className="pf-login-visual-copy">
        <h2>
          Tudo conectado em <span>um só lugar</span>
        </h2>
        <p>
          Frota, abastecimento, ordens de serviço e equipes — gestão
          municipal integrada no Hora Útil 360.
        </p>
      </div>

      <div className="pf-login-panel">
        <div className="pf-login-card">
          <div className="pf-login-brand">
            <img src="/logo.png" alt="Hora Útil" />
            <h1 id="prefeitura-login-title">Portal da Prefeitura</h1>
            <p>Acesse com seu usuário para entrar no painel municipal.</p>
          </div>

          <form onSubmit={handleSubmit} className="pf-login-form">
            <label htmlFor="prefeitura-usuario">
              Usuário
              <input
                id="prefeitura-usuario"
                required
                autoComplete="username"
                placeholder="Digite seu usuário"
                value={usuario}
                onChange={(event) => {
                  setUsuario(event.target.value);
                  setMensagem("");
                }}
              />
            </label>

            <label htmlFor="prefeitura-senha">
              Senha
              <input
                id="prefeitura-senha"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(event) => {
                  setSenha(event.target.value);
                  setMensagem("");
                }}
              />
            </label>

            <button
              className="pf-login-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? "Entrando…" : "Entrar no painel"}
            </button>

            <div
              className={`pf-login-msg${mensagem && mensagem !== "Autenticando…" ? " is-error" : ""}`}
              role="status"
            >
              {mensagem}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
