import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "@firebase/firestore";
import { db } from "../../../lib/firebase/firebase";

interface EquipamentosSectionProps {
  prefeituraId: string;
  labelMunicipio: string;
}

interface EquipRow {
  id: string;
  descricao: string;
  marca: string;
  modelo: string;
  chassis: string;
  linha: string;
  obra: string;
}

/**
 * Aba Equipamentos do portal da prefeitura.
 *
 * Exibe a mesma frota que aparece no select de "Abrir O.S." — coleção
 * `equipamentos` filtrada por prefeituraId.
 */
export function EquipamentosSection({
  prefeituraId,
  labelMunicipio,
}: EquipamentosSectionProps) {
  const [lista, setLista] = useState<EquipRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!prefeituraId) return;
    setLoading(true);
    getDocs(
      query(
        collection(db, "equipamentos"),
        where("prefeituraId", "==", prefeituraId),
      ),
    )
      .then((snap) => {
        setLista(
          snap.docs.map((d) => ({
            id: d.id,
            descricao: String(d.data().label ?? d.data().descricao ?? ""),
            marca: String(d.data().marca ?? ""),
            modelo: String(d.data().modelo ?? ""),
            chassis: String(d.data().chassis ?? ""),
            linha: String(d.data().linha ?? ""),
            obra: String(d.data().obra ?? ""),
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [prefeituraId]);

  return (
    <>
      <p
        style={{
          fontSize: "0.82rem",
          color: "var(--text-gray)",
          margin: "0 0 14px",
          lineHeight: 1.5,
        }}
      >
        <span style={{ color: "#cbd5e1" }}>Clientes</span> &nbsp;/&nbsp;{" "}
        <strong id="pf-eq-bc-cliente" style={{ color: "var(--main-orange)" }}>
          {labelMunicipio}
        </strong>{" "}
        &nbsp;/&nbsp; <span style={{ color: "#e2e8f0" }}>Equipamentos</span>
      </p>
      <h1>Equipamentos do município</h1>
      <p
        style={{
          color: "var(--text-gray)",
          margin: "0 0 18px",
          lineHeight: 1.5,
          maxWidth: 880,
        }}
      >
        Visualização da frota cadastrada para o município (mesma base usada na
        abertura de O.S.). Inclusão e importação de equipamentos ficam no{" "}
        <Link
          to="/admin/equipamentos-locacao"
          style={{ color: "var(--main-orange)" }}
        >
          Hub administrativo
        </Link>{" "}
        (aba <strong>Equipamentos locação</strong>).
      </p>

      <article className="card">
        <h3>Equipamentos cadastrados</h3>
        <div className="table-scroll" style={{ marginTop: 12 }}>
          {loading ? (
            <p style={{ color: "var(--text-gray)", padding: "12px 0" }}>
              Carregando…
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Tipo / descrição</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Chassis</th>
                  <th>Linha</th>
                  <th>Obra</th>
                </tr>
              </thead>
              <tbody id="pf-eq-tbody">
                {lista.map((eq) => (
                  <tr key={eq.id}>
                    <td>
                      <strong>
                        {eq.descricao || eq.modelo || "Equipamento"}
                      </strong>
                    </td>
                    <td>{eq.marca || "—"}</td>
                    <td>{eq.modelo || "—"}</td>
                    <td style={{ fontSize: "0.82rem" }}>
                      <code>{eq.chassis}</code>
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>{eq.linha || "—"}</td>
                    <td style={{ fontSize: "0.82rem" }}>
                      {eq.obra?.trim() ? eq.obra : "—"}
                    </td>
                  </tr>
                ))}
                {lista.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ textAlign: "center", color: "var(--text-gray)" }}
                    >
                      Nenhum equipamento cadastrado ainda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </article>
    </>
  );
}
