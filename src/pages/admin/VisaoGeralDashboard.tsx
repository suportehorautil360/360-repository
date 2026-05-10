import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHU360 } from '../../lib/hu360'

declare global {
  interface Window {
    hubAbrirPainelCliente?: (id: string) => void
  }
}

export type TipoCliente = 'prefeitura' | 'locadora'

export interface ClienteLinha {
  id: string
  label: string
  tipo: TipoCliente
  ativos: number
  checklists: number
  manutencao: number | string
  custoLabel?: string
  nCot?: number
  nOs?: number
}

interface VisaoGeralDashboardProps {
  clientes?: ClienteLinha[]
  reloadKey?: number | string
}

export function VisaoGeralDashboard({
  clientes: clientesProp,
  reloadKey,
}: VisaoGeralDashboardProps) {
  const { prefeituras, obterDadosPrefeitura, prefeituraLabel } = useHU360()
  const navigate = useNavigate()
  const [clientesHU360, setClientesHU360] = useState<ClienteLinha[]>([])

  useEffect(() => {
    if (clientesProp) return
    const linhas: ClienteLinha[] = prefeituras.map((p) => {
      const dados = obterDadosPrefeitura(p.id)
      const h = dados.hubDashboard
      const pm = dados.prefeituraModulo
      return {
        id: p.id,
        label: prefeituraLabel(p.id),
        tipo: 'prefeitura',
        ativos: Number(h.ativos) || 0,
        checklists: Number(h.checklists) || 0,
        manutencao: h.manutencao,
        custoLabel: h.custoLabel,
        nCot: pm?.cotacoesPendentes?.length ?? 0,
        nOs: pm?.osPendentes?.length ?? 0,
      }
    })
    setClientesHU360(linhas)
  }, [reloadKey, clientesProp, prefeituras, obterDadosPrefeitura, prefeituraLabel])

  const clientes = clientesProp ?? clientesHU360

  const totais = useMemo(() => {
    return clientes.reduce(
      (acc, c) => {
        acc.ativos += c.ativos
        acc.check += c.checklists
        acc.cot += c.nCot ?? 0
        acc.os += c.nOs ?? 0
        return acc
      },
      { ativos: 0, check: 0, cot: 0, os: 0 },
    )
  }, [clientes])

  function abrirPainelCliente(id: string) {
    if (typeof window.hubAbrirPainelCliente === 'function') {
      window.hubAbrirPainelCliente(id)
      return
    }
    navigate(`/prefeitura/${id}`)
  }

  const totalOsAberta = totais.cot + totais.os

  return (
    <>
      <div className="card-grid" style={{ marginBottom: 16 }}>
        <article className="card">
          <h3>Clientes contratantes</h3>
          <p id="hub-vg-n-pref">{clientes.length || '—'}</p>
        </article>
        <article className="card">
          <h3>Ativos (frota total)</h3>
          <p id="hub-vg-total-ativos">{totais.ativos || '—'}</p>
        </article>
        <article className="card">
          <h3>Checklists (total período)</h3>
          <p id="hub-vg-total-check">{totais.check || '—'}</p>
        </article>
        <article className="card">
          <h3>O.S. em aberto (todas)</h3>
          <p id="hub-vg-total-os-aberta">{totalOsAberta || '—'}</p>
        </article>
      </div>

      <article className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 8 }}>Contratos por cliente</h3>
        <div className="hub-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Ativos</th>
                <th>Checklists</th>
                <th>Em manutenção</th>
                <th>Custo acumulado</th>
                <th>O.S. em cotação</th>
                <th>O.S. NF / pagamento</th>
                <th>Abrir painel</th>
              </tr>
            </thead>
            <tbody id="hub-tbody-visao-geral">
              {clientes.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: 'center', color: 'var(--muted)' }}
                  >
                    Nenhum cliente carregado.
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.label}</strong>
                    </td>
                    <td>{c.ativos}</td>
                    <td>{c.checklists}</td>
                    <td>{c.manutencao}</td>
                    <td>{c.custoLabel ?? '---'}</td>
                    <td>{c.nCot ?? '---'}</td>
                    <td>{c.nOs ?? '---'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{
                          marginTop: 0,
                          padding: '6px 12px',
                          fontSize: '0.82rem',
                        }}
                        onClick={() => abrirPainelCliente(c.id)}
                      >
                        Abrir painel
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </>
  )
}
