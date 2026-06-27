import { fmtValorNotaFiscal } from "../../../lib/api/notas-fiscais";

export interface PontoGraficoSimples {
  label: string;
  valor: number;
}

export function NotasFiscaisGraficoBarras({
  dados,
  formato,
}: {
  dados: PontoGraficoSimples[];
  formato?: (v: number) => string;
}) {
  if (dados.length === 0) {
    return <p className="nf-chart-empty">Sem dados no período.</p>;
  }

  const max = Math.max(...dados.map((d) => d.valor), 1);
  const fmt = formato ?? ((v: number) => String(v));

  return (
    <div className="nf-bar-chart">
      {dados.map((item) => {
        const pct = Math.max(4, (item.valor / max) * 100);
        return (
          <div key={item.label} className="nf-bar-row">
            <span className="nf-bar-label" title={item.label}>
              {item.label}
            </span>
            <div className="nf-bar-track" aria-hidden>
              <div className="nf-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="nf-bar-value">{fmt(item.valor)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function fmtMoedaGrafico(v: number): string {
  return fmtValorNotaFiscal(v);
}
