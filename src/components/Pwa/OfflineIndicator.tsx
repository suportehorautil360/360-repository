import { useEffect, useState } from "react";
import "./offline-indicator.css";

/** Badge fixo que aparece só quando o navegador está sem conexão. */
export function OfflineIndicator() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="pwa-offline" role="status" aria-live="polite">
      <span className="pwa-offline__dot" aria-hidden="true" />
      Offline — alterações serão sincronizadas ao reconectar
    </div>
  );
}
