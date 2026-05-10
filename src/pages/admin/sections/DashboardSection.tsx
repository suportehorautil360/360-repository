import { VisaoGeralDashboard } from '../VisaoGeralDashboard'
import { MOCK_CLIENTES } from '../mockClientes'

export function DashboardSection() {
  return (
    <section id="dashboard" className="aba-conteudo ativa">
      <h2>Dashboard</h2>
      <p
        className="topbar-user"
        style={{ marginBottom: 14, maxWidth: 920, lineHeight: 1.5 }}
      >
        Visão consolidada de <strong>todos os clientes contratantes</strong>{' '}
        (prefeituras e empresas de locação). Use <strong>Abrir painel</strong>{' '}
        para o módulo certo — municipal ou locação — conforme o tipo do
        contrato. Os gráficos abaixo seguem o{' '}
        <strong>município ou cliente em foco</strong> na barra superior.
      </p>

      <VisaoGeralDashboard clientes={MOCK_CLIENTES} />
    </section>
  )
}
