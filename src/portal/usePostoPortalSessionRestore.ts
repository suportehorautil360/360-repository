import { useEffect } from 'react'
import type { PostoUsuarioPortal } from './postoPortalTypes'
import {
  abrirAppControle,
  abrirAppPosto,
  carregarUsuarios,
  getSessionKey,
  postoIdCtxControle,
  postoMostrarBlocoControleAuth,
  postoUsuarioControleHub,
} from './postoPortalLegacy'

/** Restaura sessão: HU360Sync ou localStorage + usuários HU360 (espelha o fim de `initPostoPortal`). */
export function usePostoPortalSessionRestore(): void {
  useEffect(() => {
    carregarUsuarios()

    const sync = window.HU360Sync
    if (sync?.apiEnabled()) {
      let cancelled = false
      void sync.session().then((res) => {
        if (cancelled) return
        if (!res.ok || !res.logged || !res.user) return
        const u = res.user
        localStorage.setItem(getSessionKey(), JSON.stringify(u))
        if (u.vinculo === 'posto' && u.postoId) {
          abrirAppPosto(u)
        } else if (postoUsuarioControleHub(u)) {
          if (postoIdCtxControle()) {
            abrirAppControle(u)
          } else {
            postoMostrarBlocoControleAuth(u)
          }
        }
      })
      return () => {
        cancelled = true
      }
    }

    const raw = localStorage.getItem(getSessionKey())
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as PostoUsuarioPortal
      const fresh = carregarUsuarios().find((u) => u.usuario === parsed.usuario)
      if (!fresh) {
        localStorage.removeItem(getSessionKey())
        return
      }
      if (fresh.vinculo === 'posto' && fresh.postoId) {
        abrirAppPosto(fresh)
      } else if (postoUsuarioControleHub(fresh)) {
        if (postoIdCtxControle()) {
          abrirAppControle(fresh)
        } else {
          postoMostrarBlocoControleAuth(fresh)
        }
      }
    } catch {
      localStorage.removeItem(getSessionKey())
    }
  }, [])
}
