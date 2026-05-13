import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "@firebase/firestore";
import { db } from "../../../lib/firebase/firebase";

interface CadastrosSectionProps {
  prefeituraId: string;
}

interface EquipamentoDoc {
  id: string;
  label: string;
  chassis: string;
  marca: string;
  modelo: string;
  linha: string;
}

interface OperadorDoc {
  id: string;
  nome: string;
  cargo: string;
}

const LINHAS = [
  "Linha Amarela — máquinas pesadas",
  "Linha Branca — caminhões",
  "Linha Leve — carros e utilitários",
];

const CARGOS = ["Operador de Máquinas", "Motorista", "Mecânico", "Outro"];

export function CadastrosSection({ prefeituraId }: CadastrosSectionProps) {
  // --- Equipamentos ---
  //@ts-ignore
  const [equipamentos, setEquipamentos] = useState<EquipamentoDoc[]>([]);
  const [eLabel, setELabel] = useState("");
  const [eChassis, setEChassis] = useState("");
  const [eMarca, setEMarca] = useState("");
  const [eModelo, setEModelo] = useState("");
  const [eLinha, setELinha] = useState(LINHAS[0]);
  const [eSaving, setESaving] = useState(false);
  const [eMsg, setEMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // --- Operadores ---
  //@ts-ignore
  const [operadores, setOperadores] = useState<OperadorDoc[]>([]);
  const [oNome, setONome] = useState("");
  const [oCargo, setOCargo] = useState(CARGOS[0]);
  const [oSaving, setOSaving] = useState(false);
  const [oMsg, setOMsg] = useState<{ ok: boolean; text: string } | null>(null);

  //@ts-ignore
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setLoading(true);
    try {
      const [snapEq, snapOp] = await Promise.all([
        getDocs(
          query(
            collection(db, "equipamentos"),
            where("prefeituraId", "==", prefeituraId),
            orderBy("createdAt", "desc"),
          ),
        ),
        getDocs(
          query(
            collection(db, "operadores"),
            where("prefeituraId", "==", prefeituraId),
            orderBy("createdAt", "desc"),
          ),
        ),
      ]);
      setEquipamentos(
        snapEq.docs.map((d) => ({
          id: d.id,
          label: (d.data().label as string) ?? d.data().descricao ?? "",
          chassis: (d.data().chassis as string) ?? "",
          marca: (d.data().marca as string) ?? "",
          modelo: (d.data().modelo as string) ?? "",
          linha: (d.data().linha as string) ?? "",
        })),
      );
      setOperadores(
        snapOp.docs.map((d) => ({
          id: d.id,
          nome: (d.data().nome as string) ?? "",
          cargo: (d.data().cargo as string) ?? "",
        })),
      );
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleCadastrarEquipamento() {
    setEMsg(null);
    if (!eLabel.trim()) {
      setEMsg({ ok: false, text: "Informe a descrição do equipamento." });
      return;
    }
    if (!eChassis.trim()) {
      setEMsg({ ok: false, text: "Informe o chassis / prefixo." });
      return;
    }
    setESaving(true);
    try {
      await addDoc(collection(db, "equipamentos"), {
        prefeituraId,
        label: eLabel.trim(),
        chassis: eChassis.trim(),
        marca: eMarca.trim(),
        modelo: eModelo.trim(),
        linha: eLinha,
        status: "Ativo",
        createdAt: serverTimestamp(),
      });
      setEMsg({ ok: true, text: "Equipamento cadastrado com sucesso!" });
      setELabel("");
      setEChassis("");
      setEMarca("");
      setEModelo("");
      setELinha(LINHAS[0]);
      await carregar();
    } catch {
      setEMsg({ ok: false, text: "Erro ao salvar. Tente novamente." });
    } finally {
      setESaving(false);
    }
  }

  async function handleCadastrarOperador() {
    setOMsg(null);
    if (!oNome.trim()) {
      setOMsg({ ok: false, text: "Informe o nome do operador." });
      return;
    }
    setOSaving(true);
    try {
      await addDoc(collection(db, "operadores"), {
        prefeituraId,
        nome: oNome.trim(),
        cargo: oCargo,
        createdAt: serverTimestamp(),
      });
      setOMsg({ ok: true, text: "Operador cadastrado com sucesso!" });
      setONome("");
      setOCargo(CARGOS[0]);
      await carregar();
    } catch {
      setOMsg({ ok: false, text: "Erro ao salvar. Tente novamente." });
    } finally {
      setOSaving(false);
    }
  }
  //@ts-ignore
  async function removerEquipamento(id: string) {
    await deleteDoc(doc(db, "equipamentos", id));
    setEquipamentos((prev) => prev.filter((e) => e.id !== id));
  }
  //@ts-ignore
  async function removerOperador(id: string) {
    await deleteDoc(doc(db, "operadores", id));
    setOperadores((prev) => prev.filter((o) => o.id !== id));
  }

  return (
    <>
      <h1>Cadastros</h1>
      <p
        style={{
          color: "var(--text-gray)",
          fontSize: "0.88rem",
          marginBottom: 20,
          lineHeight: 1.5,
          maxWidth: 760,
        }}
      >
        Equipamentos e operadores cadastrados aqui ficam disponíveis ao abrir
        uma O.S. na aba <strong>Abrir O.S.</strong>
      </p>

      <div className="grid">
        {/* Formulário de Equipamento */}
        <article className="card">
          <h3>+ Novo Equipamento</h3>
          <label>Descrição *</label>
          <input
            type="text"
            placeholder="Ex: Patrola frota TL-12"
            value={eLabel}
            onChange={(e) => setELabel(e.target.value)}
          />
          <label>Chassis / Prefixo *</label>
          <input
            type="text"
            placeholder="Ex: TL-15"
            value={eChassis}
            onChange={(e) => setEChassis(e.target.value)}
          />
          <label>Marca</label>
          <input
            type="text"
            placeholder="Ex: Caterpillar"
            value={eMarca}
            onChange={(e) => setEMarca(e.target.value)}
          />
          <label>Modelo</label>
          <input
            type="text"
            placeholder="Ex: 924G"
            value={eModelo}
            onChange={(e) => setEModelo(e.target.value)}
          />
          <label>Linha / Classificação</label>
          <select value={eLinha} onChange={(e) => setELinha(e.target.value)}>
            {LINHAS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          {eMsg ? (
            <p
              style={{
                marginTop: 8,
                fontSize: "0.85rem",
                fontWeight: 600,
                color: eMsg.ok ? "#15803d" : "#dc2626",
              }}
            >
              {eMsg.text}
            </p>
          ) : null}
          <button
            className="btn"
            type="button"
            style={{
              opacity: eSaving ? 0.7 : 1,
              cursor: eSaving ? "not-allowed" : "pointer",
            }}
            disabled={eSaving}
            onClick={() => {
              void handleCadastrarEquipamento();
            }}
          >
            {eSaving ? "Salvando..." : "Cadastrar Equipamento"}
          </button>
        </article>

        {/* Formulário de Operador */}
        <article className="card">
          <h3>+ Novo Operador</h3>
          <label>Nome Completo *</label>
          <input
            type="text"
            placeholder="Ex: José Ferreira"
            value={oNome}
            onChange={(e) => setONome(e.target.value)}
          />
          <label>Cargo</label>
          <select value={oCargo} onChange={(e) => setOCargo(e.target.value)}>
            {CARGOS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {oMsg ? (
            <p
              style={{
                marginTop: 8,
                fontSize: "0.85rem",
                fontWeight: 600,
                color: oMsg.ok ? "#15803d" : "#dc2626",
              }}
            >
              {oMsg.text}
            </p>
          ) : null}
          <button
            className="btn"
            type="button"
            style={{
              opacity: oSaving ? 0.7 : 1,
              cursor: oSaving ? "not-allowed" : "pointer",
            }}
            disabled={oSaving}
            onClick={() => {
              void handleCadastrarOperador();
            }}
          >
            {oSaving ? "Salvando..." : "Cadastrar Operador"}
          </button>
        </article>
      </div>

      {/* Listas */}
      {/* <div className="grid" style={{ marginTop: 28 }}>
        <article className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>Equipamentos cadastrados</h3>
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                width: "auto",
                padding: "4px 10px",
                margin: 0,
                fontSize: "0.78rem",
              }}
              onClick={() => {
                void carregar();
              }}
              disabled={loading}
            >
              {loading ? "..." : "↻"}
            </button>
          </div>
          {equipamentos.length === 0 ? (
            <p style={{ color: "var(--text-gray)", fontSize: "0.88rem" }}>
              Nenhum equipamento cadastrado ainda.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {equipamentos.map((e) => (
                <li
                  key={e.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid #1f2937",
                    gap: 8,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.9rem" }}>{e.label}</strong>
                    <br />
                    <span
                      style={{ fontSize: "0.78rem", color: "var(--text-gray)" }}
                    >
                      {e.chassis}
                      {e.marca ? ` · ${e.marca}` : ""}
                      {e.modelo ? ` ${e.modelo}` : ""}
                      {" · "}
                      <em>{e.linha}</em>
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Remover equipamento"
                    title="Remover"
                    style={{
                      background: "transparent",
                      border: "1px solid #374151",
                      borderRadius: 4,
                      color: "#dc2626",
                      cursor: "pointer",
                      padding: "3px 8px",
                      fontSize: "0.8rem",
                      flexShrink: 0,
                    }}
                    onClick={() => {
                      void removerEquipamento(e.id);
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>Operadores cadastrados</h3>
          </div>
          {operadores.length === 0 ? (
            <p style={{ color: "var(--text-gray)", fontSize: "0.88rem" }}>
              Nenhum operador cadastrado ainda.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {operadores.map((o) => (
                <li
                  key={o.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid #1f2937",
                    gap: 8,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.9rem" }}>{o.nome}</strong>
                    <br />
                    <span
                      style={{ fontSize: "0.78rem", color: "var(--text-gray)" }}
                    >
                      {o.cargo}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Remover operador"
                    title="Remover"
                    style={{
                      background: "transparent",
                      border: "1px solid #374151",
                      borderRadius: 4,
                      color: "#dc2626",
                      cursor: "pointer",
                      padding: "3px 8px",
                      fontSize: "0.8rem",
                      flexShrink: 0,
                    }}
                    onClick={() => {
                      void removerOperador(o.id);
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div> */}
    </>
  );
}
