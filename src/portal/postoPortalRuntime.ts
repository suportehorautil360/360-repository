import type { PostoUsuarioPortal } from './postoPortalTypes'

export type PortalRuntime = {
  abrirAppPosto: (user: PostoUsuarioPortal) => void
  abrirAppControle: (rowUser: PostoUsuarioPortal) => void
  postoMostrarBlocoControleAuth: (rowUser: PostoUsuarioPortal) => void
  postoOcultarBlocoControleAuth: () => void
}

let runtime: PortalRuntime | null = null

export function setPortalRuntime(next: PortalRuntime | null): void {
  runtime = next
}

export function getPortalRuntime(): PortalRuntime {
  if (!runtime) {
    throw new Error(
      'Portal runtime não inicializado (envolva o app com PostoPortalProvider).',
    )
  }
  return runtime
}

export function getPortalRuntimeSafe(): PortalRuntime | null {
  return runtime
}
