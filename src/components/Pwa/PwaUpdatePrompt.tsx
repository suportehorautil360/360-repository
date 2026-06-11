import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { podeAtualizarComSeguranca } from "./atualizacao-segura";
import "./pwa-update-prompt.css";

// Sem checagem ativa, o navegador só procura SW novo em navegação/reabertura
// — usuário com o app aberto ficava dias na versão velha após o deploy.
const INTERVALO_CHECAGEM_MS = 60 * 60 * 1000;
// Com update pendente e trabalho em andamento, re-testa a cada 30s se já
// ficou seguro recarregar.
const INTERVALO_APLICACAO_MS = 30 * 1000;

/**
 * Atualização do PWA pós-deploy:
 * - checa por versão nova de hora em hora, ao voltar o foco e ao voltar a rede;
 * - havendo versão nova, aplica sozinho assim que não houver trabalho não
 *   salvo (checklist/emergência em preenchimento — ver atualizacao-segura);
 * - enquanto não dá para recarregar, mostra o aviso com o botão "Atualizar".
 */
export function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const checar = () => {
        registration.update().catch(() => {
          /* offline — tenta na próxima */
        });
      };
      setInterval(checar, INTERVALO_CHECAGEM_MS);
      window.addEventListener("online", checar);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checar();
      });
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    const aplicarSePossivel = () => {
      if (podeAtualizarComSeguranca()) void updateServiceWorker(true);
    };
    aplicarSePossivel();
    const timer = setInterval(aplicarSePossivel, INTERVALO_APLICACAO_MS);
    return () => clearInterval(timer);
  }, [needRefresh, updateServiceWorker]);

  function close() {
    setOfflineReady(false);
    setNeedRefresh(false);
  }

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="pwa-toast" role="alert" aria-live="polite">
      <span className="pwa-toast__msg">
        {needRefresh
          ? "Nova versão disponível."
          : "App pronto para uso offline."}
      </span>
      <div className="pwa-toast__actions">
        {needRefresh && (
          <button
            type="button"
            className="pwa-toast__btn pwa-toast__btn--primary"
            onClick={() => updateServiceWorker(true)}
          >
            Atualizar
          </button>
        )}
        <button type="button" className="pwa-toast__btn" onClick={close}>
          Fechar
        </button>
      </div>
    </div>
  );
}
