import { useEffect } from "react";
import { sincronizarMedicoes } from "../../features/checklist/api/medicao-fila";
import { sincronizarWorkflows } from "../../features/checklist/api/workflow-fila";

/**
 * Reenvia as filas offline do checklist (workflow + medição do equipamento)
 * ao montar a tela e quando a conexão volta.
 */
export function useWorkflowSync() {
  useEffect(() => {
    const flush = () => {
      void sincronizarWorkflows();
      void sincronizarMedicoes();
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);
}
