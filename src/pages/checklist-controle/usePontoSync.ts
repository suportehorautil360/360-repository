import { useCallback, useEffect, useState } from "react";
import { pendentes, sincronizar } from "../../lib/api/pontos-fila";

/**
 * Sincroniza a fila offline de ponto ao montar, quando a conexão volta e a
 * cada 5 minutos com a tela aberta; expõe quantas batidas aguardam envio.
 */
export function usePontoSync() {
  const [qtd, setQtd] = useState(0);

  const atualizar = useCallback(() => {
    void pendentes().then(setQtd);
  }, []);

  useEffect(() => {
    let vivo = true;
    const flush = () => {
      void sincronizar()
        .catch(() => 0)
        .then(() => pendentes())
        .then((n) => {
          if (vivo) setQtd(n);
        });
    };
    flush();
    const intervalo = window.setInterval(flush, 5 * 60_000);
    window.addEventListener("online", flush);
    return () => {
      vivo = false;
      window.clearInterval(intervalo);
      window.removeEventListener("online", flush);
    };
  }, []);

  return { pendentes: qtd, atualizar };
}
