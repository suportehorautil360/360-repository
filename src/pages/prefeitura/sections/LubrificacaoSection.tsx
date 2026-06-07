import { useCallback, useEffect, useMemo, useState } from "react";
import {
  filtrarLubrificacoesPorPeriodo,
  lubrificacoesApi,
  type LubrificacaoTela,
} from "../../../lib/api/lubrificacoes";
import type { DadosPrefeitura } from "../../../lib/hu360/types";
import { baixarPlanilhaLubrificacao } from "./lubrificacaoExport";
import "./lubrificacao.css";

interface LubrificacaoSectionProps {
  dados: DadosPrefeitura;
  prefeituraId: string;
}

function isoInicioMes(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function isoHoje(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Evita nova chamada à API para a mesma prefeitura. */
const cacheLubrificacoes = new Map<string, LubrificacaoTela[]>();
const buscaEmAndamento = new Map<string, Promise<LubrificacaoTela[]>>();

function obterLubrificacoes(prefeituraId: string): Promise<LubrificacaoTela[]> {
  const emCache = cacheLubrificacoes.get(prefeituraId);
  if (emCache) return Promise.resolve(emCache);

  const pendente = buscaEmAndamento.get(prefeituraId);
  if (pendente) return pendente;

  const promessa = lubrificacoesApi
    .listar(prefeituraId)
    .then((data) => {
      cacheLubrificacoes.set(prefeituraId, data);
      buscaEmAndamento.delete(prefeituraId);
      return data;
    })
    .catch((erro) => {
      buscaEmAndamento.delete(prefeituraId);
      throw erro;
    });

  buscaEmAndamento.set(prefeituraId, promessa);
  return promessa;
}

export function LubrificacaoSection({
  prefeituraId,
}: LubrificacaoSectionProps) {
  const [periodoInicio, setPeriodoInicio] = useState(isoInicioMes);
  const [periodoFim, setPeriodoFim] = useState(isoHoje);
  const [lista, setLista] = useState<LubrificacaoTela[]>(
    () => cacheLubrificacoes.get(prefeituraId) ?? [],
  );
  const [carregando, setCarregando] = useState(
    () => !!prefeituraId && !cacheLubrificacoes.has(prefeituraId),
  );
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!prefeituraId) return;

    const emCache = cacheLubrificacoes.get(prefeituraId);
    if (emCache) {
      setLista(emCache);
      setErro(null);
      setCarregando(false);
      return;
    }

    let ativo = true;
    setCarregando(true);
    setErro(null);

    obterLubrificacoes(prefeituraId)
      .then((data) => {
        if (!ativo) return;
        setLista(data);
      })
      .catch((e) => {
        if (!ativo) return;
        setLista([]);
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar os registros de lubrificação.",
        );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [prefeituraId]);

  const filtrados = useMemo(
    () => filtrarLubrificacoesPorPeriodo(lista, periodoInicio, periodoFim),
    [lista, periodoInicio, periodoFim],
  );

  const podeExportar = !carregando && filtrados.length > 0;

  const handleExportar = useCallback(() => {
    if (!podeExportar) return;
    baixarPlanilhaLubrificacao(filtrados, {
      prefeituraId,
      periodoInicio,
      periodoFim,
    });
  }, [podeExportar, filtrados, prefeituraId, periodoInicio, periodoFim]);

  return (
    <section className="pf-section">
      <header className="pf-section-head lub-header">
        <h1 className="pf-section-title">Lubrificação</h1>

        <div className="lub-periodo">
          <label htmlFor="lub-periodo-inicio" className="lub-periodo-label">
            Período
          </label>
          <input
            id="lub-periodo-inicio"
            type="date"
            className="lub-periodo-input"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            aria-label="Data inicial do período"
          />
          <span className="lub-periodo-sep" aria-hidden>
            —
          </span>
          <input
            id="lub-periodo-fim"
            type="date"
            className="lub-periodo-input"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            aria-label="Data final do período"
          />
        </div>
      </header>

      <div className="lub-card">
        <div className="lub-card-head">
          <p className="lub-nota">
            Registros de engraxe (graxa) — não inclui troca de óleo
          </p>
          <button
            type="button"
            className="lub-btn-export"
            onClick={handleExportar}
            disabled={!podeExportar}
            title={
              podeExportar
                ? "Exportar lista para planilha"
                : "Nenhum registro para exportar"
            }
          >
            <span aria-hidden>⬇️</span> Baixar planilha
          </button>
        </div>

        {erro ? (
          <p className="lub-msg lub-msg--erro" role="alert">
            {erro}
          </p>
        ) : null}

        <div className="lub-table-wrap">
          <table className="lub-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Equipamento</th>
                <th>Leitura</th>
                <th>Pontos engraxados</th>
                <th>Comboísta</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={5} className="lub-table-empty">
                    Carregando registros…
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="lub-table-empty">
                    Nenhum registro de lubrificação no período.
                  </td>
                </tr>
              ) : (
                filtrados.map((item) => (
                  <tr key={item.id}>
                    <td className="lub-td-data">{item.data}</td>
                    <td>
                      <div className="lub-td-equip">
                        <strong>{item.equipamento}</strong>
                        <span>{item.identificacao}</span>
                      </div>
                    </td>
                    <td className="lub-td-leitura">{item.leitura}</td>
                    <td>
                      <div className="lub-tags">
                        {item.pontos.length === 0 ? (
                          <span className="lub-tag lub-tag--vazio">—</span>
                        ) : (
                          item.pontos.map((ponto) => (
                            <span key={ponto} className="lub-tag">
                              {ponto}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="lub-td-comboista">{item.comboista}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
