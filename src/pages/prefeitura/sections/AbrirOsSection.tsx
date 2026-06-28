import { useCallback, useEffect, useState } from "react";
import { listarSolicitacoesOs } from "./criar-solicitacao-os";
import { AbrirOsFormulario } from "./AbrirOsFormulario";
import { AbrirOsLista } from "./AbrirOsLista";
import { AbrirOsDetalhePage } from "./AbrirOsDetalhePage";
import { AbrirOsAbaMaquinaParada } from "./AbrirOsAbaMaquinaParada";
import type { FiltrosOsLista, SolicitacaoOS } from "./abrir-os-model";
import {
  filtrarMaquinasParadas,
  maquinaParadaDeOs,
} from "./abrir-os-model";
import "./abrir-os.css";

type TelaOs = "lista" | "formulario" | "detalhe" | "maquina-parada";

const FILTROS_INICIAIS: FiltrosOsLista = {
  dataInicio: "",
  dataFim: "",
  status: "todos",
};

export function AbrirOsSection({ prefeituraId }: { prefeituraId: string }) {
  const [tela, setTela] = useState<TelaOs>("lista");
  const [osDetalhe, setOsDetalhe] = useState<SolicitacaoOS | null>(null);
  const [rows, setRows] = useState<SolicitacaoOS[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosOsLista>(FILTROS_INICIAIS);

  const carregar = useCallback(async () => {
    if (!prefeituraId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const lista = await listarSolicitacoesOs(prefeituraId, filtros);
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
  }, [prefeituraId, filtros]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleOsCriada(opts?: { irMaquinaParada?: boolean }) {
    await carregar();
    setTela(opts?.irMaquinaParada ? "maquina-parada" : "lista");
  }

  const maquinasParadas = filtrarMaquinasParadas(rows).map(maquinaParadaDeOs);

  return (
    <section className="aos-page">
      {tela === "lista" ? (
        <AbrirOsLista
          rows={rows}
          loading={loading}
          erro={erro}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          onAbrirOs={() => setTela("formulario")}
          onVerMaquinasParadas={() => setTela("maquina-parada")}
          qtdMaquinasParadas={maquinasParadas.length}
          onVerDetalhes={(os) => {
            setOsDetalhe(os);
            setTela("detalhe");
          }}
        />
      ) : tela === "formulario" ? (
        <AbrirOsFormulario
          prefeituraId={prefeituraId}
          onCancelar={() => setTela("lista")}
          onVoltarLista={() => setTela("lista")}
          onSalvo={handleOsCriada}
        />
      ) : tela === "maquina-parada" ? (
        <AbrirOsAbaMaquinaParada
          rows={maquinasParadas}
          loading={loading}
          onVoltar={() => setTela("lista")}
        />
      ) : osDetalhe ? (
        <AbrirOsDetalhePage
          prefeituraId={prefeituraId}
          os={osDetalhe}
          onVoltar={() => {
            setOsDetalhe(null);
            setTela("lista");
          }}
        />
      ) : null}
    </section>
  );
}
