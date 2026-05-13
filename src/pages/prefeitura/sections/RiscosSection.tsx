import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "@firebase/firestore";
import { db } from "../../../lib/firebase/firebase";

interface RiscosSectionProps {
  prefeituraId: string;
}

interface RiscoRow {
  id: string;
  nivel: "Alto" | "Médio" | "Baixo";
  categoria: string;
  operador: string;
  defeito: string;
  acaoSugerida: string;
}

function parseTituloItemNao(titulo: string): {
  defeito: string;
  acaoSugerida: string;
} {
  const cleaned = titulo.replace(/^(Sim\/N[ãa]o|N[ãa]o|Sim):\s*/i, "");
  const idx = cleaned.indexOf(": ");
  if (idx === -1) return { defeito: cleaned.trim(), acaoSugerida: "—" };
  return {
    defeito: cleaned.slice(0, idx).trim(),
    acaoSugerida: cleaned.slice(idx + 2).trim(),
  };
}

const ordemNivel: Record<RiscoRow["nivel"], number> = {
  Alto: 0,
  Médio: 1,
  Baixo: 2,
};

export function RiscosSection({ prefeituraId }: RiscosSectionProps) {
  const [rows, setRows] = useState<RiscoRow[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!prefeituraId) return;
    setCarregando(true);
    getDocs(
      query(
        collection(db, "checklistsRegistros"),
        where("prefeituraId", "==", prefeituraId),
      ),
    )
      .then((snap) => {
        const fetched: RiscoRow[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const totalSim = Number(data.totalSim ?? 0);
          const totalItens = Number(data.totalItens ?? 0);
          const totalNao = Math.max(0, totalItens - totalSim);
          const nivel: RiscoRow["nivel"] =
            totalNao >= 2 ? "Alto" : totalNao === 1 ? "Médio" : "Baixo";
          const itensNao = Array.isArray(data.itensNao) ? data.itensNao : [];
          const primeiroNao = itensNao[0] as { titulo?: string } | undefined;
          const { defeito, acaoSugerida } = primeiroNao?.titulo
            ? parseTituloItemNao(String(primeiroNao.titulo))
            : { defeito: "—", acaoSugerida: "—" };
          return {
            id: d.id,
            nivel,
            categoria: String(data.categoria ?? "—"),
            operador: String(data.operador ?? "—"),
            defeito,
            acaoSugerida,
          };
        });
        fetched.sort((a, b) => ordemNivel[a.nivel] - ordemNivel[b.nivel]);
        setRows(fetched);
      })
      .catch((err) => {
        console.error("[Riscos] Erro ao carregar:", err);
      })
      .finally(() => setCarregando(false));
  }, [prefeituraId, tick]);

  return (
    <>
      <h1>Triagem de Riscos</h1>
      <p
        style={{
          color: "var(--text-gray)",
          marginBottom: 16,
          lineHeight: 1.55,
          maxWidth: "52rem",
        }}
      >
        Registros priorizados por <strong>nível de risco</strong> com base nos
        checklists recebidos. Risco calculado pela quantidade de respostas{" "}
        <strong>Não</strong> por inspeção.
      </p>
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="btn btn-outline"
          style={{ margin: 0 }}
          disabled={carregando}
          onClick={() => setTick((t) => t + 1)}
        >
          {carregando ? "Carregando..." : "Atualizar"}
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Risco</th>
              <th>Equipamento</th>
              <th>Defeito</th>
              <th>Operador</th>
              <th>Ação sugerida</th>
            </tr>
          </thead>
          <tbody id="pf-tbody-riscos">
            {carregando ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--text-gray)" }}>
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--text-gray)" }}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span
                      style={{
                        color:
                          row.nivel === "Alto"
                            ? "#fca5a5"
                            : row.nivel === "Médio"
                              ? "#fde68a"
                              : "#86efac",
                        fontWeight: 600,
                      }}
                    >
                      {row.nivel}
                    </span>
                  </td>
                  <td>{row.categoria}</td>
                  <td>{row.defeito}</td>
                  <td>{row.operador}</td>
                  <td>{row.acaoSugerida}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
