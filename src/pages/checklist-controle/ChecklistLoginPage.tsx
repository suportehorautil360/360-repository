import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getDoc,
  getDocs,
  doc as firestoreDoc,
  collection,
  query,
  where,
} from "@firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import type { OperadorSession } from "./useOperadorSession";
import { useOperadorSession } from "./useOperadorSession";
import "../login/login.css";

export function ChecklistLoginPage() {
  const navigate = useNavigate();
  const { setSession } = useOperadorSession();

  const [chassis, setChassis] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const chassisTrimmed = chassis.trim();
    if (!chassisTrimmed) {
      setErro("Informe o número do chassi.");
      return;
    }

    setErro("");
    setLoading(true);

    try {
      const q = query(
        collection(db, "equipamentos"),
        where("chassis", "==", chassisTrimmed),
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setErro("Nenhum equipamento encontrado com este chassi.");
        setLoading(false);
        return;
      }

      const doc = snap.docs[0];
      const data = doc.data();

      // Busca o nome do cliente na tabela "clientes" pelo prefeituraId do equipamento
      let empresaNome = String(
        data.obra ?? data.linha ?? data.modelo ?? "Equipamento",
      );
      const prefeituraId = String(data.prefeituraId ?? "");
      if (prefeituraId) {
        try {
          const clienteSnap = await getDoc(
            firestoreDoc(db, "clientes", prefeituraId),
          );
          if (clienteSnap.exists()) {
            const nome = String(clienteSnap.data().nome ?? "").trim();
            if (nome) empresaNome = nome;
          }
        } catch {
          /* usa fallback */
        }
      }

      const sess: OperadorSession = {
        nome: String(data.marca ?? data.descricao ?? chassisTrimmed),
        idMaquina: doc.id,
        idCliente: prefeituraId,
        empresa: empresaNome,
        chassis: chassisTrimmed,
      };

      setSession(sess);
      navigate("/checklist-controle", { replace: true });
    } catch {
      setErro("Erro ao consultar o banco de dados. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <section className="auth-screen" aria-labelledby="checklist-login-title">
      <div className="auth-card">
        <h1 id="checklist-login-title" className="auth-title">
          Controle Checklist
        </h1>
        <p className="auth-subtitle">
          Informe o chassi do equipamento para acessar o controle.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="checklist-chassis">Chassi do equipamento</label>
          <input
            id="checklist-chassis"
            autoComplete="off"
            placeholder="Digite o número do chassi"
            value={chassis}
            onChange={(e) => {
              setChassis(e.target.value);
              setErro("");
            }}
          />
          {erro && (
            <span
              style={{
                color: "var(--danger, #ef4444)",
                fontSize: "0.82rem",
                marginTop: "-6px",
              }}
            >
              {erro}
            </span>
          )}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </form>

        <p className="quick-access">
          <Link
            to="/"
            style={{ color: "var(--secondary, #3b82f6)", fontWeight: 600 }}
          >
            ← Voltar ao portal
          </Link>
        </p>
      </div>
    </section>
  );
}
