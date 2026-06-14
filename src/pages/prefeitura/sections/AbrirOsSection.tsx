import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../lib/firebase/firebase";
import { AbrirOsFormulario } from "./AbrirOsFormulario";
import { AbrirOsLista } from "./AbrirOsLista";
import { listaOsParaExibicao, type SolicitacaoOS } from "./abrir-os-model";
import "./abrir-os.css";

type TelaOs = "lista" | "formulario";

export function AbrirOsSection({ prefeituraId }: { prefeituraId: string }) {
  const [tela, setTela] = useState<TelaOs>("lista");
  const [rows, setRows] = useState<SolicitacaoOS[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!prefeituraId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const snap = await getDocs(
        query(
          collection(db, "solicitacoesOS"),
          where("prefeituraId", "==", prefeituraId),
        ),
      );
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<SolicitacaoOS, "id">) }))
        .sort(
          (a, b) => (b.criadoEm?.seconds ?? 0) - (a.criadoEm?.seconds ?? 0),
        );
      setRows(lista);
    } catch (err) {
      setRows([]);
      setErro(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar as ordens de serviço.",
      );
    } finally {
      setLoading(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const exibir = useMemo(() => listaOsParaExibicao(rows), [rows]);

  return (
    <section className="aos-page">
      {tela === "lista" ? (
        <AbrirOsLista
          rows={exibir}
          loading={loading}
          erro={erro}
          onAbrirOs={() => setTela("formulario")}
        />
      ) : (
        <AbrirOsFormulario
          prefeituraId={prefeituraId}
          onCancelar={() => setTela("lista")}
          onVoltarLista={() => setTela("lista")}
        />
      )}
    </section>
  );
}
