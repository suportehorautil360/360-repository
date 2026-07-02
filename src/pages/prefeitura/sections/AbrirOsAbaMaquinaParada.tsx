import { ArrowLeft, Download } from "lucide-react";
import {
  badgeOficinaCls,
  type MaquinaParadaRow,
} from "./abrir-os-paineis-dados";
import { baixarPDFTabela } from "../../../lib/export/pdf-tabela";

interface AbrirOsAbaMaquinaParadaProps {
  rows: MaquinaParadaRow[];
  loading?: boolean;
  onVoltar?: () => void;
  /** No detalhe da O.S.: só a tabela, sem KPIs do painel geral. */
  compacto?: boolean;
  emptyText?: string;
}

export function AbrirOsAbaMaquinaParada({
  rows,
  loading = false,
  onVoltar,
  compacto = false,
  emptyText = "Nenhuma O.S. corretiva em aberto no momento.",
}: AbrirOsAbaMaquinaParadaProps) {
  const totalParados = rows.length;
  const maiorParada =
    rows.length > 0 ? Math.max(...rows.map((r) => r.diasParado)) : 0;
  const aguardandoPecas = rows.filter((r) =>
    /aguardando|peça|peças|kit/i.test(r.motivo),
  ).length;

  function gerarPdf() {
    baixarPDFTabela(`maquinas-paradas-${new Date().toISOString().slice(0, 10)}`, {
      titulo: "Painel de disponibilidade da frota (down-time)",
      subtitulo: `${totalParados} equipamento${totalParados === 1 ? "" : "s"} parado${totalParados === 1 ? "" : "s"} · gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      colunas: [
        "O.S.",
        "Equipamento / modelo",
        "Motivo técnico da parada",
        "Dias parado",
        "Horas totais",
        "Oficina",
      ],
      linhas: rows.map((r) => [
        r.os,
        r.equipamento,
        r.motivo,
        `${r.diasParado} dias`,
        `${r.horasTotais} hrs`,
        r.oficina,
      ]),
      pesos: [1, 2, 2.4, 1, 1, 1.3],
    });
  }

  return (
    <div className="aos-mp">
      {onVoltar ? (
        <header className="aos-mp__head">
          <button type="button" className="aos-detalhe__voltar" onClick={onVoltar}>
            <ArrowLeft size={14} aria-hidden="true" />
            Voltar para ordens de serviço
          </button>
        </header>
      ) : null}

      <div className="aos-mp__title-row">
        <h2 className="aos-mp__title">
          <span className="aos-mp__title-icon" aria-hidden>
            ⚠️
          </span>
          {compacto
            ? "Máquina parada — esta O.S."
            : "Painel de disponibilidade da frota (down-time)"}
        </h2>
        <button
          type="button"
          className="aos-mp__pdf"
          onClick={gerarPdf}
          disabled={loading || rows.length === 0}
        >
          <Download size={14} aria-hidden="true" />
          Gerar PDF
        </button>
      </div>

      {!compacto ? (
        <p className="aos-mp__hint">
          Equipamentos com O.S. <strong>corretiva</strong> aberta entram aqui
          automaticamente ao criar a ordem de serviço.
        </p>
      ) : (
        <p className="aos-mp__hint">
          O.S. <strong>corretiva</strong>: equipamento registrado como parado
          desde a abertura desta ordem.
        </p>
      )}

      {!compacto ? (
        <div className="aos-mp__cards">
          <article className="aos-mp-card">
            <span className="aos-mp-card__label">Total de ativos parados</span>
            <strong className="aos-mp-card__valor aos-mp-card__valor--danger">
              {loading ? "—" : `${totalParados} equipamento${totalParados === 1 ? "" : "s"}`}
            </strong>
          </article>
          <article className="aos-mp-card">
            <span className="aos-mp-card__label">Maior tempo de parada</span>
            <strong className="aos-mp-card__valor aos-mp-card__valor--warn">
              {loading ? "—" : `${maiorParada} dias`}
            </strong>
          </article>
          <article className="aos-mp-card">
            <span className="aos-mp-card__label">Aguardando peças</span>
            <strong className="aos-mp-card__valor aos-mp-card__valor--warn">
              {loading ? "—" : `${aguardandoPecas} O.S.`}
            </strong>
          </article>
        </div>
      ) : null}

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
            {loading ? (
              <tr>
                <td colSpan={6} className="aos-painel-empty">
                  Carregando máquinas paradas…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="aos-painel-empty">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
