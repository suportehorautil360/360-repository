import { useCallback, useEffect, useMemo, useState } from "react";
import {
  abastecimentosApi,
  type AbastecimentoTela,
} from "../../../lib/api/abastecimentos";
import type { DadosPrefeitura } from "../../../lib/hu360/types";
import { baixarCsvAbastecimentos } from "./abastecimentoCsv";
import "./abastecimento.css";

interface AbastecimentoSectionProps {
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

function chaveCache(
  prefeituraId: string,
  inicio: string,
  fim: string,
): string {
  return `${prefeituraId}|${inicio}|${fim}|v4`;
}

/** Evita nova chamada à API para o mesmo prefeitura + período. */
const cacheAbastecimentos = new Map<string, AbastecimentoTela[]>();

export function AbastecimentoSection({
  prefeituraId,
}: AbastecimentoSectionProps) {
  const [filtroOrigem, setFiltroOrigem] = useState<
    "todas" | "comboio" | "posto"
  >("todas");
  const [busca, setBusca] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState(isoInicioMes);
  const [periodoFim, setPeriodoFim] = useState(isoHoje);
  const [lista, setLista] = useState<AbastecimentoTela[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  useEffect(() => {
    if (!prefeituraId || !periodoInicio || !periodoFim) return;

    const chave = chaveCache(prefeituraId, periodoInicio, periodoFim);
    const emCache = cacheAbastecimentos.get(chave);
    if (emCache) {
      setLista(emCache);
      setErro(null);
      setCarregando(false);
      return;
    }

    let ativo = true;
    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const data = await abastecimentosApi.listarPorPeriodo(
          prefeituraId,
          periodoInicio,
          periodoFim,
        );
        if (!ativo) return;
        cacheAbastecimentos.set(chave, data);
        setLista(data);
      } catch (e) {
        if (!ativo) return;
        setLista([]);
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar os abastecimentos.",
        );
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [prefeituraId, periodoInicio, periodoFim]);

  const filtrados = useMemo(() => {
    return lista.filter((item) => {
      if (filtroOrigem !== "todas" && item.origemTipo !== filtroOrigem)
        return false;
      if (busca) {
        const b = busca.toLowerCase();
        return (
          item.veiculo.toLowerCase().includes(b) ||
          item.placa.toLowerCase().includes(b)
        );
      }
      return true;
    });
  }, [lista, filtroOrigem, busca]);

  async function handleRemover(item: AbastecimentoTela) {
    const ref = item.placa || item.veiculo || "este abastecimento";
    if (!window.confirm(`Remover ${ref}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setRemovendoId(item.id);
    setErro(null);
    try {
      await abastecimentosApi.remover(item.id);
      setLista((l) => {
        const nova = l.filter((x) => x.id !== item.id);
        // Mantém o cache do período coerente com o que foi removido.
        cacheAbastecimentos.set(
          chaveCache(prefeituraId, periodoInicio, periodoFim),
          nova,
        );
        return nova;
      });
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível remover o registro.",
      );
    } finally {
      setRemovendoId(null);
    }
  }

  const podeBaixarCsv = !carregando && filtrados.length > 0;

  const handleBaixarCsv = useCallback(() => {
    if (!podeBaixarCsv) return;
    baixarCsvAbastecimentos(filtrados, {
      prefeituraId,
      periodoInicio,
      periodoFim,
      filtroOrigem,
    });
  }, [
    podeBaixarCsv,
    filtrados,
    prefeituraId,
    periodoInicio,
    periodoFim,
    filtroOrigem,
  ]);

  return (
    <section className="pf-section">
      <header className="pf-section-head abs-header">
        <h1 className="pf-section-title">Abastecimentos</h1>
      </header>

      <div className="abs-toolbar">
        <div className="abs-search">
          <span className="abs-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar por placa ou veículo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="abs-periodo">
          <label htmlFor="abs-periodo-inicio" className="abs-periodo-label">
            Período
          </label>
          <input
            id="abs-periodo-inicio"
            type="date"
            className="abs-periodo-input"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            aria-label="Data inicial do período"
          />
          <span className="abs-periodo-sep" aria-hidden>
            —
          </span>
          <input
            id="abs-periodo-fim"
            type="date"
            className="abs-periodo-input"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            aria-label="Data final do período"
          />
        </div>

        <div className="abs-filters">
          <button
            type="button"
            className={`abs-filter-btn ${filtroOrigem === "todas" ? "active" : ""}`}
            onClick={() => setFiltroOrigem("todas")}
          >
            Todas
          </button>
          <button
            type="button"
            className={`abs-filter-btn ${filtroOrigem === "comboio" ? "active" : ""}`}
            onClick={() => setFiltroOrigem("comboio")}
          >
            Comboio
          </button>
          <button
            type="button"
            className={`abs-filter-btn ${filtroOrigem === "posto" ? "active" : ""}`}
            onClick={() => setFiltroOrigem("posto")}
          >
            Posto
          </button>
        </div>

        <button
          type="button"
          className="abs-btn-csv"
          onClick={handleBaixarCsv}
          disabled={!podeBaixarCsv}
          title={
            podeBaixarCsv
              ? "Exportar lista filtrada (planilha Excel)"
              : "Nenhum registro para exportar"
          }
        >
          <span aria-hidden>⬇️</span> Baixar planilha
        </button>
      </div>

      {erro ? (
        <p className="abs-msg abs-msg--erro" role="alert">
          {erro}
        </p>
      ) : null}

      <div className="abs-table-wrap">
        <table className="abs-table">
          <thead>
            <tr>
              <th>DATA</th>
              <th>VEÍCULO</th>
              <th>ORIGEM</th>
              <th>LITROS</th>
              <th>VALOR</th>
              <th>LEITURA</th>
              <th>LOCAL</th>
              <th aria-label="Ações"></th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={8} className="abs-table-empty">
                  Carregando abastecimentos…
                </td>
              </tr>
            ) : filtrados.length === 0 ? (
              <tr>
                <td colSpan={8} className="abs-table-empty">
                  Nenhum abastecimento encontrado.
                </td>
              </tr>
            ) : (
              filtrados.map((item) => (
                <tr key={item.id}>
                  <td className="abs-td-data">{item.data}</td>
                  <td>
                    <div className="abs-td-veiculo">
                      <strong>{item.veiculo}</strong>
                      <span>
                        {item.placa} · {item.tipoVeiculo}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`abs-badge-origem ${item.origemTipo}`}>
                      <span className="abs-origem-icon">
                        {item.origemTipo === "comboio" ? "🚛" : "⛽"}
                      </span>
                      {item.origemNome}
                    </span>
                  </td>
                  <td className="abs-td-litros">
                    <strong>{item.litros}</strong> L
                  </td>
                  <td className="abs-td-valor">
                    {item.valor !== null ? (
                      <strong>
                        R${" "}
                        {item.valor.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="abs-td-leitura">{item.leitura}</td>
                  <td>
                    <span className="abs-badge-local">
                      <span className="abs-local-icon">📍</span> {item.local}
                    </span>
                  </td>
                  <td className="abs-td-acoes">
                    <button
                      type="button"
                      className="abs-btn-remover"
                      onClick={() => void handleRemover(item)}
                      disabled={removendoId === item.id}
                      title="Remover abastecimento"
                      aria-label="Remover abastecimento"
                    >
                      {removendoId === item.id ? "…" : "🗑️"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
