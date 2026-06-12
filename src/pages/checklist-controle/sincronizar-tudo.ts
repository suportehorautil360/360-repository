/**
 * Sincronização manual: reenvia as filas offline (ponto + workflow de
 * checklist) de uma vez. As escritas do Firestore (checklist/emergência)
 * sincronizam sozinhas pelo SDK ao voltar a rede; aqui cuidamos do que vai
 * por HTTP ao NestJS e depende de reenvio explícito.
 */
import { sincronizar } from "../../lib/api/pontos-fila";
import { sincronizarWorkflows } from "../../features/checklist/api/workflow-fila";

export type ResultadoSync = {
  pontos: number;
  workflows: number;
  total: number;
};

export async function sincronizarTudo(): Promise<ResultadoSync> {
  const [pontos, workflows] = await Promise.all([
    sincronizar().catch(() => 0),
    sincronizarWorkflows().catch(() => 0),
  ]);
  return { pontos, workflows, total: pontos + workflows };
}
