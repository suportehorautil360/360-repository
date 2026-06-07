import { VisaoGeralDashboard } from "../VisaoGeralDashboard";

export function DashboardSection() {
  return (
    <section id="dashboard" className="aba-conteudo ativa hub-dashboard">
      <h2 className="hub-dashboard-title">Dashboard</h2>

      <VisaoGeralDashboard />
    </section>
  );
}
