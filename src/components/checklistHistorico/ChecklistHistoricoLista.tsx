import {
  type Dispatch,
  type SetStateAction,
} from "react";
import seedData from "../../data/hu360OperadorSeed.json";
import { HU360_HIST_ITEM_LABELS } from "./checklistAppToHistoricoRow";
import "./checklistHistoricoLista.css";

function checklistCategoriaFromMaquina(catMaquina: string): string {
  if (catMaquina.startsWith("Caminhão")) return "Caminhões";
  return catMaquina;
}

function checklistItemLabelFromSeed(numKey: string, categoriaMaquina: string): string {
  const cat = checklistCategoriaFromMaquina(String(categoriaMaquina ?? ""));
  const it = seedData.itens_checklist.find(
    (x) => x.Categoria === cat && String(x["Nº"]) === String(numKey),
  );
  return it ? String(it["Item de Verificação"] ?? numKey) : `Item ${numKey}`;
}

export function sortChavesRespostasChecklist(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

/** Interpreta valor salvo em Respostas_JSON (legado ou objeto). */
export function parseRespostaChecklistItemUi(val: unknown): {
  ok: boolean;
  problema?: string;
  fotoProblema?: string;
} {
  if (val === "sim") return { ok: true };
  if (val === "nao") return { ok: false };
  if (val && typeof val === "object" && "v" in val) {
    const o = val as { v?: string; foto?: string; problema?: string };
    if (o.v === "sim") return { ok: true };
    if (o.v === "nao") {
      const foto =
        typeof o.foto === "string" && o.foto.startsWith("data:image") ? o.foto : undefined;
      return {
        ok: false,
        problema: typeof o.problema === "string" ? o.problema : "",
        fotoProblema: foto,
      };
    }
  }
  return { ok: false };
}

function readItemLabels(row: Record<string, unknown>): Record<string, string> | undefined {
  const v = row[HU360_HIST_ITEM_LABELS];
  if (typeof v !== "string" || !v.trim()) return undefined;
  try {
    const o = JSON.parse(v) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return undefined;
    return o as Record<string, string>;
  } catch {
    return undefined;
  }
}

function formatDataHoraCell(raw: string): string {
  const s = String(raw ?? "");
  if (!s) return "—";
  return s.slice(0, 19).replace("T", " ");
}

export function ListaChecklistHistoricoLocal({
  rows,
  expandidoId,
  setExpandidoId,
  mensagemVazia,
}: {
  rows: Record<string, unknown>[];
  expandidoId: string | null;
  setExpandidoId: Dispatch<SetStateAction<string | null>>;
  mensagemVazia: string;
}) {
  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, color: "#64748b", fontSize: "0.92rem" }}>{mensagemVazia}</p>
    );
  }
  return (
    <ul className="hu360-dash-chk-list">
      {rows.map((row, idx) => {
        const id = String(row.ID_Registro ?? `sem-id-${idx}`);
        const exp = expandidoId === id;
        const catMaquina = String(row.Categoria ?? "");
        const itemLabelMap = readItemLabels(row);
        let entradas: [string, unknown][] = [];
        const rj = row.Respostas_JSON;
        if (typeof rj === "string" && rj) {
          try {
            const o = JSON.parse(rj) as Record<string, unknown>;
            entradas = sortChavesRespostasChecklist(Object.keys(o)).map((k) => [k, o[k]]);
          } catch {
            entradas = [];
          }
        }
        return (
          <li key={id} className="hu360-dash-chk-list__item">
            <div className="hu360-dash-chk-list__row">
              <div>
                <strong>{formatDataHoraCell(String(row.Data_Hora ?? ""))}</strong>
                <span className="hu360-dash-chk-list__meta">
                  {" · "}
                  {String(row.Operador ?? "—")} · {String(row.Status_Ok_Nao ?? "")}
                </span>
              </div>
              <button
                type="button"
                className="hu360-btn hu360-btn-ghost hu360-dash-chk-list__ver"
                onClick={() => setExpandidoId((cur) => (cur === id ? null : id))}
              >
                {exp ? "Ocultar" : "Ver checklist"}
              </button>
            </div>
            {exp ? (
              <div className="hu360-dash-chk-detail">
                <p style={{ margin: "0 0 8px", fontSize: "0.88rem", color: "#334155" }}>
                  <strong>{String(row.ID_Maquina ?? "")}</strong> · {String(row.Marca ?? "")}{" "}
                  {String(row.Modelo ?? "")} · Chassi <strong>{String(row.Chassis ?? "—")}</strong>
                </p>
                <p style={{ margin: "0 0 8px", fontSize: "0.88rem" }}>
                  Horímetro: <strong>{String(row.Horimetro_Final ?? "—")}</strong>
                </p>
                {typeof row.Foto_Horimetro === "string" && row.Foto_Horimetro.startsWith("data:image") ? (
                  <div className="hu360-dash-chk-detail__hori">
                    <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Foto do horímetro</span>
                    <img src={row.Foto_Horimetro} alt="" />
                  </div>
                ) : null}
                {typeof row.Obs === "string" && row.Obs.trim() ? (
                  <p style={{ margin: "10px 0 0", fontSize: "0.86rem" }}>
                    <strong>Obs.:</strong> {row.Obs}
                  </p>
                ) : null}
                <h4 style={{ margin: "16px 0 8px", fontSize: "0.95rem" }}>Itens</h4>
                <ul className="hu360-dash-chk-itens">
                  {entradas.map(([k, val]) => {
                    const u = parseRespostaChecklistItemUi(val);
                    const lbl = itemLabelMap?.[k] ?? checklistItemLabelFromSeed(k, catMaquina);
                    return (
                      <li key={k} className={`hu360-dash-chk-itens__li ${u.ok ? "is-sim" : "is-nao"}`}>
                        <div className="hu360-dash-chk-itens__top">
                          <span className="hu360-dash-chk-itens__n">{k}</span>
                          <span className="hu360-dash-chk-itens__lbl">{lbl}</span>
                          <span className={`hu360-dash-chk-itens__tag ${u.ok ? "is-sim" : "is-nao"}`}>
                            {u.ok ? "Sim" : "Não"}
                          </span>
                        </div>
                        {!u.ok && (u.problema?.trim() || u.fotoProblema) ? (
                          <div className="hu360-dash-chk-itens__nao">
                            {u.fotoProblema ? (
                              <img
                                src={u.fotoProblema}
                                alt=""
                                className="hu360-dash-chk-itens__foto"
                              />
                            ) : null}
                            {u.problema?.trim() ? (
                              <p style={{ margin: "6px 0 0", fontSize: "0.84rem" }}>{u.problema}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
