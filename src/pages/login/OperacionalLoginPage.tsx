import { type FormEvent, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import "./login.css";
import { useLogin } from "./hooks/use-login";

type DestinoOperacional = "locacao" | "oficina" | "posto";

type DestinoConfig = {
  titulo: string;
  subtitulo: string;
};

const DESTINOS: Record<DestinoOperacional, DestinoConfig> = {
  locacao: {
    titulo: "Login da Locadora",
    subtitulo: "Acesse com o seu usuário para abrir o dashboard de locação.",
  },
  oficina: {
    titulo: "Login da Oficina",
    subtitulo: "Acesse com o seu usuário para abrir o dashboard da oficina.",
  },
  posto: {
    titulo: "Login do Posto",
    subtitulo: "Acesse com o seu usuário para abrir o dashboard do posto.",
  },
};

function parseDestino(raw: string | null): DestinoOperacional {
  if (raw === "oficina") return "oficina";
  if (raw === "posto") return "posto";
  return "locacao";
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

    const result = await handleLogin(loginUsuario, senha, navigate);

    setLoading(false);
    if (result?.error) {
      setMensagem(result.error);
    } else {
      setMensagem("");
      setSenha("");
    }
    // Não navega aqui — handleLogin já navegou para a rota correta com o id
  }

  if (user?.id) {
    const destPath =
      user.type === "oficina"
        ? `/oficina/${user.prefeituraId}`
        : user.type === "posto"
          ? `/posto/${user.prefeituraId}`
          : user.type === "locacao"
            ? `/locacao/${user.prefeituraId}`
            : "/";
    return <Navigate to={destPath} replace />;
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
          <Link to="/login-operacional?destino=locacao">Locadora</Link>
          {" · "}
          <Link to="/login-operacional?destino=oficina">Oficina</Link>
          {" · "}
          <Link to="/login-operacional?destino=posto">Posto</Link>
          {" · "}
          <Link to="/">Voltar ao portal inicial</Link>
        </p>
      </div>
    </section>
  );
}
