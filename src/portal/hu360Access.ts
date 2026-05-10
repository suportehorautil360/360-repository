import type { PostoUsuarioPortal } from './postoPortalTypes'

export interface Hu360Prefeitura {
  id: string
}

export interface Hu360Api {
  SESSION_KEY: string
  PREFEITURAS: Hu360Prefeitura[]
  carregarUsuarios(): PostoUsuarioPortal[]
  getDadosPrefeitura(prefeituraId: string): Record<string, unknown>
  criarDadosDemo(prefeituraId: string): Record<string, unknown>
  prefeituraLabel(pid: string): string
}

export function getHu360(): Hu360Api | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { HU360?: Hu360Api }).HU360
}
