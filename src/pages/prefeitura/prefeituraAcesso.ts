/**
 * Re-export fino — a fonte canônica é `lib/acesso/cargos-permissao`.
 * Mantido para imports legados da pasta prefeitura.
 */
export {
  GRUPO_FROTA,
  GRUPO_MANUTENCAO,
  GRUPO_PESSOAS,
  podeAcessarGrupo,
  type AcessoUsuario,
  type PorCargo,
} from "../../lib/acesso/cargos-permissao";
