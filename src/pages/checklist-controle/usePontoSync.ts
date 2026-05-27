import { useCallback, useEffect, useState } from "react";
import { pendentes, sincronizar } from "../../lib/api/pontos-fila";

/**
 * Sincroniza a fila offline de ponto ao montar e quando a conexão volta,
 * e expõe quantas batidas estão aguardando envio.
 */
export function usePontoSync() {
  const [qtd, setQtd] = useState(() => pendentes());

  const atualizar = useCallback(() => setQtd(pendentes()), []);

  useEffect(() => {
    let vivo = true;
    const flush = () => {
      void sincronizar().then(() => {
        if (vivo) setQtd(pendentes());
      });
    };
    flush();
    window.addEventListener("online", flush);
    return () => {
      vivo = false;
      window.removeEventListener("online", flush);
    };
  }, []);

  return { pendentes: qtd, atualizar };
}
