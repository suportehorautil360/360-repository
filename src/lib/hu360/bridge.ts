/**
 * Bridge: expõe a API HU360 em window.HU360 para compatibilidade com HTML/JS
 * legado que ainda referencia esse global. Código React novo deve usar
 * `useHU360()` em vez de window.HU360.
 */
import { criarDadosDemo } from './demoData'
import { DEFAULT_USERS } from './seed'
import * as storage from './storage'

export function instalarBridgeHU360(): void {
  if (typeof window === 'undefined') return

  const obj = {
    USERS_KEY: storage.USERS_KEY,
    SESSION_KEY: storage.SESSION_KEY,
    DEFAULT_USERS,
    obterPrefeituras: storage.obterPrefeituras,
    salvarPrefeiturasLista: storage.salvarPrefeiturasLista,
    adicionarClienteContratoServico: storage.adicionarClienteContratoServico,
    removerPrefeituraContrato: storage.removerPrefeituraContrato,
    prefeituraLabel: storage.prefeituraLabel,
    carregarUsuarios: storage.carregarUsuarios,
    salvarUsuarios: storage.salvarUsuarios,
    getDadosPrefeitura: storage.getDadosPrefeitura,
    salvarDadosPrefeitura: storage.salvarDadosPrefeitura,
    normalizarIdsParceiros: storage.normalizarIdsParceiros,
    criarDadosDemo,
  }

  Object.defineProperty(obj, 'PREFEITURAS', {
    get: storage.obterPrefeituras,
    enumerable: true,
    configurable: true,
  })

  ;(window as unknown as { HU360: typeof obj }).HU360 = obj
}
