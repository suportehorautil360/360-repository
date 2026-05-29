import { useCallback, useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { escalaApi, type Escala } from "../../../lib/api/escala";
import { EscalaConfig } from "./EscalaConfig";
import "./configuracoes.css";

/**
 * Configurações operacionais da prefeitura. Hoje só contém a escala de
 * jornada (antes morava no topo do RH). Estrutura pronta para adicionar
 * mais seções (feature flags, ajustes de aprovação, etc.).
 */
export function ConfiguracoesSection({ prefeituraId }: { prefeituraId: string }) {
  const [escala, setEscala] = useState<Escala | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setCarregando(true);
    setErro("");
    try {
      setEscala(await escalaApi.obter(prefeituraId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="cfg">
      <h1 className="cfg__page-titulo">Configurações</h1>
      <p className="cfg__lead">
        Parâmetros operacionais da prefeitura. Mudanças aqui afetam o cálculo
        de ponto, horas previstas e atrasos.
      </p>

      {erro && <p className="cfg__msg cfg__msg--err">{erro}</p>}
      {carregando ? (
        <p className="cfg__msg">Carregando configurações…</p>
      ) : (
        <section className="cfg__card">
          <header className="cfg__card-head">
            <Clock size={14} aria-hidden="true" />
            <h2>Escala da jornada</h2>
          </header>
          <p className="cfg__card-sub">
            Define horário de entrada/saída, dias úteis e duração do almoço.
            Usado para calcular horas previstas, atrasos e faltas em toda a
            Central de Ponto.
          </p>
          <EscalaConfig
            prefeituraId={prefeituraId}
            escala={escala}
            onSalvo={() => void carregar()}
          />
        </section>
      )}
    </div>
  );
}
