import type { ReactNode } from "react";
import "./kpi.css";

export type KpiTom = "neutro" | "info" | "sucesso" | "aviso" | "erro";

interface Props {
  label: string;
  valor: ReactNode;
  /** Sublabel pequena (ex.: "no período", "hoje", "vs ontem"). */
  sub?: ReactNode;
  /** Cor do número (ajuda o gestor a bater o olho). */
  tom?: KpiTom;
  /** Ícone opcional à esquerda. */
  icone?: ReactNode;
  /** Se clicável, vira card botão (foco, hover, cursor). */
  onClick?: () => void;
  /** Acessível: descreve o que o KPI representa. */
  titulo?: string;
}

/**
 * Card de KPI compacto — número grande + label + sub opcional. Reutilizável
 * em Central de Ponto, Dashboards, etc. Sem dependências.
 */
export function KpiCard({
  label,
  valor,
  sub,
  tom = "neutro",
  icone,
  onClick,
  titulo,
}: Props) {
  const conteudo = (
    <>
      <span className="kpi__label">
        {icone && <span aria-hidden="true">{icone}</span>}
        {label}
      </span>
      <strong className={`kpi__valor kpi__valor--${tom}`}>{valor}</strong>
      {sub && <span className="kpi__sub">{sub}</span>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="kpi kpi--clicavel"
        onClick={onClick}
        title={titulo}
      >
        {conteudo}
      </button>
    );
  }
  return (
    <div className="kpi" title={titulo}>
      {conteudo}
    </div>
  );
}
