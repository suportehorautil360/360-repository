/** Visão geral de clientes — GET /clientes/overview (back-360-, NestJS). */
import { api } from "./client";

export type TipoClienteApi = "prefeitura" | "locacao";

export interface ClienteOverviewApi {
  id: string;
  nome: string;
  uf: string;
  tipoCliente: TipoClienteApi;
  /** E-mail da empresa/órgão (origem do domínio dos acessos). */
  email: string;
  ativos: number;
  checklists: number;
  emManutencao: number;
  custoAcumulado: number;
  osCotacao: number;
  osNfPagamento: number;
}

export type PerfilAcessoApi = "gestor" | "admin";

export interface AcessoApi {
  id: string;
  nome: string;
  usuario: string;
  email: string;
  whatsapp: string;
  perfil: string;
  notificaEmail: boolean;
  notificaWhatsapp: boolean;
}

export interface CriarAcessoPayload {
  nome: string;
  usuario: string;
  senha: string;
  perfil?: PerfilAcessoApi;
  email?: string;
  whatsapp?: string;
  notificaEmail?: boolean;
  notificaWhatsapp?: boolean;
}

/** Contrato de prestação de serviços (cadastro e consulta). */
export interface ContratoClienteApi {
  numero: string;
  vigenciaInicio: string;
  objeto: string;
  processo?: string;
  modalidade?: string;
  dataAssinatura?: string;
  vigenciaFim?: string;
  valorMensal?: string;
  valorTotal?: string;
  indiceReajuste?: string;
  periodicidadeFaturamento?: string;
  slaRespostaHoras?: string;
  responsavelContratante?: string;
  cargoContratante?: string;
  emailContratante?: string;
  telefoneContratante?: string;
  observacoes?: string;
  status?: string;
  qtdInicialAtivos?: number;
}

/** @deprecated Use ContratoClienteApi */
export type CriarClienteContrato = ContratoClienteApi;

export interface CriarClientePayload {
  nome: string;
  uf: string;
  tipoCliente?: TipoClienteApi;
  /** Dados da empresa (alimentam a tela de Configurações da prefeitura). */
  cnpj?: string;
  caepf?: string;
  cidade?: string;
  whatsapp?: string;
  contrato: ContratoClienteApi;
}

/** Cliente completo (GET /clientes/:id). */
export interface ClienteApi {
  id: string;
  nome: string;
  uf: string;
  tipoCliente?: TipoClienteApi;
  cnpj?: string;
  caepf?: string;
  cidade?: string;
  whatsapp?: string;
  criadoEm?: string;
  contrato?: ContratoClienteApi;
}

export const clientesApi = {
  async overview(): Promise<ClienteOverviewApi[]> {
    const r = await api.get<{ data: ClienteOverviewApi[] }>(
      "/clientes/overview",
    );
    return r.data ?? [];
  },

  /** Cadastra cliente + contrato. Retorna o id gerado pelo backend. */
  async criar(payload: CriarClientePayload): Promise<{ id: string }> {
    const r = await api.post<{ data: { id: string }; message: string }>(
      "/clientes",
      payload,
    );
    return { id: r.data?.id ?? "" };
  },

  /** Dados de um cliente por id (= prefeituraId). null quando não encontrado. */
  async obter(clienteId: string): Promise<ClienteApi | null> {
    try {
      const r = await api.get<{ data: ClienteApi }>(`/clientes/${clienteId}`);
      return r.data ?? null;
    } catch {
      return null;
    }
  },

  /** Lista os acessos (usuários) vinculados a um cliente. */
  async listarAcessos(clienteId: string): Promise<AcessoApi[]> {
    const r = await api.get<{ data: AcessoApi[] }>(
      `/clientes/${clienteId}/acessos`,
    );
    return Array.isArray(r.data) ? r.data : [];
  },

  /** Cria um acesso vinculado a um cliente. */
  async criarAcesso(
    clienteId: string,
    payload: CriarAcessoPayload,
  ): Promise<AcessoApi> {
    const r = await api.post<{ data: AcessoApi; message: string }>(
      `/clientes/${clienteId}/acessos`,
      payload,
    );
    return r.data;
  },

  /** Remove um acesso pelo id. */
  async removerAcesso(clienteId: string, acessoId: string): Promise<void> {
    await api.del(`/clientes/${clienteId}/acessos/${acessoId}`);
  },
};
