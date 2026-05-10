import { useMemo } from 'react'
import { apiEnabled } from './api/base'
import * as endpoints from './api/endpoints'
import * as sync from './api/sync'

export interface HU360SyncApi {
  apiEnabled: typeof apiEnabled
  login: typeof endpoints.login
  logout: typeof endpoints.logout
  session: typeof endpoints.session
  pullAbastecimentos: typeof sync.pullAbastecimentos
  pushAbastecimento: typeof sync.pushAbastecimento
  pullVeiculos: typeof sync.pullVeiculos
  pullChecklists: typeof sync.pullChecklists
  pushVeiculo: typeof sync.pushVeiculo
  pushChecklist: typeof sync.pushChecklist
  getOs: typeof endpoints.getOs
  postOs: typeof endpoints.postOs
  postOsStatus: typeof endpoints.postOsStatus
  getOrcamentos: typeof endpoints.getOrcamentos
  postOrcamento: typeof endpoints.postOrcamento
  getNfPosto: typeof endpoints.getNfPosto
  postNfPosto: typeof endpoints.postNfPosto
  postNfPostoStatus: typeof endpoints.postNfPostoStatus
  getAppEventos: typeof endpoints.getAppEventos
  postAppEventos: typeof endpoints.postAppEventos
  pullFluxoServidor: typeof sync.pullFluxoServidor
}

/**
 * Hook que devolve a API HU360Sync (HTTP + sync com a API PHP).
 *
 * Não requer Provider — as funções são puras (cada uma já lida com a
 * persistência local quando necessário). Quando houver autenticação no
 * Context, podemos criar `useHU360SyncCurrent()` que já liga prefeituraId
 * automaticamente.
 */
export function useHU360Sync(): HU360SyncApi {
  return useMemo<HU360SyncApi>(
    () => ({
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
    }),
    [],
  )
}
