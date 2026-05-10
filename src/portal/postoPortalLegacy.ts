import type { PostoUsuarioPortal } from './postoPortalTypes'
import {
  getPortalRuntime,
  getPortalRuntimeSafe,
} from './postoPortalRuntime'

export {
  HUB_CTX_KEY,
  HUB_POSTO_CTX_KEY,
  carregarUsuarios,
  getSessionKey,
  postoIdCtxControle,
  postoPrefIdHubOuUsuario,
  postoResolverSessaoPortal,
  postoSalvarCtxControle,
  postoUsuarioControleHub,
} from './postoPortalCore'

/** Delegates to `PostoPortalProvider` runtime. */
export function abrirAppPosto(user: PostoUsuarioPortal): void {
  getPortalRuntime().abrirAppPosto(user)
}

export function abrirAppControle(rowUser: PostoUsuarioPortal): void {
  getPortalRuntime().abrirAppControle(rowUser)
}

export function postoMostrarBlocoControleAuth(
  rowUser: PostoUsuarioPortal,
): void {
  getPortalRuntime().postoMostrarBlocoControleAuth(rowUser)
}

export function postoOcultarBlocoControleAuth(): void {
  getPortalRuntimeSafe()?.postoOcultarBlocoControleAuth()
}
