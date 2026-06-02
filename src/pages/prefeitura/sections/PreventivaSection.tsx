import "./preventiva.css";
import { PREVENTIVAS_MOCK } from "./preventiva.mock";

export function PreventivaSection() {
  return (
    <section className="pv-page">
      <div className="pv-wrap">
        <div className="pv-head">
          <h1 className="pv-title">Plano de manutenção preventiva</h1>
        </div>

        <div className="pv-table-wrap">
          <table className="pv-table">
            <thead>
              <tr>
                <th>ID (Chassi / Placa)</th>
                <th>Nome do Equipamento</th>
                <th>Tipo de Medidor</th>
                <th>Plano / Intervalo</th>
                <th>Última Preventiva</th>
                <th>Próxima Preventiva (Meta)</th>
                <th>Leitura Atual</th>
                <th>Restante para Vencer</th>
                <th>Status / Alerta</th>
                <th>Última Atualização</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {PREVENTIVAS_MOCK.map((row) => {
                const statusLabel =
                  row.status === "em_dia"
                    ? "Em dia"
                    : row.status === "vencida"
                      ? "Vencida"
                      : "Próxima";
                const statusClass =
                  row.status === "em_dia"
                    ? "is-ok"
                    : row.status === "vencida"
                      ? "is-overdue"
                      : "is-next";

                return (
                  <tr key={`${row.idChassiPlaca}-${row.nomeEquipamento}`}>
                    <td>{row.idChassiPlaca}</td>
                    <td>{row.nomeEquipamento}</td>
                    <td>{row.tipoMedidor}</td>
                    <td>{row.planoIntervalo}</td>
                    <td>{row.ultimaPreventiva}</td>
                    <td>{row.proximaPreventivaMeta}</td>
                    <td>{row.leituraAtual}</td>
                    <td>{row.restanteParaVencer}</td>
                    <td>
                      <span className={`pv-status ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td>{row.ultimaAtualizacao}</td>
                    <td>
                      <button type="button" className="pv-done">
                        <span aria-hidden="true">✓</span>
                        <span>Feito</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
