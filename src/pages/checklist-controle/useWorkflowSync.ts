import { useEffect } from "react";
import { sincronizarWorkflows } from "../../features/checklist/api/workflow-fila";

/**
 * Reenvia a fila offline do workflow de checklist (runs/answers no NestJS)
 * ao montar a tela e quando a conexão volta.
 */
export function useWorkflowSync() {
  useEffect(() => {
    const flush = () => {
      void sincronizarWorkflows();
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);
}
