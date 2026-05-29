import { TIPOS_PONTO, type PontoRegistro } from "../../lib/api/pontos";
import "./jornada-inline.css";

interface Props {
  batidas: PontoRegistro[];
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Renderiza as 4 batidas (Entrada · Almoço · Volta · Saída) de um dia em
 * linha compacta — usado nas linhas da tabela da Central de Ponto. Cada
 * batida vira "08:02" com um dot de status; vazias aparecem como "—".
 * Sem ações — pra ações, abrir o drawer de detalhe.
 */
export function JornadaInline({ batidas }: Props) {
  const porTipo = new Map<PontoRegistro["tipo"], PontoRegistro>();
  for (const b of batidas) porTipo.set(b.tipo, b);

  return (
    <ul className="jornada">
      {TIPOS_PONTO.map(({ tipo, label }) => {
        const reg = porTipo.get(tipo);
        const sigla = label.charAt(0); // E/S/V/S — só pra title
        const status = reg?.status ?? "pendente";
        return (
          <li
            key={tipo}
            className={`jornada__cel ${reg ? "" : "jornada__cel--vazia"}`}
            title={reg ? `${label} · ${status}` : `${label} (sem registro)`}
          >
            <span className="jornada__abrev" aria-label={label}>
              {sigla}
            </span>
            <span className="jornada__hora">
              {reg ? horaDe(reg.timestampOriginal) : "—:—"}
            </span>
            {reg && status !== "aprovado" && (
              <span
                className={`jornada__dot jornada__dot--${status}`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
