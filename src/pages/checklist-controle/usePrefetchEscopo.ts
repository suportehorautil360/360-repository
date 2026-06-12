import { useEffect } from "react";
import { prefetchEscopoOperador } from "./prefetch-escopo";

/**
 * Aquece o cache offline do Firestore com o escopo do operador ao abrir o app
 * (com rede) e sempre que a conexão voltar. Depois disso, busca de chassi e
 * emergência funcionam offline.
 */
export function usePrefetchEscopo(prefeituraId: string | undefined) {
  useEffect(() => {
    if (!prefeituraId) return;
    const aquecer = () => {
      void prefetchEscopoOperador(prefeituraId);
    };
    aquecer();
    window.addEventListener("online", aquecer);
    return () => window.removeEventListener("online", aquecer);
  }, [prefeituraId]);
}
