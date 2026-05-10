import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHU360, useHU360Auth } from '../../lib/hu360'
import {
  computeAbsRowsSorted,
  computeDashboardKpis,
} from '../../portal/postoPortalCompute'
import { esc } from '../../portal/postoPortalFormat'
import {
  buildFaturamentoSnapshot,
  postoExportarFaturamentoCsvFromSnapshot,
  postoExportarFaturamentoPdfFromSnapshot,
} from '../../portal/postoPortalFaturamento'
import {
  encontrarPostoCredenciado,
  mesesOptions,
  obterCaMesclado,
} from '../../portal/postoPortalHu360Data'
import type {
  PortalSessao,
  PostoCredenciado,
  PostoUsuarioPortal,
} from '../../portal/postoPortalTypes'
import './posto.css'

type PostoSecao = 'inicio' | 'abs' | 'fat'

const COR_INFO = '#78716c'
const COR_ERRO = '#dc2626'

interface AuthMsg {
  texto: string
  cor: string
}

const SECRETARIAS_OPCOES = [
  '__todas__',
  'Secretaria de Infraestrutura',
  'Secretaria de Transportes',
  'Secretaria de Administração',
] as const

function isAdminPrefeitura(user: { perfil: string; vinculo: string } | null): boolean {
  if (!user) return false
  return (
    user.vinculo === 'prefeitura' &&
    (user.perfil === 'admin' || user.perfil === 'gestor')
  )
}

export function PostoPage() {
  const { user, login, logout } = useHU360Auth()
  const { prefeituras, prefeituraLabel } = useHU360()

  useEffect(() => {
    document.body.classList.add('posto-root')
    return () => {
      document.body.classList.remove('posto-root')
    }
  }, [])

  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [authMsg, setAuthMsg] = useState<AuthMsg>({ texto: '', cor: COR_INFO })
  const [secaoAtiva, setSecaoAtiva] = useState<PostoSecao>('inicio')

  // Selecao usada quando o usuario logado eh admin/gestor (vinculo=prefeitura).
  const [selPrefId, setSelPrefId] = useState<string>('')
  const [selPostoId, setSelPostoId] = useState<string>('')
  const [selMsg, setSelMsg] = useState<AuthMsg>({ texto: '', cor: COR_INFO })
  const [controleConfirmado, setControleConfirmado] = useState(false)

  // Filtros das telas internas.
  const mesAbsChoices = useMemo(() => mesesOptions(18), [])
  const fatMesChoices = useMemo(() => mesesOptions(24), [])
  const [mesAbs, setMesAbs] = useState(() => mesAbsChoices[0]?.value ?? '')
  const [fatMes, setFatMes] = useState(() => fatMesChoices[0]?.value ?? '')
  const [fatSecretaria, setFatSecretaria] = useState<string>('__todas__')

  // Quando admin escolhe prefeitura, redefine o posto pra primeiro disponivel.
  const adminMode = isAdminPrefeitura(user)

  useEffect(() => {
    if (!adminMode) return
    if (!selPrefId && prefeituras.length > 0) {
      setSelPrefId(user?.prefeituraId || prefeituras[0].id)
    }
  }, [adminMode, selPrefId, prefeituras, user])

  const postosDoMunicipio: PostoCredenciado[] = useMemo(() => {
    if (!adminMode || !selPrefId) return []
    const ca = obterCaMesclado(selPrefId)
    return ca.postosCredenciados ?? []
  }, [adminMode, selPrefId, controleConfirmado])

  useEffect(() => {
    if (!adminMode) return
    if (postosDoMunicipio.length === 0) {
      setSelPostoId('')
      return
    }
    if (!postosDoMunicipio.some((p) => p.id === selPostoId)) {
      setSelPostoId(postosDoMunicipio[0].id)
    }
  }, [adminMode, postosDoMunicipio, selPostoId])

  const portal: PortalSessao = useMemo(() => {
    if (!user) return null
    if (user.vinculo === 'posto' && user.postoId) {
      return {
        rowUser: user as PostoUsuarioPortal,
        prefeituraId: user.prefeituraId || 'tl-ms',
        postoId: String(user.postoId),
        controle: false,
      }
    }
    if (adminMode && controleConfirmado && selPrefId && selPostoId) {
      return {
        rowUser: user as PostoUsuarioPortal,
        prefeituraId: selPrefId,
        postoId: selPostoId,
        controle: true,
      }
    }
    return null
  }, [user, adminMode, controleConfirmado, selPrefId, selPostoId])

  const kpis = useMemo(() => computeDashboardKpis(portal), [portal])
  const absRows = useMemo(
    () => computeAbsRowsSorted(portal, mesAbs || null),
    [portal, mesAbs],
  )
  const fatSnapshot = useMemo(() => {
    if (!portal || !fatMes) return null
    const p = fatMes.split('-')
    const ano = parseInt(p[0], 10)
    const mes = parseInt(p[1], 10)
    return buildFaturamentoSnapshot(portal, ano, mes, fatSecretaria || '__todas__')
  }, [portal, fatMes, fatSecretaria])

  const labelPrefSel = selPrefId ? prefeituraLabel(selPrefId) : '—'

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setAuthMsg({ texto: 'Autenticando...', cor: COR_INFO })
    const res = await login(usuario.trim(), senha)
    if (!res.ok) {
      setAuthMsg({ texto: res.msg ?? 'Login ou senha inválidos.', cor: COR_ERRO })
      return
    }
    setAuthMsg({ texto: '', cor: COR_INFO })
    setSenha('')
  }

  async function handleLogout() {
    await logout()
    setUsuario('')
    setSenha('')
    setAuthMsg({ texto: '', cor: COR_INFO })
    setSelPrefId('')
    setSelPostoId('')
    setControleConfirmado(false)
    setSelMsg({ texto: '', cor: COR_INFO })
    setSecaoAtiva('inicio')
  }

  function handleControleEntrar() {
    if (!selPrefId) {
      setSelMsg({
        texto: 'Selecione uma prefeitura.',
        cor: COR_ERRO,
      })
      return
    }
    if (!selPostoId) {
      setSelMsg({
        texto: 'Selecione um posto credenciado.',
        cor: COR_ERRO,
      })
      return
    }
    setSelMsg({ texto: '', cor: COR_INFO })
    setControleConfirmado(true)
    setSecaoAtiva('inicio')
  }

  function trocarPosto() {
    setControleConfirmado(false)
    setSelMsg({ texto: '', cor: COR_INFO })
  }

  // ===== Tela de login =====
  if (!user) {
    return (
      <section id="authScreen" className="auth-screen">
        <div className="auth-card">
          <h1>Gestão do posto</h1>
          <p className="sub">
            Login exclusivo para equipe do{' '}
            <strong>posto credenciado</strong> (mesmo usuário cadastrado no
            Hub).
          </p>
          <form id="loginForm" onSubmit={handleLogin}>
            <label htmlFor="loginUsuario">Usuário</label>
            <input
              id="loginUsuario"
              required
              autoComplete="username"
              placeholder="Ex.: posto.tl"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
            <label htmlFor="loginSenha">Senha</label>
            <input
              id="loginSenha"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <button
              className="btn"
              type="submit"
              style={{ width: '100%', marginTop: 18 }}
            >
              Entrar
            </button>
            <div
              id="authMsg"
              className="auth-msg"
              role="alert"
              style={{ color: authMsg.cor }}
            >
              {authMsg.texto}
            </div>
          </form>
          <p
            style={{
              marginTop: 18,
              fontSize: '0.8rem',
              color: '#78716c',
              borderTop: '1px dashed #e7e5e4',
              paddingTop: 14,
            }}
          >
            Demo: <strong>posto.tl</strong> / <strong>posto123</strong> (Três
            Lagoas — posto credenciado).
            <br />
            Admins: <strong>admin</strong>, <strong>gestor</strong>,{' '}
            <strong>admin.bh</strong> entram pelo Hub e escolhem o posto.
          </p>
          <Link
            to="/admin/dashboard"
            style={{
              display: 'block',
              marginTop: 16,
              textAlign: 'center',
              color: 'var(--fuel, #f97316)',
              fontSize: '0.9rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            ← Voltar ao Hub Mestre
          </Link>
        </div>
      </section>
    )
  }

  // ===== Admin precisa escolher prefeitura/posto =====
  if (!portal) {
    return (
      <section id="authScreen" className="auth-screen">
        <div className="auth-card">
          <h1>Gestão do posto</h1>
          <div id="posto-auth-controle">
            <p className="sub" style={{ marginTop: 0 }}>
              Você está conectado ao <strong>Hub (controle)</strong>. Escolha a
              prefeitura e o <strong>posto credenciado</strong> para abrir
              este portal.
            </p>
            <p
              className="sub"
              id="posto-controle-hint-pref"
              style={{ fontSize: '0.85rem', marginBottom: 8 }}
            >
              Em foco:{' '}
              <strong style={{ color: 'var(--fuel, #f97316)' }}>
                {labelPrefSel}
              </strong>
            </p>
            <label htmlFor="posto-controle-sel-pref">Prefeitura</label>
            <select
              id="posto-controle-sel-pref"
              value={selPrefId}
              onChange={(e) => setSelPrefId(e.target.value)}
            >
              {prefeituras.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.uf})
                </option>
              ))}
            </select>
            <label htmlFor="posto-controle-sel-posto">Posto credenciado</label>
            <select
              id="posto-controle-sel-posto"
              value={selPostoId}
              onChange={(e) => setSelPostoId(e.target.value)}
            >
              {postosDoMunicipio.length === 0 ? (
                <option value="">— sem postos cadastrados —</option>
              ) : null}
              {postosDoMunicipio.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nomeFantasia || p.razaoSocial || p.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              id="posto-controle-entrar"
              style={{ width: '100%', marginTop: 14 }}
              onClick={handleControleEntrar}
            >
              Entrar no portal do posto
            </button>
            <div
              id="posto-controle-msg"
              className="auth-msg"
              role="alert"
              style={{ color: selMsg.cor }}
            >
              {selMsg.texto}
            </div>
          </div>
          <Link
            to="/admin/dashboard"
            style={{
              display: 'block',
              marginTop: 16,
              textAlign: 'center',
              color: 'var(--fuel, #f97316)',
              fontSize: '0.9rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            ← Voltar ao Hub Mestre
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleLogout}
            style={{
              width: '100%',
              marginTop: 8,
              background: 'transparent',
              color: '#78716c',
              border: '1px dashed #d6d3d1',
            }}
          >
            Trocar de usuário
          </button>
        </div>
      </section>
    )
  }

  // ===== Portal ativo =====
  const ca = obterCaMesclado(portal.prefeituraId)
  const postoInfo = encontrarPostoCredenciado(ca, portal.postoId)
  const labelPref = prefeituraLabel(portal.prefeituraId)
  const nomeUsuario = user.nome || user.usuario
  const postoNome = postoInfo
    ? postoInfo.nomeFantasia || postoInfo.razaoSocial || portal.postoId
    : portal.postoId
  const usuarioLogadoTexto = portal.controle
    ? `Conectado (controle Hub): ${nomeUsuario} · ${labelPref} · ${postoNome}`
    : `Conectado: ${nomeUsuario} · ${labelPref} · Posto credenciado`

  return (
    <div id="appShell">
      <div id="sidebar">
        <div className="logo-area">
          <h2>horautil360</h2>
          <small>Portal do posto credenciado</small>
          <p id="posto-ctx-pref" style={{ margin: '10px 0 0' }}>
            {labelPref}
          </p>
          <p
            id="posto-nome-banner"
            style={{
              margin: '10px 0 0',
              fontSize: '0.85rem',
              color: '#fafaf9',
              fontWeight: 700,
            }}
          >
            {postoNome}
          </p>
        </div>
        <div
          className={`nav-item ${secaoAtiva === 'inicio' ? 'active' : ''}`}
          onClick={() => setSecaoAtiva('inicio')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setSecaoAtiva('inicio')
            }
          }}
        >
          🏠 Início
        </div>
        <div
          className={`nav-item ${secaoAtiva === 'abs' ? 'active' : ''}`}
          onClick={() => setSecaoAtiva('abs')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setSecaoAtiva('abs')
            }
          }}
        >
          ⛽ Abastecimentos no posto
        </div>
        <div
          className={`nav-item ${secaoAtiva === 'fat' ? 'active' : ''}`}
          onClick={() => setSecaoAtiva('fat')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setSecaoAtiva('fat')
            }
          }}
        >
          💰 Faturamento &amp; NF mensal
        </div>
      </div>

      <div id="main">
        <div className="app-topbar">
          <Link to="/admin/dashboard" className="hub-link">
            ← Hub Mestre
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              id="usuarioLogado"
              style={{ fontSize: '0.88rem', color: '#57534e' }}
            >
              {usuarioLogadoTexto}
            </span>
            {portal.controle ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{
                  width: 'auto',
                  margin: 0,
                  padding: '10px 16px',
                  textTransform: 'none',
                }}
                onClick={trocarPosto}
              >
                Trocar posto
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                width: 'auto',
                margin: 0,
                padding: '10px 16px',
                textTransform: 'none',
              }}
              onClick={handleLogout}
            >
              Sair
            </button>
          </div>
        </div>

        <p className="intro">
          Este portal mostra apenas os abastecimentos registrados na
          prefeitura em que o seu posto aparece como{' '}
          <strong>posto credenciado</strong>. Cadastro de postos e usuários
          continua no <strong>Hub → Controle</strong>.
        </p>

        <div
          id="posto-inicio"
          className={`tab-content ${secaoAtiva === 'inicio' ? 'active' : ''}`}
        >
          <h1 style={{ margin: '0 0 8px', fontSize: '1.35rem' }}>
            Resumo operacional
          </h1>
          <p
            style={{
              color: '#78716c',
              fontSize: '0.88rem',
              margin: '0 0 20px',
            }}
          >
            Indicadores do mês corrente para o seu posto.
          </p>
          <div className="kpi-grid">
            <div className="kpi">
              <p>Abastecimentos (mês)</p>
              <h3 id="posto-kpi-abs-mes">{kpis?.absMes ?? '—'}</h3>
            </div>
            <div className="kpi" style={{ borderLeftColor: '#0284c7' }}>
              <p>Litros (mês)</p>
              <h3 id="posto-kpi-litros-mes">{kpis?.litrosMes ?? '—'}</h3>
            </div>
            <div className="kpi" style={{ borderLeftColor: '#16a34a' }}>
              <p>Valor cupons (mês)</p>
              <h3 id="posto-kpi-valor-mes">{kpis?.valorMes ?? '—'}</h3>
            </div>
            <div className="kpi" style={{ borderLeftColor: '#9333ea' }}>
              <p>Total histórico no portal</p>
              <h3 id="posto-kpi-total-geral">
                {kpis?.totalGeralAbs ?? '—'}
              </h3>
            </div>
          </div>
          <div className="card">
            <h3>O que você vê aqui</h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                color: '#57534e',
                lineHeight: 1.6,
                fontSize: '0.9rem',
              }}
            >
              <li>
                Lista filtrada pelo{' '}
                <code
                  style={{
                    background: '#f5f5f4',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  postoId
                </code>{' '}
                do seu login.
              </li>
              <li>
                Dados gravados no mesmo armazenamento da prefeitura
                (demonstração no navegador).
              </li>
              <li>
                Para novos postos e logins, use o Hub:{' '}
                <strong>Gestão → Parceiros e postos</strong> e{' '}
                <strong>Controle → Acessos e logins</strong>.
              </li>
            </ul>
          </div>
        </div>

        <div
          id="posto-fat"
          className={`tab-content ${secaoAtiva === 'fat' ? 'active' : ''}`}
        >
          <h1 style={{ margin: '0 0 8px', fontSize: '1.35rem' }}>
            Faturamento e relatório mensal
          </h1>
          <p className="intro">
            Consolidação por <strong>equipamento / veículo</strong> no mês
            para conferência e <strong>anexo à nota fiscal</strong>. O valor
            a faturar usa o <strong>preço unitário do edital</strong> (R$/L)
            × total de litros.{' '}
            <strong>Apenas abastecimentos registrados no seu posto</strong>{' '}
            entram neste relatório.
          </p>

          <div className="posto-fat-zone">
            <div className="posto-fat-filters">
              <div>
                <label htmlFor="posto-fat-mes">Mês de referência</label>
                <select
                  id="posto-fat-mes"
                  value={fatMes}
                  onChange={(e) => setFatMes(e.target.value)}
                >
                  {fatMesChoices.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="posto-fat-secretaria">
                  Secretaria / departamento
                </label>
                <select
                  id="posto-fat-secretaria"
                  value={fatSecretaria}
                  onChange={(e) => setFatSecretaria(e.target.value)}
                >
                  {SECRETARIAS_OPCOES.map((s) => (
                    <option key={s} value={s}>
                      {s === '__todas__' ? 'Todas' : s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="posto-fat-kpi-grid">
              <div className="posto-fat-kpi kpi-blue">
                <p>Total de litros (mês)</p>
                <h3 id="posto-fat-kpi-litros">
                  {fatSnapshot
                    ? fatSnapshot.agg.totalLitros.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }) + ' L'
                    : '—'}
                </h3>
              </div>
              <div className="posto-fat-kpi kpi-green">
                <p>Valor unitário (edital)</p>
                <h3 id="posto-fat-kpi-edital">
                  {fatSnapshot
                    ? fatSnapshot.agg.valorUnitarioEdital.toLocaleString(
                        'pt-BR',
                        { style: 'currency', currency: 'BRL' },
                      ) + ' / L'
                    : '—'}
                </h3>
              </div>
              <div className="posto-fat-kpi kpi-orange">
                <p>Total a faturar (prefeitura)</p>
                <h3 id="posto-fat-kpi-total">
                  {fatSnapshot
                    ? fatSnapshot.agg.totalFaturar.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })
                    : '—'}
                </h3>
              </div>
            </div>

            <div
              className="card"
              style={{
                marginBottom: 0,
                padding: 0,
                overflow: 'hidden',
                borderLeftColor: '#0284c7',
              }}
            >
              <div className="posto-fat-table-head">
                <h4>Detalhamento por equipamento / veículo</h4>
                <div className="posto-fat-table-tools">
                  <button
                    type="button"
                    className="btn btn-outline-posto"
                    style={{
                      width: 'auto',
                      margin: 0,
                      padding: '10px 14px',
                    }}
                    disabled={!fatSnapshot || fatSnapshot.agg.rows.length === 0}
                    onClick={() =>
                      fatSnapshot &&
                      postoExportarFaturamentoCsvFromSnapshot(fatSnapshot)
                    }
                  >
                    Exportar Excel (CSV)
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      width: 'auto',
                      margin: 0,
                      padding: '10px 14px',
                    }}
                    disabled={!fatSnapshot || fatSnapshot.agg.rows.length === 0}
                    onClick={() =>
                      fatSnapshot &&
                      postoExportarFaturamentoPdfFromSnapshot(fatSnapshot)
                    }
                  >
                    Exportar PDF (imprimir)
                  </button>
                </div>
              </div>
              <table style={{ margin: 0, borderRadius: 0 }}>
                <thead>
                  <tr>
                    <th>Equipamento</th>
                    <th>Qtd abastecimentos</th>
                    <th>Total litros</th>
                    <th>Valor total (R$) — edital</th>
                  </tr>
                </thead>
                <tbody id="posto-tbody-fat">
                  {fatSnapshot?.agg.rows.map((r) => (
                    <tr key={r.equip}>
                      <td>{r.equip}</td>
                      <td>{r.qtd}</td>
                      <td>
                        {r.litros.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        L
                      </td>
                      <td>
                        <strong>
                          {r.valorFaturar.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!fatSnapshot || fatSnapshot.agg.rows.length === 0 ? (
                <p
                  id="posto-fat-sem-dados"
                  style={{
                    padding: 16,
                    color: '#78716c',
                    fontSize: '0.88rem',
                    margin: 0,
                  }}
                >
                  Nenhum abastecimento no período com os filtros selecionados.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div
          id="posto-abs"
          className={`tab-content ${secaoAtiva === 'abs' ? 'active' : ''}`}
        >
          <h1 style={{ margin: '0 0 8px', fontSize: '1.35rem' }}>
            Abastecimentos realizados no seu posto
          </h1>
          <p
            style={{
              color: '#78716c',
              fontSize: '0.88rem',
              margin: '0 0 16px',
            }}
          >
            Filtre por mês de referência (data do cupom).
          </p>
          <div className="card" style={{ borderLeftColor: '#0284c7' }}>
            <label htmlFor="posto-sel-mes-abs">
              <strong>Mês de referência</strong>
            </label>
            <select
              id="posto-sel-mes-abs"
              aria-label="Filtrar por mês"
              value={mesAbs}
              onChange={(e) => setMesAbs(e.target.value)}
            >
              {mesAbsChoices.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="card">
            <h3>Detalhamento</h3>
            <table>
              <thead>
                <tr>
                  <th>Data / hora</th>
                  <th>Veículo</th>
                  <th>Motorista</th>
                  <th>Combustível</th>
                  <th>Litros</th>
                  <th>Valor</th>
                  <th>Cupom/NF</th>
                </tr>
              </thead>
              <tbody id="posto-tbody-abs">
                {absRows.map((a, i) => (
                  <tr key={`${a.cupomFiscal ?? 'cup'}-${i}`}>
                    <td>
                      {esc(a.data)} {esc(a.hora || '')}
                    </td>
                    <td>{esc(a.veiculo)}</td>
                    <td>{esc(a.motorista || '—')}</td>
                    <td>{esc(a.combustivel || '—')}</td>
                    <td>{esc(a.litros != null ? a.litros : '—')}</td>
                    <td>{esc(a.valorTotal || '—')}</td>
                    <td>{esc(a.cupomFiscal || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {absRows.length === 0 ? (
              <p id="posto-sem-abs">
                Nenhum abastecimento neste período para este posto.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
