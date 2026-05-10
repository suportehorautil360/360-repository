import { useState } from 'react'
import type {
  CotacaoPendente,
  DadosPrefeitura,
  OrcamentoDetalhado,
} from '../../../lib/hu360'

interface OrcamentosSectionProps {
  dados: DadosPrefeitura
}

export function OrcamentosSection({ dados }: OrcamentosSectionProps) {
  const cotacoes: CotacaoPendente[] = dados.prefeituraModulo?.cotacoesPendentes ?? []
  const [aberto, setAberto] = useState<{
    os: string
    titulo: string
    orcamento: OrcamentoDetalhado
  } | null>(null)
  const [aprovacoes, setAprovacoes] = useState<Record<string, string>>({})

  function aprovar(os: string, titulo: string) {
    setAprovacoes((prev) => ({ ...prev, [os]: titulo }))
  }

  return (
    <>
      <h1>Orçamentos das 3 oficinas &amp; aprovação</h1>
      <p style={{ color: 'var(--text-gray)', marginBottom: 16 }}>
        O valor na tabela é o total; em cada coluna use{' '}
        <strong>Ver orçamento</strong> para abrir itens, prazos, validade e
        observações da proposta.
      </p>

      <article className="card">
        <h3>Comparativo por O.S.</h3>
        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>O.S.</th>
                <th>Equipamento</th>
                <th>Classificação</th>
                <th>Oficina 1</th>
                <th>Oficina 2</th>
                <th>Oficina 3</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody id="pf-tbody-cotacoes">
              {cotacoes.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ color: 'var(--text-gray)' }}>
                    Nenhuma cotação pendente.
                  </td>
                </tr>
              ) : (
                cotacoes.map((c) => {
                  const aprovado = aprovacoes[c.os]
                  return (
                    <tr key={c.os}>
                      <td>
                        <strong>{c.os}</strong>
                      </td>
                      <td>{c.equip}</td>
                      <td>{c.classificacao}</td>
                      {[c.v1, c.v2, c.v3].map((v, idx) => {
                        const orc = c.orcamentosDetalhados[idx]
                        return (
                          <td key={idx}>
                            <div style={{ fontWeight: 700 }}>{v}</div>
                            {orc ? (
                              <button
                                type="button"
                                className="btn btn-outline"
                                style={{
                                  margin: '4px 4px 0 0',
                                  padding: '4px 9px',
                                  fontSize: '0.74rem',
                                }}
                                onClick={() =>
                                  setAberto({
                                    os: c.os,
                                    titulo: orc.titulo,
                                    orcamento: orc,
                                  })
                                }
                              >
                                Ver orçamento
                              </button>
                            ) : null}
                            {orc ? (
                              <button
                                type="button"
                                className="btn btn-success"
                                style={{
                                  margin: '4px 0 0',
                                  padding: '4px 9px',
                                  fontSize: '0.74rem',
                                }}
                                onClick={() => aprovar(c.os, orc.titulo)}
                              >
                                Aprovar
                              </button>
                            ) : null}
                          </td>
                        )
                      })}
                      <td>
                        {aprovado ? (
                          <span style={{ color: '#86efac', fontWeight: 700 }}>
                            ✓ Aprovado: {aprovado}
                          </span>
                        ) : (
                          c.status
                        )}
                      </td>
                      <td style={{ color: 'var(--text-gray)', fontSize: '0.78rem' }}>
                        Compare e aprove uma oficina.
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </article>

      {aberto ? (
        <div
          className="pf-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setAberto(null)}
        >
          <div className="pf-modal-box" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pf-modal-fechar"
              onClick={() => setAberto(null)}
              aria-label="Fechar"
            >
              ×
            </button>
            <h2 className="pf-modal-titulo">{aberto.titulo}</h2>
            <p className="pf-modal-sub">O.S. {aberto.os}</p>
            <div className="pf-modal-meta">
              <div>
                <strong>Prazo:</strong> {aberto.orcamento.prazoExecucao}
              </div>
              <div>
                <strong>Validade:</strong> {aberto.orcamento.validadeProposta}
              </div>
            </div>
            <table className="pf-modal-tabela">
              <thead>
                <tr>
                  <th>Item / serviço</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {aberto.orcamento.itens.map((it, i) => (
                  <tr key={i}>
                    <td>{it.descricao}</td>
                    <td style={{ textAlign: 'right' }}>{it.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="pf-modal-total">Total: {aberto.orcamento.total}</p>
            {aberto.orcamento.observacoes ? (
              <p className="pf-modal-obs">{aberto.orcamento.observacoes}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
