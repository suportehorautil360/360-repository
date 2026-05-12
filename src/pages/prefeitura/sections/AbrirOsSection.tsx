import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "@firebase/firestore";
import { db } from "../../../lib/firebase/firebase";
import type { DadosPrefeitura } from "../../../lib/hu360";

interface AbrirOsSectionProps {
  dados: DadosPrefeitura;
  prefeituraId: string;
}

interface OficinaCredenciada {
  id: string;
  nome: string;
  especialidade: string;
}

function gerarProtocoloOs(): string {
  const ano = new Date().getFullYear();
  const seq = String(Math.floor(Date.now() / 1000) % 1000).padStart(3, "0");
  return `OS-${ano}-${seq}`;
}

function normEsp(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function especialidadeCompativel(
  especialidade: string,
  linha: string,
): boolean {
  const e = normEsp(especialidade);
  const l = normEsp(linha);
  return e === l || e.includes(l) || l.includes(e);
}

function sortearAte<T>(arr: T[], max: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, max);
}

export function AbrirOsSection({ dados, prefeituraId }: AbrirOsSectionProps) {
  const pm = dados.prefeituraModulo;
  const demoEquips = pm?.equipamentosPorLinha ?? [];
  const demoOperadores = pm?.operadoresSelect ?? [];

  // Load from Firestore; fall back to demo data if empty
  const [equips, setEquips] = useState(demoEquips);
  const [operadores, setOperadores] = useState(demoOperadores);

  useEffect(() => {
    if (!prefeituraId) return;
    getDocs(
      query(
        collection(db, "equipamentos"),
        where("prefeituraId", "==", prefeituraId),
      ),
    )
      .then((snap) => {
        if (snap.empty) return; // keep demo data
        setEquips(
          snap.docs.map((d) => ({
            label:
              (d.data().label as string) ||
              `${d.data().marca ?? ""} ${d.data().modelo ?? ""}`.trim() ||
              (d.data().descricao as string) ||
              "",
            linha: (d.data().linha as string) ?? "",
          })),
        );
      })
      .catch(() => {});
  }, [prefeituraId]);

  useEffect(() => {
    if (!prefeituraId) return;
    getDocs(
      query(
        collection(db, "operadores"),
        where("prefeituraId", "==", prefeituraId),
      ),
    )
      .then((snap) => {
        if (snap.empty) return; // keep demo data
        setOperadores(snap.docs.map((d) => (d.data().nome as string) ?? ""));
      })
      .catch(() => {});
  }, [prefeituraId]);

  const [equipIdx, setEquipIdx] = useState<number>(0);
  const [operador, setOperador] = useState<string>(operadores[0] ?? "");

  // Sync operador when list loads from Firestore
  useEffect(() => {
    if (operadores.length > 0 && !operadores.includes(operador)) {
      setOperador(operadores[0]);
    }
  }, [operadores]);

  // Reset equipIdx if it's out of bounds after list reload
  useEffect(() => {
    if (equipIdx >= equips.length && equips.length > 0) {
      setEquipIdx(0);
    }
  }, [equips]);
  const [relato, setRelato] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [oficinasCredenciadas, setOficinasCredenciadas] = useState<
    OficinaCredenciada[]
  >([]);
  const [oficinasEnvio, setOficinasEnvio] = useState<OficinaCredenciada[]>([]);
  const [loadingOficinas, setLoadingOficinas] = useState(false);

  const equipSel = equips[equipIdx];
  const linha = equipSel?.linha ?? "";

  useEffect(() => {
    if (!prefeituraId) return;
    setLoadingOficinas(true);
    getDocs(
      query(
        collection(db, "oficinas"),
        where("prefeituraId", "==", prefeituraId),
        where("status", "==", "Ativa"),
      ),
    )
      .then((snap) => {
        setOficinasCredenciadas(
          snap.docs.map((d) => ({
            id: d.id,
            nome: (d.data().nome as string) ?? "",
            especialidade: (d.data().especialidade as string) ?? "",
          })),
        );
      })
      .catch(() => {
        setOficinasCredenciadas([]);
      })
      .finally(() => {
        setLoadingOficinas(false);
      });
  }, [prefeituraId]);

  // Re-draw when equipment (linha) or oficina list changes
  useEffect(() => {
    if (!linha || oficinasCredenciadas.length === 0) {
      setOficinasEnvio([]);
      return;
    }
    const matches = oficinasCredenciadas.filter((o) =>
      especialidadeCompativel(o.especialidade, linha),
    );
    const pool = matches.length > 0 ? matches : oficinasCredenciadas;
    setOficinasEnvio(sortearAte(pool, 3));
  }, [oficinasCredenciadas, linha]);

  // Names of the drawn oficinas (used in OS document)
  const oficinasNomes = useMemo(
    () => oficinasEnvio.map((o) => o.nome),
    [oficinasEnvio],
  );

  async function handleEnviar() {
    setErro("");
    setSucesso("");

    if (!equipSel) {
      setErro("Selecione um equipamento.");
      return;
    }
    if (!relato.trim()) {
      setErro("Informe o relato do problema.");
      return;
    }
    if (oficinasEnvio.length === 0) {
      setErro(
        "Nenhuma oficina credenciada para este município. Cadastre em Acessos e logins.",
      );
      return;
    }

    setSaving(true);
    try {
      const protocolo = gerarProtocoloOs();
      const docRef = await addDoc(collection(db, "solicitacoesOS"), {
        protocolo,
        prefeituraId,
        equipamento: equipSel.label,
        linha,
        operador,
        horimetro: "4.552,5 h",
        relato: relato.trim(),
        oficinas: oficinasNomes,
        oficinasIds: oficinasEnvio.map((o) => o.id),
        status: "aguardando_orcamento",
        criadoEm: serverTimestamp(),
      });
      setSucesso(
        `O.S. criada! Protocolo: ${protocolo} · ID: ${docRef.id} · Enviada para ${oficinasEnvio.length} oficina(s) de ${linha}.`,
      );
      setRelato("");
    } catch {
      setErro("Erro ao criar O.S. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1>Abrir O.S.</h1>
      <article className="card">
        <div className="grid">
          <div>
            <label>Equipamento</label>
            <select
              id="pf-sel-equip"
              value={equipIdx}
              onChange={(e) => setEquipIdx(Number(e.target.value))}
            >
              {equips.length === 0 ? (
                <option value={0}>— sem equipamentos —</option>
              ) : (
                equips.map((eq, i) => (
                  <option key={i} value={i}>
                    {eq.label}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label>
              Classificação / linha do equipamento{" "}
              <span
                style={{
                  fontWeight: "normal",
                  color: "var(--text-gray)",
                  fontSize: "0.78rem",
                }}
              >
                (automático)
              </span>
            </label>
            <input
              type="text"
              id="pf-classificacao-auto"
              readOnly
              placeholder="Selecione o equipamento acima"
              value={linha}
              style={{
                cursor: "default",
                background: "#0b1220",
                border: "1px solid #374151",
                color: "#e2e8f0",
              }}
            />
          </div>
          <div>
            <label>Operador solicitante</label>
            <select
              id="pf-sel-operador"
              value={operador}
              onChange={(e) => setOperador(e.target.value)}
            >
              {operadores.length === 0 ? (
                <option value="">— sem operadores —</option>
              ) : (
                operadores.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label>Horímetro atual (sensor)</label>
            <input type="text" value="4.552,5 h" readOnly />
          </div>
        </div>

        <div className="oficinas-tres">
          <h4 id="pf-oficinas-envio-titulo">
            Oficinas credenciadas que receberão esta O.S.
          </h4>
          {loadingOficinas ? (
            <p style={{ color: "var(--text-gray)", fontSize: "0.88rem" }}>
              Carregando oficinas...
            </p>
          ) : (
            <ul id="pf-lista-tres-oficinas">
              {oficinasEnvio.length === 0 ? (
                <li style={{ color: "var(--text-gray)" }}>
                  {linha
                    ? `Nenhuma oficina credenciada com especialidade "${linha}" — selecione outro equipamento ou cadastre oficinas.`
                    : "Selecione um equipamento para ver as oficinas."}
                </li>
              ) : (
                oficinasEnvio.map((o) => (
                  <li key={o.id}>
                    <strong>{o.nome}</strong>
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: "0.78rem",
                        color: "var(--text-gray)",
                      }}
                    >
                      {o.especialidade}
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <label style={{ marginTop: 12 }}>Relato do problema</label>
        <textarea
          rows={4}
          placeholder="Descreva o sintoma ou defeito para auxiliar o diagnóstico nas três oficinas..."
          value={relato}
          onChange={(e) => setRelato(e.target.value)}
        />
        {erro ? (
          <p
            style={{
              color: "#dc2626",
              fontWeight: 600,
              marginTop: 10,
              fontSize: "0.88rem",
              border: "1px solid #fca5a5",
              background: "#fef2f2",
              padding: "10px 14px",
              borderRadius: 6,
            }}
          >
            {erro}
          </p>
        ) : null}
        {sucesso ? (
          <p
            style={{
              color: "#15803d",
              fontWeight: 600,
              marginTop: 10,
              fontSize: "0.88rem",
              border: "1px solid #86efac",
              background: "#f0fdf4",
              padding: "10px 14px",
              borderRadius: 6,
            }}
          >
            {sucesso}
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn-success"
          style={{
            width: "100%",
            opacity: saving ? 0.7 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
          onClick={() => {
            void handleEnviar();
          }}
          disabled={saving}
        >
          {saving ? "Criando O.S..." : "Enviar"}
        </button>
      </article>
    </>
  );
}
