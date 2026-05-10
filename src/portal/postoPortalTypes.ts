/** Usuário no mesmo formato que o HU360 / API usam. */
export interface PostoUsuarioPortal {
  usuario: string
  senha?: string
  vinculo?: string
  postoId?: string | null
  prefeituraId?: string
  perfil?: string
  nome?: string
}

export type ControleAbastecimento = {
  postosCredenciados?: PostoCredenciado[]
  abastecimentos?: AbastecimentoRow[]
  valorUnitarioEdital?: number | string
}

export type PostoCredenciado = {
  id: string
  razaoSocial?: string
  nomeFantasia?: string
  cnpj?: string
  bandeira?: string
  endereco?: string
  combustiveis?: string
  limiteLitrosMes?: number | string | null
  contrato?: string
  validadeAte?: string
  status?: string
}

export type AbastecimentoRow = {
  postoId?: string
  data?: string
  hora?: string
  veiculo?: string
  motorista?: string
  combustivel?: string
  litros?: number | string | null
  valorTotal?: string
  cupomFiscal?: string
  secretaria?: string
}

/** Retorno de `postoResolverSessaoPortal()`. */
export type PortalSessao =
  | null
  | {
      rowUser: PostoUsuarioPortal
      prefeituraId: string
      postoId: string
      controle: false
    }
  | {
      rowUser: PostoUsuarioPortal
      controle: true
      incompleto: true
    }
  | {
      rowUser: PostoUsuarioPortal
      prefeituraId: string
      postoId: string
      controle: true
    }

export type FatAggEquip = {
  equip: string
  qtd: number
  litros: number
  valorFaturar: number
}

export type FatAggResult = {
  rows: FatAggEquip[]
  totalLitros: number
  totalFaturar: number
  valorUnitarioEdital: number
}

export type FatUltimoSnapshot = {
  agg: FatAggResult
  ano: number
  mes: number
  municipio: string
  secretariaFiltro: string
  postoLabel: string
  postoId: string
}
