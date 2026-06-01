import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
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
  altura?: number | string;
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
