import { useState } from 'react'
import { getHu360 } from './hu360Access'
import {
  abrirAppControle,
  getSessionKey,
  postoPrefIdHubOuUsuario,
  postoSalvarCtxControle,
  postoUsuarioControleHub,
} from './postoPortalLegacy'
import { obterCaMesclado } from './postoPortalHu360Data'
import type { PostoUsuarioPortal } from './postoPortalTypes'

export function HubControlePanel({
  hubUser,
}: {
  hubUser: PostoUsuarioPortal | null
}) {
  const [postoSel, setPostoSel] = useState('')
  const [msg, setMsg] = useState('')

  if (!hubUser) {
    return null
  }

  const pid = postoPrefIdHubOuUsuario(hubUser)
  const ca = obterCaMesclado(pid)
  const postos = ca.postosCredenciados ?? []
  const hint =
    'Município em foco (cadastros Hub): ' +
    (getHu360()?.prefeituraLabel(pid) ?? pid)

  function onEntrar() {
    const r = localStorage.getItem(getSessionKey())
    if (!r) {
      setMsg('Faça login no Hub primeiro.')
      return
    }
    let rowUser: PostoUsuarioPortal
    try {
      rowUser = JSON.parse(r) as PostoUsuarioPortal
    } catch {
      return
    }
    if (!postoUsuarioControleHub(rowUser)) {
      return
    }
    if (!postos.length) {
      setMsg(
        'Não há postos credenciados para este município. Cadastre no Hub.',
      )
      return
    }
    if (!postoSel) {
      setMsg('Selecione um posto.')
      return
    }
    postoSalvarCtxControle(postoSel)
    setMsg('')
    abrirAppControle(rowUser)
  }

  return (
    <section
      id="posto-auth-controle"
      className="auth-screen"
      aria-labelledby="hub-controle-heading"
    >
      <div className="auth-card">
        <h1 id="hub-controle-heading" className="auth-title">
          Acesso controle Hub
        </h1>
        <p className="auth-subtitle" id="posto-controle-hint-pref">
          {hint}
        </p>
        <label htmlFor="posto-controle-sel-posto">Posto credenciado</label>
        <select
          id="posto-controle-sel-posto"
          className="auth-select"
          value={postoSel}
          onChange={(e) => setPostoSel(e.target.value)}
        >
          <option value="">Selecione…</option>
          {postos.map((p) => (
            <option key={p.id} value={p.id}>
              {(p.nomeFantasia || p.razaoSocial || p.id) + ' · ' + (p.cnpj ?? '—')}
            </option>
          ))}
        </select>
        <button
          type="button"
          id="posto-controle-entrar"
          className="btn btn-primary"
          onClick={onEntrar}
        >
          Entrar no painel do posto
        </button>
        {msg ? (
          <p id="posto-controle-msg" className="status status--error" role="status">
            {msg}
          </p>
        ) : null}
      </div>
    </section>
  )
}
