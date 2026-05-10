import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import Login from '../pages/login'
import { getHu360 } from './hu360Access'
import { HubControlePanel } from './HubControlePanel'
import {
  PostoPortalContext,
  type PostoPortalContextValue,
} from './PostoPortalContext'
import { PostoAppShell } from './PostoAppShell'
import { HUB_POSTO_CTX_KEY } from './postoPortalCore'
import {
  encontrarPostoCredenciado,
  obterCaMesclado,
} from './postoPortalHu360Data'
import {
  getSessionKey,
  postoResolverSessaoPortal,
  postoUsuarioControleHub,
} from './postoPortalLegacy'
import { setPortalRuntime } from './postoPortalRuntime'
import type { PostoUsuarioPortal } from './postoPortalTypes'
import { usePostoPortalSessionRestore } from './usePostoPortalSessionRestore'
import './posto-app.css'

type Shell = 'auth' | 'app'

export function PostoPortalProvider() {
  const [shell, setShell] = useState<Shell>('auth')
  const [hubFlow, setHubFlow] = useState(false)
  const [hubUser, setHubUser] = useState<PostoUsuarioPortal | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState('posto-tab-dash')
  const [usuarioLogadoLine, setUsuarioLogadoLine] = useState('')
  const [postoCtxPrefLine, setPostoCtxPrefLine] = useState('')
  const [loginResetNonce, setLoginResetNonce] = useState(0)

  const postoAppRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const abrirAppPostoCb = useCallback((user: PostoUsuarioPortal) => {
    const u = { ...user }
    if (!u.prefeituraId) {
      u.prefeituraId = 'tl-ms'
    }
    setHubFlow(false)
    localStorage.setItem(getSessionKey(), JSON.stringify(u))
    setShell('app')
    const hu = getHu360()
    const nome = u.nome || u.usuario
    const label = hu?.prefeituraLabel(u.prefeituraId) ?? u.prefeituraId
    setUsuarioLogadoLine(
      `Conectado: ${nome} · ${label} · Posto credenciado`,
    )
    setPostoCtxPrefLine(label)
    setRefreshKey((k) => k + 1)
  }, [])

  const abrirAppControleCb = useCallback((rowUser: PostoUsuarioPortal) => {
    setHubFlow(false)
    const portal = postoResolverSessaoPortal()
    if (
      !portal ||
      ('incompleto' in portal && portal.incompleto) ||
      !('postoId' in portal)
    ) {
      return
    }
    setShell('app')
    const nome = rowUser.nome || rowUser.usuario
    const ca = obterCaMesclado(portal.prefeituraId)
    const pInf = encontrarPostoCredenciado(ca, portal.postoId)
    const postoNom = pInf
      ? pInf.nomeFantasia || pInf.razaoSocial || portal.postoId
      : portal.postoId
    const municipio =
      getHu360()?.prefeituraLabel(portal.prefeituraId) ?? portal.prefeituraId
    setUsuarioLogadoLine(
      `Conectado (controle Hub): ${nome} · ${municipio} · ${postoNom}`,
    )
    setPostoCtxPrefLine(`${municipio} — ${postoNom}`)
    setRefreshKey((k) => k + 1)
  }, [])

  const postoMostrarBlocoControleAuthCb = useCallback(
    (rowUser: PostoUsuarioPortal) => {
      setShell('auth')
      setHubFlow(true)
      setHubUser(rowUser)
    },
    [],
  )

  const postoOcultarBlocoControleAuthCb = useCallback(() => {
    setHubFlow(false)
  }, [])

  useLayoutEffect(() => {
    setPortalRuntime({
      abrirAppPosto: abrirAppPostoCb,
      abrirAppControle: abrirAppControleCb,
      postoMostrarBlocoControleAuth: postoMostrarBlocoControleAuthCb,
      postoOcultarBlocoControleAuth: postoOcultarBlocoControleAuthCb,
    })
    return () => {
      setPortalRuntime(null)
    }
  }, [
    abrirAppPostoCb,
    abrirAppControleCb,
    postoMostrarBlocoControleAuthCb,
    postoOcultarBlocoControleAuthCb,
  ])

  const logout = useCallback(() => {
    const raw = localStorage.getItem(getSessionKey())
    try {
      if (raw) {
        const u = JSON.parse(raw) as PostoUsuarioPortal
        if (postoUsuarioControleHub(u)) {
          sessionStorage.removeItem(HUB_POSTO_CTX_KEY)
          setShell('auth')
          setHubFlow(true)
          setHubUser(u)
          setUsuarioLogadoLine('')
          setLoginResetNonce((n) => n + 1)
          return
        }
      }
    } catch {
      /* ignore */
    }
    function limparSessaoPosto() {
      localStorage.removeItem(getSessionKey())
      sessionStorage.removeItem(HUB_POSTO_CTX_KEY)
      setShell('auth')
      setHubFlow(false)
      setHubUser(null)
      setUsuarioLogadoLine('')
      setPostoCtxPrefLine('')
      setLoginResetNonce((n) => n + 1)
    }
    const sync = window.HU360Sync
    if (sync?.apiEnabled() && typeof sync.logout === 'function') {
      void sync.logout().finally(limparSessaoPosto)
    } else {
      limparSessaoPosto()
    }
  }, [])

  useEffect(() => {
    window.postoAppRefresh = postoAppRefresh
    window.postoLogout = logout
    window.postoNavegar = (idTab: string) => {
      if (!localStorage.getItem(getSessionKey())) {
        logout()
        return
      }
      setActiveTab(idTab)
      setRefreshKey((k) => k + 1)
    }
    return () => {
      delete window.postoAppRefresh
      delete window.postoLogout
      delete window.postoNavegar
    }
  }, [postoAppRefresh, logout])

  useEffect(() => {
    document.body.style.display = 'flex'
    document.body.style.minHeight = '100svh'
    document.body.style.margin = '0'
    document.body.style.flexDirection = shell === 'app' ? 'row' : 'column'
    return () => {
      document.body.style.display = ''
      document.body.style.minHeight = ''
      document.body.style.flexDirection = ''
    }
  }, [shell])

  usePostoPortalSessionRestore()

  const value = useMemo(
    (): PostoPortalContextValue => ({
      shell,
      hubFlow,
      hubUser,
      refreshKey,
      activeTab,
      usuarioLogadoLine,
      postoCtxPrefLine,
      loginResetNonce,
      setActiveTab,
      postoAppRefresh,
      logout,
    }),
    [
      shell,
      hubFlow,
      hubUser,
      refreshKey,
      activeTab,
      usuarioLogadoLine,
      postoCtxPrefLine,
      loginResetNonce,
      postoAppRefresh,
      logout,
    ],
  )

  return (
    <PostoPortalContext.Provider value={value}>
      {shell === 'auth' &&
        (hubFlow ? (
          <HubControlePanel hubUser={hubUser} />
        ) : (
          <Login resetNonce={loginResetNonce} />
        ))}
      {shell === 'app' && <PostoAppShell />}
    </PostoPortalContext.Provider>
  )
}

export { usePostoPortal } from './PostoPortalContext'
