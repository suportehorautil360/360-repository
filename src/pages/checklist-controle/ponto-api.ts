/**
 * Reexporta a API de ponto compartilhada (src/lib/api/pontos) com o nome
 * `pontoApi`, mantido por compatibilidade com o operador (checklist).
 */
export { pontosApi as pontoApi, TIPOS_PONTO } from "../../lib/api/pontos";
export type {
  TipoPonto,
  StatusPonto,
  BaterPontoInput,
  PontoRegistro,
} from "../../lib/api/pontos";
