import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "@firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import "./emergencia.css";

interface EmergenciaTableProps {
  prefeituraId: string;
}

interface Emergencia {
  id: string;
  chassis: string;
  dataHora: string | null;
  descricaoCurta: string;
  fotos: string[];
  idMaquina: string;
  localizacaoGps: string;
  operador: string;
  prefeituraId: string;
  qtdFotos: number;
  statusAtendimento: string;
  tipoFalha: string;
}

function formatDataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const isResolvido = status === "Resolvido";
  return (
    <span
      style={{
        background: isResolvido
          ? "rgba(34,197,94,0.15)"
          : "rgba(239,68,68,0.15)",
        color: isResolvido ? "#86efac" : "#fca5a5",
        border: `1px solid ${isResolvido ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
        padding: "2px 10px",
        borderRadius: 4,
        fontSize: "0.76rem",
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}

function EmergenciaModal({
  emergencia,
  onClose,
}: {
  emergencia: Emergencia;
  onClose: () => void;
}) {
  const [fotoIdx, setFotoIdx] = useState(0);

  return (
    <div
      className="pf-modal-overlay emg-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="pf-modal-box emg-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="pf-modal-fechar"
          onClick={onClose}
          aria-label="Fechar"
        >
          ×
        </button>

        <p className="pf-modal-titulo" style={{ color: "#ef4444" }}>
          🚨 Emergência
        </p>
        <p className="pf-modal-sub">{emergencia.descricaoCurta}</p>

        <div className="emg-meta-grid">
          <div className="emg-meta-item">
            <span className="emg-meta-label">Chassis</span>
            <span className="emg-meta-value">{emergencia.chassis || "—"}</span>
          </div>
          <div className="emg-meta-item">
            <span className="emg-meta-label">ID Máquina</span>
            <span className="emg-meta-value">{emergencia.idMaquina}</span>
          </div>
          <div className="emg-meta-item">
            <span className="emg-meta-label">Operador</span>
            <span className="emg-meta-value">{emergencia.operador}</span>
          </div>
          <div className="emg-meta-item">
            <span className="emg-meta-label">Tipo de Falha</span>
            <span className="emg-meta-value">{emergencia.tipoFalha}</span>
          </div>
          <div className="emg-meta-item">
            <span className="emg-meta-label">Data / Hora</span>
            <span className="emg-meta-value">
              {formatDataHora(emergencia.dataHora)}
            </span>
          </div>
          <div className="emg-meta-item">
            <span className="emg-meta-label">Status</span>
            <span className="emg-meta-value">
              <StatusBadge status={emergencia.statusAtendimento} />
            </span>
          </div>
          <div className="emg-meta-item emg-meta-full">
            <span className="emg-meta-label">Localização GPS</span>
            <a
              className="emg-meta-value emg-gps-link"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(emergencia.localizacaoGps)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {emergencia.localizacaoGps}
            </a>
          </div>
        </div>

        {emergencia.fotos.length > 0 && (
          <div className="emg-fotos-section">
            <p className="emg-fotos-titulo">
              Fotos ({emergencia.fotos.length})
            </p>
            <div className="emg-foto-viewer">
              <img
                src={emergencia.fotos[fotoIdx]}
                alt={`Foto ${fotoIdx + 1}`}
                className="emg-foto-principal"
              />
              {emergencia.fotos.length > 1 && (
                <div className="emg-fotos-thumbs">
                  {emergencia.fotos.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Miniatura ${i + 1}`}
                      className={`emg-thumb ${i === fotoIdx ? "emg-thumb-active" : ""}`}
                      onClick={() => setFotoIdx(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EmergenciaTable({ prefeituraId }: EmergenciaTableProps) {
  const [rows, setRows] = useState<Emergencia[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionada, setSelecionada] = useState<Emergencia | null>(null);
  const [tick, setTick] = useState(0);
  const [atualizando, setAtualizando] = useState<string | null>(null);

  async function handleStatusChange(id: string, novoStatus: string) {
    setAtualizando(id);
    try {
      await updateDoc(doc(db, "emergenciasRegistros", id), {
        statusAtendimento: novoStatus,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, statusAtendimento: novoStatus } : r,
        ),
      );
    } catch (err) {
      console.error("[Emergencia] Erro ao atualizar status:", err);
    } finally {
      setAtualizando(null);
    }
  }

  useEffect(() => {
    if (!prefeituraId) return;
    setCarregando(true);
    getDocs(
      //idOperadorSession seria o que liga a emergência à prefeitura.
      query(
        collection(db, "emergenciasRegistros"),
        where("idOperadorSession", "==", prefeituraId),
      ),
    )
      .then((snap) => {
        const fetched: Emergencia[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            chassis: String(data.chassis ?? ""),
            dataHora:
              typeof data.dataHoraIso === "string" ? data.dataHoraIso : null,
            descricaoCurta: String(data.descricao ?? "—"),
            fotos: Array.isArray(data.fotos) ? (data.fotos as string[]) : [],
            idMaquina: String(data.idMaquina ?? "—"),
            localizacaoGps: String(data.localizacaoGps ?? "—"),
            operador: String(data.operador ?? "—"),
            prefeituraId: String(data.prefeituraId ?? ""),
            qtdFotos: Number(data.qtdFotos ?? 0),
            statusAtendimento: String(data.statusAtendimento ?? "—"),
            tipoFalha: String(data.tipoFalha ?? "—"),
          };
        });
        fetched.sort((a, b) => {
          const sa = a.dataHora ? new Date(a.dataHora).getTime() : 0;
          const sb = b.dataHora ? new Date(b.dataHora).getTime() : 0;
          return sb - sa;
        });
        setRows(fetched);
      })
      .catch((err) => {
        console.error("[Emergencia] Erro ao carregar:", err);
      })
      .finally(() => setCarregando(false));
  }, [prefeituraId, tick]);

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="btn btn-outline"
          style={{ margin: 0 }}
          disabled={carregando}
          onClick={() => setTick((t) => t + 1)}
        >
          {carregando ? "Carregando..." : "↻ Atualizar"}
        </button>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Data / Hora</th>
              <th>Chassis</th>
              <th>Operador</th>
              <th>Tipo de Falha</th>
              <th>Descrição</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={7} style={{ color: "var(--text-gray)" }}>
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: "var(--text-gray)" }}>
                  Nenhuma emergência registrada.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {formatDataHora(row.dataHora)}
                  </td>
                  <td>{row.chassis || "—"}</td>
                  <td>{row.operador}</td>
                  <td>{row.tipoFalha}</td>
                  <td style={{ maxWidth: 220 }}>{row.descricaoCurta}</td>
                  <td>
                    <select
                      className={`emg-status-select emg-status-select--${row.statusAtendimento === "Resolvido" ? "resolvido" : "aberto"}`}
                      value={row.statusAtendimento}
                      disabled={atualizando === row.id}
                      onChange={(e) =>
                        void handleStatusChange(row.id, e.target.value)
                      }
                    >
                      <option value="Aberto">🔴 Aberto</option>
                      <option value="Resolvido">🟢 Resolvido</option>
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline emg-ver-btn"
                      onClick={() => setSelecionada(row)}
                    >
                      Ver emergência
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selecionada && (
        <EmergenciaModal
          emergencia={selecionada}
          onClose={() => setSelecionada(null)}
        />
      )}
    </>
  );
}
