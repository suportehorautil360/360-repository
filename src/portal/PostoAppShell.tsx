import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePostoPortal } from './PostoPortalContext'
import {
  buildFaturamentoSnapshot,
  postoExportarFaturamentoCsvFromSnapshot,
  postoExportarFaturamentoPdfFromSnapshot,
} from './postoPortalFaturamento'
import {
  computeAbsRowsSorted,
  computeDashboardKpis,
} from './postoPortalCompute'
import { esc } from './postoPortalFormat'
import { mesesOptions } from './postoPortalHu360Data'
import { postoResolverSessaoPortal } from './postoPortalLegacy'
import type { FatUltimoSnapshot } from './postoPortalTypes'

const TAB_DASH = 'posto-tab-dash'
const TAB_ABS = 'posto-tab-abs'
const TAB_FAT = 'posto-tab-fat'

export function PostoAppShell() {
  const {
    refreshKey,
    activeTab,
    setActiveTab,
    usuarioLogadoLine,
    postoCtxPrefLine,
    logout,
  } = usePostoPortal()

  const mesAbsChoices = useMemo(() => mesesOptions(18), [])
  const fatMesChoices = useMemo(() => mesesOptions(24), [])
  const [mesAbs, setMesAbs] = useState(() => mesAbsChoices[0]?.value ?? '')
  const [fatMes, setFatMes] = useState(() => fatMesChoices[0]?.value ?? '')
  const [fatSecretaria, setFatSecretaria] = useState('__todas__')

  const portal = useMemo(() => postoResolverSessaoPortal(), [refreshKey])

  const kpis = useMemo(
    () => computeDashboardKpis(portal),
    [portal, refreshKey],
  )

  const absRows = useMemo(
    () => computeAbsRowsSorted(portal, mesAbs || null),
    [portal, mesAbs, refreshKey],
  )

  const fatSnapshot = useMemo(() => {
    if (!portal || !fatMes) return null
    const p = fatMes.split('-')
    const ano = parseInt(p[0], 10)
    const mes = parseInt(p[1], 10)
    return buildFaturamentoSnapshot(
      portal,
      ano,
      mes,
      fatSecretaria || '__todas__',
    )
  }, [portal, fatMes, fatSecretaria, refreshKey])

  useEffect(() => {
    if (fatSnapshot) {
      window.__postoFatUltimoAgg = fatSnapshot
    }
  }, [fatSnapshot])

  const gerarFat = useCallback(() => {}, [])

  useEffect(() => {
    window.postoGerarRelatorioFaturamento = () => {
      gerarFat()
    }
    window.postoExportarFaturamentoCsv = () => {
      const u: FatUltimoSnapshot | undefined = window.__postoFatUltimoAgg
      if (!u?.agg) return
      postoExportarFaturamentoCsvFromSnapshot(u)
    }
    window.postoExportarFaturamentoPdf = () => {
      const u: FatUltimoSnapshot | undefined = window.__postoFatUltimoAgg
      if (!u?.agg) return
      postoExportarFaturamentoPdfFromSnapshot(u)
    }
    return () => {
      delete window.postoGerarRelatorioFaturamento
      delete window.postoExportarFaturamentoCsv
      delete window.postoExportarFaturamentoPdf
    }
  }, [gerarFat])

  return (
    <div id="appShell" className="posto-app">
      <aside className="posto-app__aside">
        <p id="usuarioLogado" className="posto-app__user">
          {usuarioLogadoLine}
        </p>
        <button
          type="button"
          className={
            'posto-nav-item' + (activeTab === TAB_DASH ? ' active' : '')
          }
          onClick={() => setActiveTab(TAB_DASH)}
        >
          Painel
        </button>
        <button
          type="button"
          className={
            'posto-nav-item' + (activeTab === TAB_ABS ? ' active' : '')
          }
          onClick={() => setActiveTab(TAB_ABS)}
        >
          Abastecimentos
        </button>
        <button
          type="button"
          className={
            'posto-nav-item' + (activeTab === TAB_FAT ? ' active' : '')
          }
          onClick={() => setActiveTab(TAB_FAT)}
        >
          Faturamento
        </button>
        <button
          type="button"
          className="posto-nav-item"
          style={{ marginTop: 16 }}
          onClick={() => logout()}
        >
          Sair
        </button>
      </aside>
      <main className="posto-app__main">
        <p id="posto-ctx-pref" className="posto-app__ctx">
          {postoCtxPrefLine}
        </p>

        {activeTab === TAB_DASH && (
          <section className="tab-content active" id={TAB_DASH}>
            <h2>Resumo</h2>
            <p id="posto-nome-banner" className="posto-banner">
              {kpis?.postoLabel ?? '—'}
            </p>
            <div className="posto-kpis">
              <div>
                Abastecimentos no mês:{' '}
                <strong id="posto-kpi-abs-mes">{kpis?.absMes ?? '—'}</strong>
              </div>
              <div>
                Litros no mês:{' '}
                <strong id="posto-kpi-litros-mes">
                  {kpis?.litrosMes ?? '—'}
                </strong>
              </div>
              <div>
                Valor no mês:{' '}
                <strong id="posto-kpi-valor-mes">
                  {kpis?.valorMes ?? '—'}
                </strong>
              </div>
              <div>
                Total de abastecimentos:{' '}
                <strong id="posto-kpi-total-geral">
                  {kpis != null ? kpis.totalGeralAbs : '—'}
                </strong>
              </div>
            </div>
          </section>
        )}

        {activeTab === TAB_ABS && (
          <section className="tab-content active" id={TAB_ABS}>
            <h2>Abastecimentos</h2>
            <label htmlFor="posto-sel-mes-abs">Mês</label>
            <select
              id="posto-sel-mes-abs"
              className="auth-select"
              value={mesAbs}
              onChange={(e) => setMesAbs(e.target.value)}
            >
              {mesAbsChoices.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <table className="posto-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Veículo</th>
                  <th>Motorista</th>
                  <th>Combustível</th>
                  <th>Litros</th>
                  <th>Valor</th>
                  <th>Cupom</th>
                </tr>
              </thead>
              <tbody id="posto-tbody-abs">
                {absRows.map((a, i) => (
                  <tr key={i}>
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
            <p
              id="posto-sem-abs"
              style={{ display: absRows.length ? 'none' : 'block' }}
            >
              Nenhum abastecimento no período.
            </p>
          </section>
        )}

        {activeTab === TAB_FAT && (
          <section className="tab-content active" id={TAB_FAT}>
            <h2>Faturamento</h2>
            <div className="posto-fat-toolbar">
              <div>
                <label htmlFor="posto-fat-mes">Mês</label>
                <select
                  id="posto-fat-mes"
                  className="auth-select"
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
                <label htmlFor="posto-fat-secretaria">Secretaria</label>
                <select
                  id="posto-fat-secretaria"
                  className="auth-select"
                  value={fatSecretaria}
                  onChange={(e) => setFatSecretaria(e.target.value)}
                >
                  <option value="__todas__">Todas</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() =>
                  fatSnapshot &&
                  postoExportarFaturamentoCsvFromSnapshot(fatSnapshot)
                }
                disabled={!fatSnapshot}
              >
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  fatSnapshot &&
                  postoExportarFaturamentoPdfFromSnapshot(fatSnapshot)
                }
                disabled={!fatSnapshot}
              >
                Exportar PDF
              </button>
            </div>
            {fatSnapshot && (
              <>
                <div className="posto-kpis">
                  <div>
                    Litros:{' '}
                    <strong id="posto-fat-kpi-litros">
                      {fatSnapshot.agg.totalLitros.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      L
                    </strong>
                  </div>
                  <div>
                    Valor edital (R$/L):{' '}
                    <strong id="posto-fat-kpi-edital">
                      {fatSnapshot.agg.valorUnitarioEdital.toLocaleString(
                        'pt-BR',
                        { style: 'currency', currency: 'BRL' },
                      )}
                    </strong>
                  </div>
                  <div>
                    Total:{' '}
                    <strong id="posto-fat-kpi-total">
                      {fatSnapshot.agg.totalFaturar.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </strong>
                  </div>
                </div>
                <table className="posto-table">
                  <thead>
                    <tr>
                      <th>Equipamento</th>
                      <th>Qtd</th>
                      <th>Litros</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody id="posto-tbody-fat">
                    {fatSnapshot.agg.rows.map((r) => (
                      <tr key={r.equip}>
                        <td>{esc(r.equip)}</td>
                        <td>{r.qtd}</td>
                        <td>
                          {String(r.litros).replace(
                            /\B(?=(\d{3})+(?!\d))/g,
                            '.',
                          )}{' '}
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
                <p
                  id="posto-fat-sem-dados"
                  style={{
                    display: fatSnapshot.agg.rows.length ? 'none' : 'block',
                  }}
                >
                  Sem dados para o período.
                </p>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
