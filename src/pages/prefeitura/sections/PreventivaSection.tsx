import "./preventiva.css";

type PreventivaStatus = "em_dia" | "vencida" | "proxima";

type PreventivaRow = {
  veiculo: string;
  codigo: string;
  servico: string;
  controle: string;
  intervalo: string;
  ultima: string;
  proxima: string;
  status: PreventivaStatus;
};

const PREVENTIVAS_EXEMPLO: PreventivaRow[] = [
  {
    veiculo: "Scania R450",
    codigo: "TRK-001",
    servico: "Troca de óleo",
    controle: "KM",
    intervalo: "10.000 km",
    ultima: "120.000 km",
    proxima: "130.000 km",
    status: "em_dia",
  },
  {
    veiculo: "Caterpillar 320",
    codigo: "MQ-01",
    servico: "Filtro de ar",
    controle: "Horímetro",
    intervalo: "500 h",
    ultima: "750h",
    proxima: "1250h",
    status: "vencida",
  },
  {
    veiculo: "Civic",
    codigo: "CAR-003",
    servico: "Revisão pneus",
    controle: "KM",
    intervalo: "50.000 km",
    ultima: "0 km",
    proxima: "50.000 km",
    status: "proxima",
  },
  {
    veiculo: "Sprinter",
    codigo: "VAN-002",
    servico: "Correia dentada",
    controle: "KM",
    intervalo: "70.000 km",
    ultima: "0 km",
    proxima: "70.000 km",
    status: "proxima",
  },
];

export function PreventivaSection() {
  return (
    <section className="pv-page">
      <div className="pv-wrap">
        <div className="pv-head">
          <h1 className="pv-title">Plano de manutenção preventiva</h1>
          <button type="button" className="pv-register">
            + Registrar
          </button>
        </div>

        <div className="pv-table-wrap">
          <table className="pv-table">
            <thead>
              <tr>
                <th>Veículo</th>
                <th>Serviço</th>
                <th>Controle</th>
                <th>Intervalo</th>
                <th>Última</th>
                <th>Próxima</th>
                <th>Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {PREVENTIVAS_EXEMPLO.map((row) => {
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
                  <tr key={`${row.codigo}-${row.servico}`}>
                    <td>
                      <span className="pv-vehicle">{row.veiculo}</span>
                      <small>{row.codigo}</small>
                    </td>
                    <td>{row.servico}</td>
                    <td>{row.controle}</td>
                    <td>{row.intervalo}</td>
                    <td>{row.ultima}</td>
                    <td>{row.proxima}</td>
                    <td>
                      <span className={`pv-status ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="pv-done">
                        ✓ Feito
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
