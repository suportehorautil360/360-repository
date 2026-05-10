import type { DadosPrefeitura } from '../../../lib/hu360'

interface DashboardSectionProps {
  dados: DadosPrefeitura
}

function formatBRL(v: number): string {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`
  return `R$ ${v.toFixed(0)}`
}

function MaxBars({
  values,
  labels,
  alt,
  fmt,
}: {
  values: number[]
  labels: string[]
  alt?: boolean
  fmt?: (v: number) => string
}) {
  const max = Math.max(...values, 1)
  return (
    <div className="pf-bars-wrap">
      <div className="pf-bars">
        {values.map((v, i) => (
          <div
            key={i}
            className={`bar ${alt ? 'alt' : ''}`}
            style={{ height: `${Math.max(8, (v / max) * 140)}px` }}
          >
            <span className="bar-label">{fmt ? fmt(v) : v}</span>
            <span className="bar-foot">{labels[i] ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardSection({ dados }: DashboardSectionProps) {
  const h = dados.hubDashboard
  const g = dados.prefeituraModulo.dashboardGraficos

  return (
    <>
      <h1>Dashboard Estratégica</h1>

      <div className="card-grid">
        <article className="card">
          <h3>Total de Ativos</h3>
          <p>{h.ativos}</p>
        </article>
        <article className="card">
          <h3>Checklists Recebidos</h3>
          <p>{h.checklists}</p>
        </article>
        <article className="card">
          <h3>Em Manutenção</h3>
          <p>{h.manutencao}</p>
        </article>
        <article className="card">
          <h3>Custo Acumulado</h3>
          <p>{h.custoLabel}</p>
        </article>
      </div>

      <p
        className="topbar-user"
        style={{ margin: '0 0 10px', fontSize: '0.82rem' }}
      >
        {g.tituloPeriodo}
      </p>
      <div className="dash-graficos-grid">
        <article className="card chart-wrap">
          <h3>Gastos com manutenção</h3>
          <p className="chart-sub">Valores no mês (R$) por semana</p>
          <MaxBars values={g.gastosReais} labels={g.gastosLabels} fmt={formatBRL} />
        </article>
        <article className="card chart-wrap">
          <h3>Checklists recebidos</h3>
          <p className="chart-sub">Volume recebido no mês por semana</p>
          <MaxBars values={g.checklistRecebidos} labels={g.checklistLabels} alt />
        </article>
        <article className="card chart-wrap wide">
          <h3>Top 5 operadores — checklists bem feitos no mês</h3>
          <p className="chart-sub">
            Ranking por quantidade de checklists com qualidade alta (índice de
            confiabilidade no período)
          </p>
          <ol className="pf-rank-list">
            {g.topOperadores.map((op, i) => (
              <li key={op.nome}>
                <span>
                  <span className="rank-pos">{i + 1}.</span> {op.nome}
                </span>
                <span className="rank-vals">
                  {op.bemFeitos} bem feitos · {op.indice}
                </span>
              </li>
            ))}
          </ol>
        </article>
      </div>
    </>
  )
}
