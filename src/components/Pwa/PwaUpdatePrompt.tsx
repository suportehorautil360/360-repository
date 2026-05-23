import { useRegisterSW } from "virtual:pwa-register/react";
import "./pwa-update-prompt.css";

/**
 * Aviso discreto de PWA:
 * - "App pronto para uso offline" (ao instalar o service worker).
 * - "Nova versão disponível → Atualizar" (quando há build novo em cache).
 *
 * Com registerType: 'prompt', nada recarrega sozinho — o usuário decide.
 */
export function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

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
