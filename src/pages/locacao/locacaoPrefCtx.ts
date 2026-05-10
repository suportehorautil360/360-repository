import type { Prefeitura, Usuario } from '../../lib/hu360/types'

/** Mesma chave do HTML legado — Hub pode gravar contexto de prefeitura para o módulo. */
export const PF_MODULO_CTX_KEY = 'hu360_modulo_pref_ctx'

export function locPrefeituraIdParaUi(
  user: Usuario,
  prefeituras: Prefeitura[],
): string {
  const fallback = user.prefeituraId || 'tl-ms'
  try {
    const s = sessionStorage.getItem(PF_MODULO_CTX_KEY)
    if (
      s &&
      prefeituras.some((p) => p.id === s)
    ) {
      return s
    }
  } catch {
    /* ignore */
  }
  return fallback
}

export function limparLocacaoPrefCtxHub(): void {
  try {
    sessionStorage.removeItem(PF_MODULO_CTX_KEY)
  } catch {
    /* ignore */
  }
}
