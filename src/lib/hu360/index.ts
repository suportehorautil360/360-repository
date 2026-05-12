export type * from './types'
export { HU360Provider, HU360Context } from './HU360Context'
export type { HU360ContextValue } from './HU360Context'
export { useHU360 } from './useHU360'
export { useHU360Sync, type HU360SyncApi } from './useHU360Sync'
export {
  HU360AuthProvider,
  HU360AuthContext,
  type HU360AuthValue,
  type LoginResultado,
} from './HU360AuthContext'
export { useHU360Auth } from './useHU360Auth'
export { instalarBridgeHU360 } from './bridge'
export { instalarBridgeHU360Sync } from './api/apiBridge'
export { instalarBridgeEquipamentos } from './equipamentosBridge'

/* ============== Equipamentos (cadastro de locação) ============== */
export {
  formatLabelEquipamentoCadastro,
  novoIdEquipamento,
  parsePlanilhaTexto,
  adicionarLote,
  removerEquipamentoLista,
  arquivoToTextPromise,
  norm as normEquipamento,
} from './equipamentos'
export type {
  EquipamentoEntrada,
  EquipamentoParseado,
  AddBatchOpts,
  AddBatchResult,
} from './equipamentos'
export {
  useEmpresasTerceirasLocacao,
  type UseEmpresasTerceirasLocacao,
  type EmpresaTerceiraEntrada,
} from './useEmpresasTerceirasLocacao'
export {
  useEquipamentosCadastro,
  type UseEquipamentosCadastro,
} from './useEquipamentosCadastro'
export {
  sincronizarLocacaoComFirestore,
  pushLocacaoModuloParaFirestore,
  pullLocacaoModuloDoFirestore,
  normChassisLocacaoSync,
} from './locacaoFirestoreSync'

/* ============== API HTTP — funções diretas ============== */
export {
  getApiBase,
  apiEnabled,
  buildUrl,
  fetchJson,
} from './api/base'
export type { FetchJsonOptions } from './api/base'

export {
  login,
  logout,
  session,
  getAbastecimentos,
  postAbastecimento,
  getVeiculos,
  postVeiculo,
  getChecklists,
  postChecklist,
  getOs,
  postOs,
  postOsStatus,
  getOrcamentos,
  postOrcamento,
  getNfPosto,
  postNfPosto,
  postNfPostoStatus,
  getAppEventos,
  postAppEventos,
} from './api/endpoints'

export type { SessionResponse } from './api/endpoints'

export {
  pullAbastecimentos,
  pushAbastecimento,
  pullVeiculos,
  pullChecklists,
  pushVeiculo,
  pushChecklist,
  pullFluxoServidor,
} from './api/sync'

export {
  mapTipoFrotaToLinha,
  veiculoApiLabel,
  mapVeiculoApiRow,
  mapChecklistApiRow,
} from './api/mappers'

// Funções puras (sem React) — para testes ou uso fora de componente.
export {
  contratoServicoPadrao,
  mesclarContratoSalvo,
  enriquecerPrefeitura,
  slugifyPref,
  novoIdPrefeitura,
  prefeituraLabelFromList,
} from './tenant'

// Acesso direto ao storage (também sem React). Prefira usar useHU360().
export {
  USERS_KEY,
  SESSION_KEY,
  PREFEITURAS_KEY,
  obterPrefeituras,
  salvarPrefeiturasLista,
  prefeituraLabel,
  carregarUsuarios,
  salvarUsuarios,
  adicionarClienteContratoServico,
  removerPrefeituraContrato,
  getDadosPrefeitura,
  salvarDadosPrefeitura,
  normalizarIdsParceiros,
} from './storage'

export { criarDadosDemo } from './demoData'
export { PREFEITURAS_SEED, DEFAULT_USERS } from './seed'
