/**
 * Tipos do módulo HU360 (multi-prefeitura).
 * Espelham as estruturas que viviam em window.HU360 no projeto legado.
 */

export interface ContratoServico {
  numero: string
  processo: string
  modalidade: string
  dataAssinatura: string
  vigenciaInicio: string
  vigenciaFim: string
  objeto: string
  valorMensal: string
  valorTotal: string
  indiceReajuste: string
  periodicidadeFaturamento: string
  slaRespostaHoras: string
  responsavelContratante: string
  cargoContratante: string
  emailContratante: string
  telefoneContratante: string
  observacoes: string
  status: string
}

export type TipoCliente = 'prefeitura' | 'locacao'

export interface Prefeitura {
  id: string
  nome: string
  uf: string
  /** Padrão: `prefeitura`. Empresas de locação não usam licitação pública. */
  tipoCliente?: TipoCliente
  contrato: ContratoServico
}

export type PerfilUsuario = 'admin' | 'gestor' | string
export type VinculoUsuario = 'prefeitura' | 'posto' | string

export interface Usuario {
  nome: string
  usuario: string
  senha: string
  perfil: PerfilUsuario
  prefeituraId: string
  vinculo: VinculoUsuario
  postoId?: string
}

export interface ChecklistItem {
  item: string
  resposta: string
  conforme: boolean
}

export interface ChecklistSecao {
  titulo: string
  itens: ChecklistItem[]
}

export interface ChecklistApp {
  protocolo: string
  sincronizadoEm: string
  versaoApp: string
  referenciaOs: string
  horimetroCampo: string
  secoes: ChecklistSecao[]
  observacoesCampo: string
  fotosResumo: string
  assinaturaDigital: string
}

export interface ChecklistOficina {
  protocolo: string
  osRef: string
  oficinaExecutora: string
  horimetroLeitura: string
  tipoServico: string
  secoes: ChecklistSecao[]
  observacoesOperador: string
  fotosResumo: string
  assinaturaDigital: string
}

export interface AuditoriaItem {
  hora: string
  operador: string
  equipamento: string
  /** Chassis / VIN do equipamento auditado (opcional para registros antigos). */
  chassis?: string
  fotos: string
  indice: string
  alerta: boolean
  checklistApp: ChecklistApp
}

export interface RiscoItem {
  nivel: string
  equipamento: string
  defeito: string
  operador: string
  acao: string
}

export interface Parceiro {
  id: string
  nome: string
  tipo: string
  especialidade: string
  status: string
  /** Checklist de credenciamento (chaves `data-cred-key`). */
  credChecklist?: Partial<Record<string, boolean>>
  credObservacoes?: string
  /**
   * Mantido por compatibilidade — string com nomes de anexos separados por
   * vírgula. Em novos cadastros usamos `credAnexosNomes` (lista) e este campo
   * fica derivado.
   */
  credAnexosResumo?: string
  /** Lista de nomes de arquivos anexados (apenas metadado, sem conteúdo). */
  credAnexosNomes?: string[]
  /** CNPJ extraído via OCR/PDF do cartão CNPJ etc. */
  credCnpjExtraido?: string
  /** Razão social detectada no texto extraído. */
  credRazaoSocialExtraida?: string
}

export interface FrotaItem {
  ativo: string
  linha: string
  pat: string
  status: string
  hori: string
}

export interface OsPendente {
  os: string
  maquina: string
  oficina: string
  valor: string
  etapa: string
  checklistOficina: ChecklistOficina
}

export interface EquipamentoPorLinha {
  label: string
  linha: string
}

export interface OrcamentoDetalhadoItem {
  descricao: string
  valor: string
}

export interface OrcamentoDetalhado {
  titulo: string
  total: string
  prazoExecucao: string
  validadeProposta: string
  itens: OrcamentoDetalhadoItem[]
  observacoes: string
}

export interface CotacaoPendente {
  os: string
  equip: string
  classificacao: string
  v1: string
  v2: string
  v3: string
  status: string
  orcamentosDetalhados: OrcamentoDetalhado[]
}

export interface PostoCredenciado {
  id: string
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  bandeira: string
  endereco: string
  combustiveis: string
  limiteLitrosMes: number
  contrato: string
  validadeAte: string
  status: string
}

export interface AbastecimentoRegistro {
  id: string
  data: string
  hora: string
  veiculo: string
  placa: string
  motorista: string
  secretaria: string
  postoId: string
  postoNome: string
  litros: number
  valorTotal: string
  km: number
  combustivel: string
  cupomFiscal: string
}

export type CreditoLiberacao = Record<string, unknown>

export interface ControleAbastecimento {
  labelsSemana: string[]
  litrosPorSemana: number[]
  valorUnitarioEdital: number
  limiteCreditoSemanalReais: number
  creditoLiberacoes: CreditoLiberacao[]
  postosCredenciados: PostoCredenciado[]
  abastecimentos: AbastecimentoRegistro[]
}

export interface TopOperador {
  nome: string
  bemFeitos: number
  indice: string
}

export interface DashboardGraficos {
  gastosLabels: string[]
  gastosReais: number[]
  checklistLabels: string[]
  checklistRecebidos: number[]
  topOperadores: TopOperador[]
  tituloPeriodo: string
}

/** Tomador / sublocatário: empresa para a qual a locadora direciona uso do equipamento. */
export interface EmpresaTerceiraLocacao {
  id: string
  nome: string
  cnpj?: string
  contato?: string
  observacoes?: string
  criadoEm: string
}

export interface EquipamentoCadastro {
  id: string
  marca: string
  modelo: string
  chassis: string
  descricao: string
  linha: string
  /** Obra / serviço vinculado (opcional). */
  obra?: string
  /** Empresa terceira (tomador) quando o equipamento é alugado “em direção” a ela. */
  empresaTerceiraId?: string
  criadoEm: string
}

export interface PrefeituraModulo {
  orcamentoContratual: number
  gastoPct: number
  gastoEfetivadoLabel: string
  frota: FrotaItem[]
  osPendentes: OsPendente[]
  operadoresSelect: string[]
  oficinasCotacao: string[]
  classificacaoLinhas: string[]
  equipamentosPorLinha: EquipamentoPorLinha[]
  oficinasPorLinha: Record<string, string[]>
  dashboardGraficos: DashboardGraficos
  cotacoesPendentes: CotacaoPendente[]
  controleAbastecimento: ControleAbastecimento
  /** Empresas terceiras (tomadores) para direcionar equipamentos em sublocação. */
  empresasTerceirasLocacao?: EmpresaTerceiraLocacao[]
  /** Populado pelo cadastro manual / importação de planilha. */
  equipamentosCadastro?: EquipamentoCadastro[]
  /** Populado por syncs com a API (HU360Sync). */
  veiculosApi?: VeiculoApiRow[]
  checklistsCampo?: ChecklistApiRow[]
  fluxoServidor?: FluxoServidor
}

export interface ComparativoItem {
  concorrente: string
  valor: string
  status: string
  destaque: boolean
}

export interface OficinaModulo {
  osReq: string
  equipLabel: string
  defeito: string
  orcamentoValor: string
  nfPlaceholder: string
  checklistTitulo: string
  comparativo: ComparativoItem[]
}

export interface HubDashboardData {
  ativos: number
  checklists: number
  manutencao: number
  custoLabel: string
  chartBarras: number[]
  donut: number[]
}

export interface DadosPrefeitura {
  hubDashboard: HubDashboardData
  auditoria: AuditoriaItem[]
  riscos: RiscoItem[]
  parceiros: Parceiro[]
  prefeituraModulo: PrefeituraModulo
  oficinaModulo: OficinaModulo
}

export interface AdicionarClientePayload {
  nome: string
  uf: string
  tipoCliente?: TipoCliente
  contrato?: Partial<ContratoServico>
}

export interface OperationResult {
  ok: boolean
  msg?: string
  id?: string
}

/* ============== Sync / API HTTP ============== */

export interface ApiResult<TRow = unknown> {
  ok: boolean
  msg?: string
  rows?: TRow[]
  row?: TRow
  id?: number | string
  skipped?: boolean
  partial?: boolean
}

export type LinhaFrota = 'Linha Amarela' | 'Linha Branca' | 'Linha Leve'

export interface VeiculoApiRow {
  id: number
  chassis: string
  marca: string
  modelo: string
  tipo_frota: string
  label: string
  linha: LinhaFrota
}

export interface VeiculoApiRowRaw {
  id: number | string
  chassis?: string
  marca?: string
  modelo?: string
  tipo_frota?: string
}

export interface ChecklistApiRow {
  id: number
  veiculo_id: number | null
  chassis_qr: string
  status_oleo: string
  status_filtros: string
  observacoes: string
  criado_em: string
}

export interface ChecklistApiRowRaw {
  id: number | string
  veiculo_id?: number | string | null
  chassis_qr?: string
  chassis?: string
  status_oleo?: string
  status_filtros?: string
  observacoes?: string
  criado_em?: string
}

export type RegistroFluxo = Record<string, unknown>

export interface FluxoServidor {
  os: RegistroFluxo[]
  orcamentos: RegistroFluxo[]
  nfPosto: RegistroFluxo[]
  appEventos: RegistroFluxo[]
  atualizadoEm: string
}
