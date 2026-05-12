export interface OficinaFirestore {
  id: string;
  prefeituraId: string;
  nome: string;
  especialidade: string;
  status: "Ativa" | "Suspensa";
  credChecklist?: Record<string, boolean>;
  credObservacoes?: string;
  credAnexosNomes?: string[];
  credAnexosResumo?: string;
  credCnpjExtraido?: string;
  credRazaoSocialExtraida?: string;
  createdAt: string;
}

export interface DTOAddOficina {
  prefeituraId: string;
  nome: string;
  especialidade: string;
  status: "Ativa" | "Suspensa";
  credChecklist?: Record<string, boolean>;
  credObservacoes?: string;
  credAnexosNomes?: string[];
  credCnpjExtraido?: string;
  credRazaoSocialExtraida?: string;
}

export interface DTOUpdateCredOficina {
  credChecklist?: Record<string, boolean>;
  credObservacoes?: string;
  credAnexosNomes?: string[];
  credCnpjExtraido?: string;
  credRazaoSocialExtraida?: string;
}

export interface OficinasResult {
  ok: boolean;
  message: string;
  id?: string;
}

export interface OficinasProps {
  listarOficinas: (prefeituraId: string) => Promise<OficinaFirestore[]>;
  adicionarOficina: (data: DTOAddOficina) => Promise<OficinasResult>;
  atualizarCredOficina: (
    id: string,
    data: DTOUpdateCredOficina,
  ) => Promise<OficinasResult>;
  removerOficina: (id: string) => Promise<OficinasResult>;
}
