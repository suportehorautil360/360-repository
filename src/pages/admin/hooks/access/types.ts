type DTOAddLocacao = {
  fullName: string;
  userLogin: string;
  initialPassword: string;
  profille: "Gestor" | "Administrador";
};

export interface AddLocacaoResult {
  ok: boolean;
  message: string;
}

export interface AcessoLoginProps {
  handleAddLocacao: (data: DTOAddLocacao) => Promise<AddLocacaoResult>;
}
