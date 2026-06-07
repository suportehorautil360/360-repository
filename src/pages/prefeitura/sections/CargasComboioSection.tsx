import { useCallback, useEffect, useMemo, useState } from "react";
import {
  filtrarReabastecimentosPorPeriodo,
  reabastecimentosApi,
  type CargaComboioTela,
} from "../../../lib/api/reabastecimentos";
import type { DadosPrefeitura } from "../../../lib/hu360/types";
import { baixarPlanilhaCargasComboio } from "./cargasComboioExport";
import "./cargas-comboio.css";

interface CargasComboioSectionProps {
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

function formatarLitros(litros: number): string {
  return `+${litros.toLocaleString("pt-BR")} L`;
}

/** Evita nova chamada à API para a mesma prefeitura. */
const cacheReabastecimentos = new Map<string, CargaComboioTela[]>();

export function CargasComboioSection({
  prefeituraId,
}: CargasComboioSectionProps) {
  const [periodoInicio, setPeriodoInicio] = useState(isoInicioMes);
  const [periodoFim, setPeriodoFim] = useState(isoHoje);
  const [lista, setLista] = useState<CargaComboioTela[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!prefeituraId) return;

    const emCache = cacheReabastecimentos.get(prefeituraId);
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
        const data = await reabastecimentosApi.listar(prefeituraId);
        if (!ativo) return;
        cacheReabastecimentos.set(prefeituraId, data);
        setLista(data);
      } catch (e) {
        if (!ativo) return;
        setLista([]);
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar as cargas do comboio.",
        );
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [prefeituraId]);

  const filtrados = useMemo(
    () =>
      filtrarReabastecimentosPorPeriodo(lista, periodoInicio, periodoFim),
    [lista, periodoInicio, periodoFim],
  );

  const podeExportar = !carregando && filtrados.length > 0;

  const handleExportar = useCallback(() => {
    if (!podeExportar) return;
    baixarPlanilhaCargasComboio(filtrados, {
      prefeituraId,
      periodoInicio,
      periodoFim,
    });
  }, [podeExportar, filtrados, prefeituraId, periodoInicio, periodoFim]);

  return (
    <section className="pf-section">
      <header className="pf-section-head ccb-header">
        <h1 className="pf-section-title">Cargas do Comboio</h1>

        <div className="ccb-periodo">
          <label htmlFor="ccb-periodo-inicio" className="ccb-periodo-label">
            Período
          </label>
          <input
            id="ccb-periodo-inicio"
            type="date"
            className="ccb-periodo-input"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            aria-label="Data inicial do período"
          />
          <span className="ccb-periodo-sep" aria-hidden>
            —
          </span>
          <input
            id="ccb-periodo-fim"
            type="date"
            className="ccb-periodo-input"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            aria-label="Data final do período"
          />
        </div>
      </header>

      <div className="ccb-card">
        <div className="ccb-card-head">
          <p className="ccb-nota">Reabastecimentos do tanque do comboio</p>
          <button
            type="button"
            className="ccb-btn-export"
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
          <p className="ccb-msg ccb-msg--erro" role="alert">
            {erro}
          </p>
        ) : null}

        <div className="ccb-table-wrap">
          <table className="ccb-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Litros recebidos</th>
                <th>Origem</th>
                <th>Nota fiscal</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={4} className="ccb-table-empty">
                    Carregando cargas…
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="ccb-table-empty">
                    Nenhuma carga do comboio no período.
                  </td>
                </tr>
              ) : (
                filtrados.map((item) => (
                  <tr key={item.id}>
                    <td className="ccb-td-data">{item.data}</td>
                    <td className="ccb-td-litros">
                      {formatarLitros(item.litros)}
                    </td>
                    <td>
                      <span className="ccb-badge-origem">{item.origem}</span>
                    </td>
                    <td className="ccb-td-nf">{item.notaFiscal}</td>
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
