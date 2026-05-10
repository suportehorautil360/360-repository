import { getHu360 } from './hu360Access'
import type { PortalSessao, PostoUsuarioPortal } from './postoPortalTypes'

export const HUB_CTX_KEY = 'hu360_hub_ctx_pref'
export const HUB_POSTO_CTX_KEY = 'hu360_hub_ctx_posto'

export function getSessionKey(): string {
  return getHu360()?.SESSION_KEY ?? 'hu360_session'
}

export function postoUsuarioControleHub(
  rowUser: PostoUsuarioPortal | null | undefined,
): boolean {
  return !!(
    rowUser &&
    rowUser.vinculo === 'prefeitura' &&
    (rowUser.perfil === 'admin' || rowUser.perfil === 'gestor')
  )
}

export function postoPrefIdHubOuUsuario(
  rowUser: PostoUsuarioPortal | null | undefined,
): string {
  if (!rowUser) {
    return 'tl-ms'
  }
  try {
    const s = sessionStorage.getItem(HUB_CTX_KEY)
    const hu = getHu360()
    if (s && hu?.PREFEITURAS?.some((p) => p.id === s)) {
      return s
    }
  } catch {
    /* ignore */
  }
  return rowUser.prefeituraId || 'tl-ms'
}

export function postoIdCtxControle(): string | null {
  try {
    const j = sessionStorage.getItem(HUB_POSTO_CTX_KEY)
    if (!j) {
      return null
    }
    const o = JSON.parse(j) as { postoId?: string }
    return o && o.postoId ? String(o.postoId) : null
  } catch {
    return null
  }
}

export function postoSalvarCtxControle(
  postoId: string | null | undefined,
): void {
  if (!postoId) {
    return
  }
  sessionStorage.setItem(
    HUB_POSTO_CTX_KEY,
    JSON.stringify({ postoId: String(postoId) }),
  )
}

export function postoResolverSessaoPortal(): PortalSessao {
  const raw = localStorage.getItem(getSessionKey())
  if (!raw) {
    return null
  }
  let rowUser: PostoUsuarioPortal
  try {
    rowUser = JSON.parse(raw) as PostoUsuarioPortal
  } catch {
    return null
  }
  if (rowUser.vinculo === 'posto' && rowUser.postoId) {
    return {
      rowUser,
      prefeituraId: rowUser.prefeituraId || 'tl-ms',
      postoId: String(rowUser.postoId),
      controle: false,
    }
  }
  if (postoUsuarioControleHub(rowUser)) {
    const pid = postoPrefIdHubOuUsuario(rowUser)
    const postoId = postoIdCtxControle()
    if (!postoId) {
      return { rowUser, controle: true, incompleto: true }
    }
    return {
      rowUser,
      prefeituraId: pid,
      postoId,
      controle: true,
    }
  }
  return null
}

export function carregarUsuarios(): PostoUsuarioPortal[] {
  return getHu360()?.carregarUsuarios() ?? []
}
