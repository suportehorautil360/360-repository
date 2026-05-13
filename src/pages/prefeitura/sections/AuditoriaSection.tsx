import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "@firebase/firestore";
import { db } from "../../../lib/firebase/firebase";
import { ListaChecklistHistoricoLocal } from "../../../components/checklistHistorico/ChecklistHistoricoLista";

interface AuditoriaSectionProps {
  prefeituraId: string;
}

function normalizeChassis(s: string): string {
  return s.replace(/[\s\-_]/g, "").toUpperCase();
}

function firestoreDocToHistRow(
  docId: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const respostasJson =
    data.respostas &&
    typeof data.respostas === "object" &&
    !Array.isArray(data.respostas)
      ? JSON.stringify(data.respostas)
      : typeof data.respostas === "string"
        ? data.respostas
        : "{}";
  return {
    ID_Registro: data.id ?? docId,
    Data_Hora: data.dataHoraIso ?? "",
    Operador: data.operador ?? "",
    Chassis: data.chassis ?? "",
    Categoria: data.categoria ?? "",
    Modelo: data.modelo ?? "",
    Linha: data.linha ?? "",
    Item_Verificado: `Checklist ${data.totalItens ?? "?"} itens`,
    Status_Ok_Nao: `${data.totalSim ?? 0}/${data.totalItens ?? 0} OK`,
    Respostas_JSON: respostasJson,
    Horimetro_Final: data.horimetro ?? "",
    Pontuacao: data.pontuacao ?? 0,
    ID_Cliente: data.idOperadorSession ?? "",
    prefeituraId: data.prefeituraId ?? "",
    Obs: data.obs ?? null,
  };
}

export function AuditoriaSection({ prefeituraId }: AuditoriaSectionProps) {
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [tick, setTick] = useState(0);
  const [filtroData, setFiltroData] = useState("");
  const [filtroChassis, setFiltroChassis] = useState("");
  const [filtroOperador, setFiltroOperador] = useState("");

  useEffect(() => {
    if (!prefeituraId) {
      console.log("❌ Prefeitura ID não fornecida para AuditoriaSection");
      return;
    }
    setCarregando(true);
    getDocs(
      query(
        collection(db, "checklistsRegistros"),
        where("prefeituraId", "==", prefeituraId),
      ),
    )
      .then((snap) => {
        const fetched = snap.docs.map((d) =>
          firestoreDocToHistRow(d.id, d.data() as Record<string, unknown>),
        );
        console.log("prefeituraId para auditoria:", snap?.docs);

        fetched.sort((a, b) =>
          String(b.Data_Hora ?? "").localeCompare(String(a.Data_Hora ?? "")),
        );
        setRows(fetched);
      })
      .catch((err) => {
        console.error("[Auditoria] Erro ao carregar checklists:", err);
      })
      .finally(() => setCarregando(false));
  }, [prefeituraId, tick]);

  const filtrados = useMemo(() => {
    return rows.filter((row) => {
      if (filtroData) {
        const dh = String(row.Data_Hora ?? "");
        if (!dh.startsWith(filtroData)) return false;
      }
      if (filtroChassis.trim()) {
        const c = normalizeChassis(String(row.Chassis ?? ""));
        if (!c.includes(normalizeChassis(filtroChassis))) return false;
      }
      if (filtroOperador.trim()) {
        const op = String(row.Operador ?? "").toLowerCase();
        if (!op.includes(filtroOperador.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, filtroData, filtroChassis, filtroOperador]);

  return (
    <>
      <h1>Auditoria de Qualidade dos Checklists</h1>
      <p
        style={{
          color: "var(--text-gray)",
          marginBottom: 16,
          lineHeight: 1.55,
          maxWidth: "52rem",
        }}
      >
        Checklists registrados no servidor para este município. Expanda cada
        registro para ver horímetro, observações e itens com{" "}
        <strong>Sim</strong> ou <strong>Não</strong>.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "12px",
            alignItems: "end",
          }}
        >
          <div>
            <label
              htmlFor="aud-pf-filtro-data"
              style={{
                display: "block",
                marginBottom: 4,
                fontSize: "0.82rem",
                color: "var(--text-gray)",
              }}
            >
              Data
            </label>
            <input
              id="aud-pf-filtro-data"
              type="date"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label
              htmlFor="aud-pf-filtro-chassis"
              style={{
                display: "block",
                marginBottom: 4,
                fontSize: "0.82rem",
                color: "var(--text-gray)",
              }}
            >
              Chassi
            </label>
            <input
              id="aud-pf-filtro-chassis"
              type="text"
              placeholder="Filtrar por chassi..."
              value={filtroChassis}
              onChange={(e) => setFiltroChassis(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label
              htmlFor="aud-pf-filtro-operador"
              style={{
                display: "block",
                marginBottom: 4,
                fontSize: "0.82rem",
                color: "var(--text-gray)",
              }}
            >
              Operador
            </label>
            <input
              id="aud-pf-filtro-operador"
              type="text"
              placeholder="Filtrar por operador..."
              value={filtroOperador}
              onChange={(e) => setFiltroOperador(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, paddingBottom: 1 }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{ flex: 1, margin: 0 }}
              disabled={carregando}
              onClick={() => setTick((t) => t + 1)}
            >
              {carregando ? "Carregando..." : "Atualizar"}
            </button>
            {(filtroData || filtroChassis || filtroOperador) && (
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1, margin: 0 }}
                onClick={() => {
                  setFiltroData("");
                  setFiltroChassis("");
                  setFiltroOperador("");
                }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <div
          className="hu360-dash-checklists-panel"
          style={{ marginTop: 0, maxWidth: "100%" }}
        >
          <div className="hu360-dash-checklists-panel__head">
            <h3 className="hu360-dash-checklists-panel__title">
              {carregando
                ? "Carregando..."
                : `${filtrados.length} registro${
                    filtrados.length !== 1 ? "s" : ""
                  }${filtroData || filtroChassis || filtroOperador ? " (filtrado)" : ""}`}
            </h3>
          </div>
          {carregando ? (
            <p
              style={{
                margin: 0,
                color: "var(--text-gray)",
                fontSize: "0.92rem",
              }}
            >
              Buscando registros no servidor...
            </p>
          ) : (
            <ListaChecklistHistoricoLocal
              rows={filtrados}
              expandidoId={expandidoId}
              setExpandidoId={setExpandidoId}
              mensagemVazia="Nenhum checklist encontrado para os filtros aplicados."
            />
          )}
        </div>
      </div>
    </>
  );
}
