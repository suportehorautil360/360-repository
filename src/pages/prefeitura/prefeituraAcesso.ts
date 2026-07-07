export const GRUPO_FROTA = "Gestão de Frota";
export const GRUPO_MANUTENCAO = "Manutenção";
export const GRUPO_PESSOAS = "Pessoas / RH";

const GRUPOS_SEMPRE_LIBERADOS = new Set(["Principal", "Sistema"]);

const ACESSO_POR_CARGO: Record<string, string[]> = {
  operador: [GRUPO_MANUTENCAO],
  mecânico: [GRUPO_MANUTENCAO],
  mecanico: [GRUPO_MANUTENCAO],
  motorista: [GRUPO_FROTA],
  comboista: [GRUPO_FROTA],
  supervisor: [GRUPO_PESSOAS],
};

export interface AcessoUsuario {
  perfil?: string;
  cargo?: string;
}

function normalizar(v: string | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export function podeAcessarGrupo(
  groupLabel: string,
  acesso: AcessoUsuario | undefined,
): boolean {
  if (GRUPOS_SEMPRE_LIBERADOS.has(groupLabel)) return true;

  const perfil = normalizar(acesso?.perfil);
  if (perfil === "admin") return true;

  const cargo = normalizar(acesso?.cargo);
  if (!cargo) return true;

  const permitidos = ACESSO_POR_CARGO[cargo];
  if (!permitidos) return false;

  return permitidos.includes(groupLabel);
}
