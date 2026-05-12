export type VinculoUsuario = "prefeitura" | "oficina" | "posto" | "locacao";

export interface DTOAddUsuario {
  nome: string;
  usuario: string;
  senha: string;
  perfil: "gestor" | "admin";
  prefeituraId: string;
  vinculo: VinculoUsuario;
  postoId?: string;
  officinaId?: string;
}

export interface UsuarioFirestore {
  id: string;
  nome: string;
  usuario: string;
  senha: string;
  perfil: string;
  type: string;
  vinculo: VinculoUsuario;
  prefeituraId: string;
  postoId?: string;
  officinaId?: string;
  createdAt: string;
}

export interface AddLocacaoResult {
  ok: boolean;
  message: string;
}

export interface AcessoLoginProps {
  adicionarUsuario: (data: DTOAddUsuario) => Promise<AddLocacaoResult>;
  listarUsuarios: (filtros?: {
    prefeituraId?: string;
    vinculo?: VinculoUsuario;
  }) => Promise<UsuarioFirestore[]>;
  removerUsuario: (id: string) => Promise<AddLocacaoResult>;
}
