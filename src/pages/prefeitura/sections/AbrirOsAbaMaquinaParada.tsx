import {
  badgeOficinaCls,
  MAQUINAS_PARADAS_MOCK,
} from "./abrir-os-paineis-dados";

export function AbrirOsAbaMaquinaParada() {
  const rows = MAQUINAS_PARADAS_MOCK;
  const totalParados = rows.length;
  const maiorParada = rows.length > 0 ? Math.max(...rows.map((r) => r.diasParado)) : 0;
  const aguardandoPecas = rows.filter((r) =>
    /aguardando|peça|peças|kit/i.test(r.motivo),
  ).length;

  return (
    <div className="aos-mp">
      <h2 className="aos-mp__title">
        <span className="aos-mp__title-icon" aria-hidden>
          ⚠️
        </span>
        Painel de disponibilidade da frota (down-time)
      </h2>

      <div className="aos-mp__cards">
        <article className="aos-mp-card">
          <span className="aos-mp-card__label">Total de ativos parados</span>
          <strong className="aos-mp-card__valor aos-mp-card__valor--danger">
            {totalParados} equipamentos
          </strong>
        </article>
        <article className="aos-mp-card">
          <span className="aos-mp-card__label">Maior tempo de parada</span>
          <strong className="aos-mp-card__valor aos-mp-card__valor--warn">
            {maiorParada} dias
          </strong>
        </article>
        <article className="aos-mp-card">
          <span className="aos-mp-card__label">Aguardando peças</span>
          <strong className="aos-mp-card__valor aos-mp-card__valor--warn">
            {aguardandoPecas} O.S.
          </strong>
        </article>
      </div>

      <div className="aos-mp-table-scroll">
        <table className="aos-mp-table">
          <thead>
            <tr>
              <th>O.S.</th>
              <th>Equipamento / modelo</th>
              <th>Motivo técnico da parada (gargalo)</th>
              <th>Dias parado</th>
              <th>Horas totais</th>
              <th>Oficina</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.os}>
                <td className="aos-mp-col-os">{r.os}</td>
                <td className="aos-mp-col-equip">{r.equipamento}</td>
                <td className="aos-mp-col-motivo">{r.motivo}</td>
                <td
                  className={
                    r.diasDestaque ? "aos-mp-col-dias is-alert" : "aos-mp-col-dias"
                  }
                >
                  {r.diasParado} dias
                </td>
                <td>{r.horasTotais} hrs</td>
                <td>
                  <span
                    className={`aos-mp-badge ${badgeOficinaCls(r.tomOficina)}`}
                  >
                    {r.oficina}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
