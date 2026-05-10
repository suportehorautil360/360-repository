import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'
import type { PostoUsuarioPortal } from './postoPortalTypes'

type Shell = 'auth' | 'app'

export type PostoPortalContextValue = {
  shell: Shell
  hubFlow: boolean
  hubUser: PostoUsuarioPortal | null
  refreshKey: number
  activeTab: string
  usuarioLogadoLine: string
  postoCtxPrefLine: string
  loginResetNonce: number
  setActiveTab: Dispatch<SetStateAction<string>>
  postoAppRefresh: () => void
  logout: () => void
}

export const PostoPortalContext =
  createContext<PostoPortalContextValue | null>(null)

export function usePostoPortal(): PostoPortalContextValue {
  const v = useContext(PostoPortalContext)
  if (!v) {
    throw new Error('usePostoPortal só dentro de PostoPortalProvider')
  }
  return v
}
