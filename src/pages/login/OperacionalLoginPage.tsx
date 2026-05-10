import { type FormEvent, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import "./login.css";
import { useLogin } from "./hooks/use-login";

type DestinoOperacional = "locacao" | "oficina";

type DestinoConfig = {
  path: string;
  titulo: string;
  subtitulo: string;
  alternarLabel: string;
  alternarHref: string;
};

const DESTINOS: Record<DestinoOperacional, DestinoConfig> = {
  locacao: {
    path: "/locacao",
    titulo: "Login da Locadora",
    subtitulo:
      "Acesse com o mesmo usuário do Hub para abrir o dashboard de locação.",
    alternarLabel: "Entrar no dashboard da Oficina",
    alternarHref: "/login-operacional?destino=oficina",
  },
  oficina: {
    path: "/oficina",
    titulo: "Login da Oficina",
    subtitulo:
      "Acesse com o mesmo usuário do Hub para abrir o dashboard da oficina.",
    alternarLabel: "Entrar no dashboard da Locadora",
    alternarHref: "/login-operacional?destino=locacao",
  },
};

function parseDestino(raw: string | null): DestinoOperacional {
  return raw === "oficina" ? "oficina" : "locacao";
}

export function OperacionalLoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, handleLogin } = useLogin();

  const destino = parseDestino(searchParams.get("destino"));
  const cfg = useMemo(() => DESTINOS[destino], [destino]);

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
    setMensagem("Autenticando...");

    await handleLogin(loginUsuario, senha, navigate);

    setLoading(false);
    setMensagem("");
    setSenha("");
    navigate(cfg.path, { replace: true });
  }

  if (user?.id) {
    console.log("USER ALREADY LOGGED IN:", user);
    return <Navigate to={cfg.path} replace />;
  }

  return (
    <section className="auth-screen" aria-labelledby="operacional-login-title">
      <div className="auth-card">
        <h1 id="operacional-login-title" className="auth-title">
          {cfg.titulo}
        </h1>
        <p className="auth-subtitle">{cfg.subtitulo}</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="operacional-usuario">Usuário</label>
          <input
            id="operacional-usuario"
            required
            autoComplete="username"
            placeholder="Digite seu usuário"
            value={usuario}
            onChange={(event) => setUsuario(event.target.value)}
          />

          <label htmlFor="operacional-senha">Senha</label>
          <input
            id="operacional-senha"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Digite sua senha"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
          />

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div id="authMsg" className="status" role="status">
            {mensagem}
          </div>
        </form>

        <p className="quick-access">
          {destino === "locacao" ? "Locadora" : "Oficina"}: use o mesmo usuário
          do Hub.
        </p>

        <p className="quick-access">
          <Link to={cfg.alternarHref}>{cfg.alternarLabel}</Link>
          {" · "}
          <Link to="/">Voltar ao portal inicial</Link>
        </p>
      </div>
    </section>
  );
}
