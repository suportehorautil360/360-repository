/** Visão geral de clientes — GET /clientes/overview (back-360-, NestJS). */
import { api } from "./client";

export type TipoClienteApi = "prefeitura" | "locacao";

export interface ClienteOverviewApi {
  id: string;
  nome: string;
  uf: string;
  tipoCliente: TipoClienteApi;
  ativos: number;
  checklists: number;
  emManutencao: number;
  custoAcumulado: number;
  osCotacao: number;
  osNfPagamento: number;
}

export const clientesApi = {
  async overview(): Promise<ClienteOverviewApi[]> {
    const r = await api.get<{ data: ClienteOverviewApi[] }>(
      "/clientes/overview",
    );
    return r.data ?? [];
  },
};
