import { useEffect, useState } from "react";
import { checklistsRegistrosApi } from "../../../lib/api/checklists-registros";
import { riskTriageApi } from "../../../lib/api/risk-triage";
import {
  mapRegistroParaRisco,
  mapRiskTriageParaUi,
  ordenarRiscosPorNivel,
  type RiscoUiRow,
} from "../../../lib/api/risco-from-checklist";

interface RiscosSectionProps {
  prefeituraId: string;
}

export function RiscosSection({ prefeituraId }: RiscosSectionProps) {
  const [rows, setRows] = useState<RiscoUiRow[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!prefeituraId) return;
    let cancelled = false;
    setCarregando(true);

    (async () => {
      try {
        // Fonte oficial: runs/answers classificados no Nest.
        const triage = await riskTriageApi.listarPorPrefeitura(prefeituraId);
        if (cancelled) return;
        if (triage.length > 0) {
          setRows(
            ordenarRiscosPorNivel(triage.map(mapRiskTriageParaUi)),
          );
          return;
        }
      } catch (err) {
        console.warn(
          "[Riscos] /risk-triage indisponível; fallback checklistsRegistros:",
          err,
        );
      }

      try {
        // Fallback: registros legados do PWA, com contagem real de "Não".
        const lista =
          await checklistsRegistrosApi.listarPorPrefeitura(prefeituraId);
        if (cancelled) return;
        setRows(ordenarRiscosPorNivel(lista.map(mapRegistroParaRisco)));
      } catch (err) {
        console.error("[Riscos] Erro ao carregar:", err);
        if (!cancelled) setRows([]);
      }
    })().finally(() => {
      if (!cancelled) setCarregando(false);
    });

    return () => {
      cancelled = true;
    };
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
