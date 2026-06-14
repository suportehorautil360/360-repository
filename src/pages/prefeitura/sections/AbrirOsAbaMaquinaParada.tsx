type TomOficina = "laranja" | "vermelho" | "verde";

interface MaquinaParadaRow {
  os: string;
  equipamento: string;
  motivo: string;
  diasParado: number;
  horasTotais: number;
  oficina: string;
  tomOficina: TomOficina;
  diasDestaque?: boolean;
}

const MAQUINAS_PARADAS_MOCK: MaquinaParadaRow[] = [
  {
    os: "013295",
    equipamento: "Escavadeira hidráulica CAT 320",
    motivo:
      "Vazamento crítico no cilindro mestre do braço primário. Aguardando kit de vedações.",
    diasParado: 0,
    horasTotais: 9,
    oficina: "L. Amarela",
    tomOficina: "laranja",
  },
  {
    os: "013142",
    equipamento: "Retroescavadeira JCB 3CX",
    motivo:
      "Falha severa na transmissão e travamento do conversor de torque.",
    diasParado: 12,
    horasTotais: 288,
    oficina: "L. Amarela",
    tomOficina: "vermelho",
    diasDestaque: true,
  },
  {
    os: "013210",
    equipamento: "Motoniveladora John Deere 620G",
    motivo:
      "Revisão do sistema elétrico / módulo central e substituição do chicote principal.",
    diasParado: 4,
    horasTotais: 96,
    oficina: "L. Amarela",
    tomOficina: "laranja",
  },
  {
    os: "013254",
    equipamento: "Escavadeira Sany SY215C",
    motivo:
      "Troca preventiva e alinhamento de sapatas e roletes do conjunto de esteiras.",
    diasParado: 2,
    horasTotais: 48,
    oficina: "L. Amarela",
    tomOficina: "verde",
  },
];

function badgeOficinaCls(tom: TomOficina): string {
  if (tom === "vermelho") return "aos-mp-badge--vermelho";
  if (tom === "verde") return "aos-mp-badge--verde";
  return "aos-mp-badge--laranja";
}

export function AbrirOsAbaMaquinaParada() {
  const rows = MAQUINAS_PARADAS_MOCK;
  const totalParados = rows.length;
  const maiorParada = Math.max(...rows.map((r) => r.diasParado));
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
