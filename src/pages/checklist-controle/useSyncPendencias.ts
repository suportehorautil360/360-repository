import { useEffect, useState } from "react";
import { waitForPendingWrites } from "firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import {
  contarPendentes,
  lerPendentes,
  removerVarios,
} from "./sync-pendencias";

/**
 * Expõe quantos checklists/emergências estão salvos no aparelho aguardando
 * sincronização. Atualiza ao marcar/remover (evento) e reconcilia com o SDK:
 * quando o Firestore confirma todas as escritas pendentes, limpa os ids que
 * estavam na fila — cobre o caso de o app ter sido fechado e reaberto (as
 * promises de escrita individuais se perderam).
 */
export function useSyncPendencias() {
  const [pendentes, setPendentes] = useState(() => contarPendentes());

  useEffect(() => {
    const atualizar = () => setPendentes(contarPendentes());
    window.addEventListener("hu360-sync-pendencias", atualizar);

    const reconciliar = () => {
      const idsNoInicio = lerPendentes().map((p) => p.id);
      if (idsNoInicio.length === 0) return;
      // Resolve quando NÃO há mais escritas locais pendentes no SDK; aí os que
      // estavam na fila já foram para o servidor. Novos saves durante a espera
      // têm suas próprias promises e não são removidos aqui.
      void waitForPendingWrites(db)
        .then(() => removerVarios(idsNoInicio))
        .catch(() => {
          /* offline / SDK indisponível — tenta de novo ao reconectar */
        });
    };
    reconciliar();
    window.addEventListener("online", reconciliar);

    return () => {
      window.removeEventListener("hu360-sync-pendencias", atualizar);
      window.removeEventListener("online", reconciliar);
    };
  }, []);

  return { pendentes };
}
