/** Chaves do checklist de credenciamento de oficina (15 itens). */
export const CRED_KEYS = [
  'id_cnpj',
  'id_contrato',
  'id_socios',
  'id_endereco',
  'fisc_federal',
  'fisc_estadual',
  'fisc_municipal',
  'fisc_fgts',
  'fisc_cndt',
  'hab_falencia',
  'hab_balanco',
  'tec_alvara',
  'tec_avcb',
  'tec_ambiental',
  'tec_atestado',
] as const

export type CredKey = (typeof CRED_KEYS)[number]

export const CRED_TOTAL = CRED_KEYS.length
