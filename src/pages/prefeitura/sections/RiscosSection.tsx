import type { DadosPrefeitura } from '../../../lib/hu360'

interface RiscosSectionProps {
  dados: DadosPrefeitura
}

function classeRisco(nivel: string): string {
  const n = nivel.toLowerCase()
  if (n.includes('alto') || n.includes('crít')) return 'badge-risco alto'
  if (n.includes('méd') || n.includes('med')) return 'badge-risco medio'
  return 'badge-risco baixo'
}

export function RiscosSection({ dados }: RiscosSectionProps) {
  return (
    <>
      <h1>Triagem de Riscos</h1>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Risco</th>
              <th>Equipamento</th>
              <th>Defeito</th>
              <th>Operador</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody id="pf-tbody-riscos">
            {dados.riscos.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-gray)' }}>
                  Nenhum risco identificado no período.
                </td>
              </tr>
            ) : (
              dados.riscos.map((r, i) => (
                <tr key={i}>
                  <td>
                    <span className={classeRisco(r.nivel)}>{r.nivel}</span>
                  </td>
                  <td>{r.equipamento}</td>
                  <td>{r.defeito}</td>
                  <td>{r.operador}</td>
                  <td>{r.acao}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
