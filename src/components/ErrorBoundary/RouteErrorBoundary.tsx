import { Component, type ErrorInfo, type ReactNode } from "react";
import "./route-error-boundary.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Captura erros de renderização das rotas — em especial falhas ao baixar um
 * chunk lazy (ex.: área não pré-cacheada acessada offline). Em vez de tela
 * branca, mostra um aviso amigável com opção de tentar de novo.
 *
 * Error boundaries precisam ser componentes de classe.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha ao carregar a rota:", error, info);
  }

  handleRetry = () => {
    // Recarrega para tentar baixar o chunk novamente (ex.: a internet voltou).
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="route-error" role="alert">
        <div className="route-error__card">
          <h1 className="route-error__title">
            Não foi possível carregar esta tela
          </h1>
          <p className="route-error__text">
            Verifique sua conexão e tente novamente. Algumas áreas precisam de
            internet na primeira vez.
          </p>
          <button
            type="button"
            className="route-error__btn"
            onClick={this.handleRetry}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }
}
