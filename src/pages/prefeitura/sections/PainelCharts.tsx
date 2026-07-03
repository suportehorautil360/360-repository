import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export interface PontoGrafico {
  label: string;
  valor: number;
}

/**
 * Gráfico de barras genérico (recharts). Carregado sob demanda (lazy) — fica
 * num chunk próprio, fora do precache do PWA.
 */
export function GraficoBarras({
  dados,
  formato,
  destacarUltimo = false,
  altura = 200,
}: {
  dados: PontoGrafico[];
  formato?: (v: number) => string;
  destacarUltimo?: boolean;
  altura?: number | `${number}%`;
}) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} margin={{ top: 24, right: 6, left: 6, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: "#93a4c6", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Bar dataKey="valor" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {dados.map((_, i) => (
            <Cell
              key={i}
              fill={
                destacarUltimo && i === dados.length - 1 ? "#f59e0b" : "#5b4632"
              }
            />
          ))}
          <LabelList
            dataKey="valor"
            position="top"
            formatter={(label) =>
              formato ? formato(Number(label)) : String(label ?? "")
            }
            style={{ fill: "#cbd5e1", fontSize: 12, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const CORES_OPERADORES = ["#f59e0b", "#fb923c", "#ea580c", "#c2410c", "#9a3412"];

/**
 * Ranking horizontal de operadores (top N) — lazy chunk com GraficoBarras.
 */
export function GraficoBarrasHorizontais({
  dados,
  formato,
  altura = 220,
}: {
  dados: PontoGrafico[];
  formato?: (v: number) => string;
  altura?: number | `${number}%`;
}) {
  if (dados.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart
        layout="vertical"
        data={dados}
        margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
      >
        <XAxis
          type="number"
          hide
          domain={[0, (max: number) => Math.max(max * 1.15, 1)]}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={118}
          tick={{ fill: "#cbd5e1", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Bar
          dataKey="valor"
          radius={[0, 6, 6, 0]}
          isAnimationActive={false}
          barSize={22}
        >
          {dados.map((_, i) => (
            <Cell key={i} fill={CORES_OPERADORES[i] ?? "#5b4632"} />
          ))}
          <LabelList
            dataKey="valor"
            position="right"
            formatter={(label) =>
              formato ? formato(Number(label)) : String(label ?? "")
            }
            style={{ fill: "#93a4c6", fontSize: 11, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
