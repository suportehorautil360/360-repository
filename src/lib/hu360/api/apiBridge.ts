/**
 * Bridge: expõe HU360Sync em window.HU360Sync para compatibilidade com HTML/JS
 * legado. Código novo deve usar `useHU360Sync()`.
 */
import { apiEnabled } from './base'
import * as endpoints from './endpoints'
import * as sync from './sync'

export function instalarBridgeHU360Sync(): void {
  if (typeof window === 'undefined') return

  const obj = {
    apiEnabled,
    login: endpoints.login,
    logout: endpoints.logout,
    session: endpoints.session,
    pullAbastecimentos: sync.pullAbastecimentos,
    pushAbastecimento: sync.pushAbastecimento,
    pullVeiculos: sync.pullVeiculos,
    pullChecklists: sync.pullChecklists,
    pushVeiculo: sync.pushVeiculo,
    pushChecklist: sync.pushChecklist,
    getOs: endpoints.getOs,
    postOs: endpoints.postOs,
    postOsStatus: endpoints.postOsStatus,
    getOrcamentos: endpoints.getOrcamentos,
    postOrcamento: endpoints.postOrcamento,
    getNfPosto: endpoints.getNfPosto,
    postNfPosto: endpoints.postNfPosto,
    postNfPostoStatus: endpoints.postNfPostoStatus,
    getAppEventos: endpoints.getAppEventos,
    postAppEventos: endpoints.postAppEventos,
    pullFluxoServidor: sync.pullFluxoServidor,
  }

  ;(window as unknown as { HU360Sync: typeof obj }).HU360Sync = obj
}
