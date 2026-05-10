import type { PostoUsuarioPortal } from './postoPortalTypes'
import { postoUsuarioControleHub } from './postoPortalCore'
import { abrirAppPosto } from './postoPortalLegacy'

export type AuthMessageTone = 'none' | 'loading' | 'error' | 'warning'

export type AuthFeedback = { text: string; tone: AuthMessageTone }

/**
 * Equivalente a `tratarUsuarioApi(user)` do script legado.
 * Em caso de sucesso chama `abrirAppPosto` e devolve `null` (sem mensagem na tela).
 */
export function tratarUsuarioApiPosto(
  user: PostoUsuarioPortal,
): AuthFeedback | null {
  if (postoUsuarioControleHub(user)) {
    return {
      text: 'Admin/gestor: use o Hub (menu Portal Posto) ou a área "Acesso controle Hub" acima para escolher o posto.',
      tone: 'warning',
    }
  }
  if (user.vinculo !== 'posto') {
    return {
      text:
        'Este login é para equipe do posto credenciado. Prefeitura e oficina usam seus próprios portais.',
      tone: 'error',
    }
  }
  if (!user.postoId) {
    return {
      text:
        'Seu usuário não está vinculado a um posto. Peça ao administrador no Hub (Acessos e logins).',
      tone: 'error',
    }
  }
  abrirAppPosto(user)
  return null
}
