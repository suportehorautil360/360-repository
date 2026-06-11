import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  baixarCSV,
  baixarExcel,
  baixarJSON,
  type AbaExcel,
} from "../../../lib/export/export-utils";
import {
  RELATORIOS,
  carregarRelatorios,
  type RelatorioKey,
  type RelatoriosBundle,
} from "./relatorios/relatorios-data";
import "./relatorios.css";

export function RelatoriosSection({ prefeituraId }: { prefeituraId: string }) {
  const [bundle, setBundle] = useState<RelatoriosBundle | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [previewKey, setPreviewKey] = useState<RelatorioKey>("frota");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setBundle(await carregarRelatorios(prefeituraId));
    } catch {
      toast.error("Não foi possível carregar os relatórios.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const exportaveis = useMemo(
    () => RELATORIOS.filter((r) => !r.somentePreview),
    [],
  );

  function metaTitulo(key: RelatorioKey): string {
    return RELATORIOS.find((r) => r.key === key)?.titulo ?? key;
  }

  function exportar(key: RelatorioKey, formato: "csv" | "excel") {
    if (!bundle) return;
    const ds = bundle.datasets[key];
    const nome = `relatorio-${key}`;
    if (formato === "csv") baixarCSV(nome, ds);
    else void baixarExcel(nome, [{ nome: metaTitulo(key), ...ds }]);
  }

  async function exportarCompleto() {
    if (!bundle) return;
    const abas: AbaExcel[] = RELATORIOS.map((r) => ({
      nome: r.titulo,
      ...bundle.datasets[r.key],
    }));
    await baixarExcel("relatorio-completo", abas);
    toast.success("Relatório completo gerado.");
  }

  function backupJSON() {
    if (!bundle) return;
    baixarJSON(`backup-${prefeituraId}`, {
      prefeituraId,
      datasets: bundle.datasets,
    });
    toast.success("Backup exportado.");
  }

  const preview = bundle?.datasets[previewKey];

  return (
    <section className="rel-page">
      <h1 className="rel-title">Relatórios e exportação</h1>

      {/* KPIs */}
      <div className="rel-kpis">
        <article className="rel-kpi">
          <span>Total lançamentos</span>
          <strong>{bundle?.kpis.lancamentos ?? "—"}</strong>
        </article>
        <article className="rel-kpi">
          <span>Total gasto geral</span>
          <strong>{bundle?.kpis.gastoGeral ?? "—"}</strong>
        </article>
        <article className="rel-kpi">
          <span>Veículos</span>
          <strong>{bundle?.kpis.veiculos ?? "—"}</strong>
        </article>
        <article className="rel-kpi">
          <span>Frentes de Trabalho</span>
          <strong>{bundle?.kpis.frentes ?? "—"}</strong>
        </article>
      </div>

      {/* Cards de exportação */}
      <div className="rel-cards">
        {exportaveis.map((r) => (
          <article key={r.key} className="rel-card">
            <div className="rel-card__icon" aria-hidden>
              {r.icone}
            </div>
            <h2 className="rel-card__title">{r.titulo}</h2>
            <p className="rel-card__desc">{r.descricao}</p>
            <div className="rel-card__actions">
              <button
                type="button"
                className="rel-btn rel-btn--csv"
                disabled={!bundle}
                onClick={() => exportar(r.key, "csv")}
              >
                ↓ CSV
              </button>
              <button
                type="button"
                className="rel-btn rel-btn--excel"
                disabled={!bundle}
                onClick={() => exportar(r.key, "excel")}
              >
                ↓ Excel
              </button>
            </div>
          </article>
        ))}

        {/* Histórico de Revisões — Fase 2 (precisa endpoint de listagem) */}
        <article className="rel-card rel-card--soon">
          <div className="rel-card__icon" aria-hidden>
            🔒
          </div>
          <h2 className="rel-card__title">Histórico de Revisões</h2>
          <p className="rel-card__desc">
            Bloqueios, liberações e revisões realizadas.
          </p>
          <div className="rel-card__actions">
            <span className="rel-soon">Em breve</span>
          </div>
        </article>

        {/* Relatório completo */}
        <article className="rel-card">
          <div className="rel-card__icon" aria-hidden>
            📦
          </div>
          <h2 className="rel-card__title">Relatório completo</h2>
          <p className="rel-card__desc">
            Todos os dados em um Excel com abas separadas.
          </p>
          <div className="rel-card__actions">
            <button
              type="button"
              className="rel-btn rel-btn--full"
              disabled={!bundle}
              onClick={() => void exportarCompleto()}
            >
              ↓ Excel completo
            </button>
          </div>
        </article>

        {/* Backup */}
        <article className="rel-card">
          <div className="rel-card__icon" aria-hidden>
            💾
          </div>
          <h2 className="rel-card__title">Backup dos dados</h2>
          <p className="rel-card__desc">Salve ou restaure todos os cadastros.</p>
          <div className="rel-card__actions">
            <button
              type="button"
              className="rel-btn rel-btn--csv"
              disabled={!bundle}
              onClick={backupJSON}
            >
              ↓ Backup JSON
            </button>
            <button
              type="button"
              className="rel-btn rel-btn--excel"
              disabled
              title="Disponível em breve"
            >
              ↑ Restaurar
            </button>
          </div>
        </article>
      </div>

      {/* Pré-visualização */}
      <div className="rel-preview">
        <div className="rel-preview__head">
          <h2 className="rel-preview__title">Pré-visualização</h2>
          <Select
            value={previewKey}
            onValueChange={(v) => setPreviewKey(v as RelatorioKey)}
          >
            <SelectTrigger className="rel-preview__select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATORIOS.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {carregando ? (
          <p className="rel-empty">Carregando dados...</p>
        ) : !preview || preview.linhas.length === 0 ? (
          <p className="rel-empty">Sem dados para este relatório.</p>
        ) : (
          <div className="rel-table-wrap">
            <table className="rel-table">
              <thead>
                <tr>
                  {preview.colunas.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.linhas.slice(0, 12).map((linha, i) => (
                  <tr key={i}>
                    {linha.map((cel, j) => (
                      <td key={j}>{cel}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.linhas.length > 12 && (
              <p className="rel-preview__more">
                + {preview.linhas.length - 12} linhas no arquivo exportado
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
