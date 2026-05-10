import { useState } from 'react'
import type { ChecklistApp, DadosPrefeitura } from '../../../lib/hu360'

interface AuditoriaSectionProps {
  dados: DadosPrefeitura
}

export function AuditoriaSection({ dados }: AuditoriaSectionProps) {
  const [aberto, setAberto] = useState<{
    titulo: string
    sub: string
    checklist: ChecklistApp
  } | null>(null)

  return (
    <>
      <h1>Auditoria de Qualidade dos Checklists</h1>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Operador</th>
              <th>Equipamento</th>
              <th>Fotos Anexas</th>
              <th>Índice Confiabilidade</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody id="pf-tbody-auditoria">
            {dados.auditoria.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: 'var(--text-gray)' }}>
                  Nenhum checklist auditado.
                </td>
              </tr>
            ) : (
              dados.auditoria.map((a, i) => (
                <tr key={i}>
                  <td>{a.hora}</td>
                  <td>{a.operador}</td>
                  <td>{a.equipamento}</td>
                  <td>{a.fotos}</td>
                  <td style={{ color: a.alerta ? '#fca5a5' : '#86efac' }}>
                    {a.indice}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ margin: 0, padding: '6px 12px', fontSize: '0.82rem' }}
                      onClick={() =>
                        setAberto({
                          titulo: 'Checklist do app',
                          sub: `${a.operador} · ${a.equipamento}`,
                          checklist: a.checklistApp,
                        })
                      }
                    >
                      Ver checklist
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {aberto ? (
        <div
          className="pf-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setAberto(null)}
        >
          <div className="pf-modal-box pf-modal-checklist-wide" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pf-modal-fechar"
              onClick={() => setAberto(null)}
              aria-label="Fechar"
            >
              ×
            </button>
            <h2 className="pf-modal-titulo">{aberto.titulo}</h2>
            <p className="pf-modal-sub">{aberto.sub}</p>
            <div className="pf-checklist-meta">
              <div>
                <strong>Protocolo:</strong> {aberto.checklist.protocolo}
              </div>
              <div>
                <strong>Sincronizado:</strong> {aberto.checklist.sincronizadoEm}
              </div>
              <div>
                <strong>App:</strong> {aberto.checklist.versaoApp}
              </div>
              <div>
                <strong>Horímetro:</strong> {aberto.checklist.horimetroCampo}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <strong>Referência:</strong> {aberto.checklist.referenciaOs}
              </div>
            </div>
            {aberto.checklist.secoes.map((s, idx) => (
              <div key={idx} className="pf-checklist-secao">
                <h4>{s.titulo}</h4>
                <ul>
                  {s.itens.map((it, j) => (
                    <li key={j} className={!it.conforme ? 'nao-conforme' : ''}>
                      <strong>{it.item}</strong> — {it.resposta}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {aberto.checklist.observacoesCampo ? (
              <p className="pf-modal-obs">
                <strong>Observações:</strong> {aberto.checklist.observacoesCampo}
              </p>
            ) : null}
            {aberto.checklist.fotosResumo ? (
              <p className="pf-modal-obs">
                <strong>Fotos:</strong> {aberto.checklist.fotosResumo}
              </p>
            ) : null}
            {aberto.checklist.assinaturaDigital ? (
              <p style={{ marginTop: 16, fontSize: '0.82rem', color: '#64748b' }}>
                Assinatura digital: {aberto.checklist.assinaturaDigital}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
