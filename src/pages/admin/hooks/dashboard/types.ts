export interface EquipamentoFirestore {
  id: string;
  prefeituraId: string;
  marca?: string;
  modelo?: string;
  chassis?: string;
  descricao?: string;
  linha?: string;
  obra?: string;
  /** "ativo" | "inativo" | "manutencao" */
  status: string;
  criadoEm: string;
}

export interface ChecklistFirestore {
  id: string;
  prefeituraId: string;
  equipamentoId?: string;
  operador?: string;
  protocolo?: string;
  /** "campo" | "oficina" */
  tipo?: string;
  /** "conforme" | "nao-conforme" | "pendente" */
  status?: string;
  criadoEm: string;
}

/** Linha agregada por cliente para o dashboard. */
export interface DashboardClienteLinha {
  prefeituraId: string;
  ativos: number;
  emManutencao: number;
  checklists: number;
}
