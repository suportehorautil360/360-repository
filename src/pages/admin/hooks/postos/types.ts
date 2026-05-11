export interface PostoFirestore {
  id: string;
  prefeituraId: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj?: string;
  bandeira?: string;
  endereco?: string;
  combustiveis?: string;
  limiteLitrosMes?: number;
  contrato?: string;
  validadeAte?: string;
  status: "Ativa" | "Suspensa";
  createdAt: string;
}

export interface DTOAddPosto {
  prefeituraId: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj?: string;
  bandeira?: string;
  endereco?: string;
  combustiveis?: string;
  limiteLitrosMes?: number;
  contrato?: string;
  validadeAte?: string;
  status?: "Ativa" | "Suspensa";
}

export interface PostosResult {
  ok: boolean;
  message: string;
  id?: string;
}

export interface PostosProps {
  listarPostos: (prefeituraId: string) => Promise<PostoFirestore[]>;
  listarPostosAtivos: (prefeituraId: string) => Promise<PostoFirestore[]>;
  adicionarPosto: (data: DTOAddPosto) => Promise<PostosResult>;
  removerPosto: (id: string) => Promise<PostosResult>;
}
