import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileDown,
  Lock,
  Wrench,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isBloqueado,
  isVencido,
  progressoIntervaloExibicao,
  progressoIntervaloRevisao,
  revisaoRestante,
  revisaoEm,
  statusRevisao,
  TIPO_LABEL,
  unidadeDe,
  type TipoVeiculo,
  type VeiculoFrota,
} from "./frota/types";
import { RevisaoModal } from "./frota/RevisaoModal";
import { useFrota } from "./frota/use-frota";
import { baixarPlanilhaRevisoes } from "./revisoesExport";
import "./revisoes.css";

type TabId = "bloqueados" | "proximos" | "em-dia" | "todos";

const TIPOS: TipoVeiculo[] = ["carro", "caminhao", "van", "maquina"];

function formatLeitura(v: VeiculoFrota, valor: number): string {
  return `${valor.toLocaleString("pt-BR")} ${unidadeDe(v.tipo)}`;
}

function isProximoNaoBloqueado(v: VeiculoFrota): boolean {
  return (
    !isBloqueado(v) &&
    v.intervaloRevisao > 0 &&
    progressoIntervaloRevisao(v) >= 90
  );
}

function matchFiltros(
  v: VeiculoFrota,
  busca: string,
  tipo: TipoVeiculo | "todos",
  obra: string,
): boolean {
  if (tipo !== "todos" && v.tipo !== tipo) return false;
  if (obra !== "todas" && (v.obra || "Disponível") !== obra) return false;
  const q = busca.trim().toLowerCase();
  if (!q) return true;
  return (
    v.placa.toLowerCase().includes(q) ||
    v.nome.toLowerCase().includes(q) ||
    (v.obra || "").toLowerCase().includes(q)
  );
}

function AcompanhamentoTable({ rows }: { rows: VeiculoFrota[] }) {
  return (
    <div className="rv-ok-table-wrap">
      <table className="rv-ok-table">
        <thead>
          <tr>
            <th>Placa</th>
            <th>Veículo</th>
            <th>Tipo</th>
            <th>Status</th>
            <th>Progresso</th>
            <th>Restante</th>
            <th>Intervalo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const progresso = progressoIntervaloExibicao(v);
            const isProximo = isProximoNaoBloqueado(v);
            return (
              <tr
                key={`ok-${v.id}`}
                className={isProximo ? "rv-row--warn" : undefined}
              >
                <td>
                  <span className="rv-ok-plate">{v.placa}</span>
                </td>
                <td>{v.nome}</td>
                <td>
                  <span className="rv-ok-type">{TIPO_LABEL[v.tipo]}</span>
                </td>
                <td>
                  <span
                    className={`rv-status-badge ${
                      isProximo
                        ? "rv-status-badge--warn"
                        : "rv-status-badge--ok"
                    }`}
                  >
                    {isProximo ? "Próximo" : "Em dia"}
                  </span>
                </td>
                <td>
                  <div className="rv-ok-progress-row">
                    <div
                      className={`rv-ok-progress ${
                        isProximo ? "rv-ok-progress--warn" : ""
                      }`}
                    >
                      <div style={{ width: `${progresso}%` }} />
                    </div>
                    <span>{progresso}%</span>
                  </div>
                </td>
                <td
                  className={
                    isProximo ? "rv-ok-restante--warn" : "rv-ok-restante"
                  }
                >
                  {Math.max(revisaoRestante(v), 0).toLocaleString("pt-BR")}
                  {unidadeDe(v.tipo)}
                </td>
                <td>
                  a cada {v.intervaloRevisao.toLocaleString("pt-BR")}
                  {unidadeDe(v.tipo)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BloqueadosTable({
  rows,
  onRegistrar,
}: {
  rows: VeiculoFrota[];
  onRegistrar: (v: VeiculoFrota) => void;
}) {
  return (
    <div className="rv-ok-table-wrap rv-ok-table-wrap--danger">
      <table className="rv-ok-table">
        <thead>
          <tr>
            <th>Placa</th>
            <th>Veículo</th>
            <th>Tipo</th>
            <th>Obra</th>
            <th>Atual</th>
            <th>Excesso</th>
            <th>Progresso</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const un = unidadeDe(v.tipo);
            const excesso = Math.max(v.medicaoAtual - revisaoEm(v), 0);
            const uso = isVencido(v) ? 100 : progressoIntervaloExibicao(v);
            return (
              <tr key={`blk-${v.id}`} className="rv-row--danger">
                <td>
                  <span className="rv-ok-plate">{v.placa}</span>
                </td>
                <td>
                  <div className="rv-cell-stack">
                    <span>{v.nome}</span>
                    <span className="rv-status-badge rv-status-badge--danger">
                      <Lock size={11} strokeWidth={2.5} aria-hidden />
                      Bloqueado
                    </span>
                  </div>
                </td>
                <td>
                  <span className="rv-ok-type">{TIPO_LABEL[v.tipo]}</span>
                </td>
                <td className="rv-cell-muted">{v.obra || "Disponível"}</td>
                <td className="rv-cell-num">{formatLeitura(v, v.medicaoAtual)}</td>
                <td className="rv-ok-excesso">
                  +{excesso.toLocaleString("pt-BR")} {un}
                </td>
                <td>
                  <div className="rv-ok-progress-row">
                    <div className="rv-ok-progress rv-ok-progress--danger">
                      <div style={{ width: `${uso}%` }} />
                    </div>
                    <span>{uso}%</span>
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    className="rv-done rv-done--table"
                    onClick={() => onRegistrar(v)}
                  >
                    Registrar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RevisoesSection({ prefeituraId }: { prefeituraId: string }) {
  const frota = useFrota(prefeituraId);
  const [liberando, setLiberando] = useState<VeiculoFrota | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null,
  );
  const [tab, setTab] = useState<TabId>("todos");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<TipoVeiculo | "todos">("todos");
  const [obra, setObra] = useState("todas");
  const [tabInicializada, setTabInicializada] = useState(false);

  const rows = useMemo(() => {
    const base = [...frota.lista];
    base.sort((a, b) => {
      const prioridade = (v: VeiculoFrota) => {
        const st = statusRevisao(v);
        if (st === "vencida") return 0;
        if (st === "proxima") return 1;
        return 2;
      };
      const pa = prioridade(a);
      const pb = prioridade(b);
      if (pa !== pb) return pa - pb;
      return revisaoRestante(a) - revisaoRestante(b);
    });
    return base;
  }, [frota.lista]);

  const listas = useMemo(() => {
    const bloqueados = rows.filter((v) => isBloqueado(v));
    const naoBloqueados = rows.filter((v) => !isBloqueado(v));
    const proximos = naoBloqueados.filter(isProximoNaoBloqueado);
    const emDia = naoBloqueados.filter((v) => !isProximoNaoBloqueado(v));
    return {
      bloqueados,
      proximos,
      emDia,
      todos: naoBloqueados,
      total: rows.length,
    };
  }, [rows]);

  // Tab inicial: bloqueados se houver; senão todos (só na 1ª carga).
  useEffect(() => {
    if (tabInicializada || frota.loading) return;
    setTab(listas.bloqueados.length > 0 ? "bloqueados" : "todos");
    setTabInicializada(true);
  }, [frota.loading, listas.bloqueados.length, tabInicializada]);

  const obras = useMemo(() => {
    const set = new Set<string>();
    for (const v of rows) set.add(v.obra || "Disponível");
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const baseDaTab = useMemo(() => {
    switch (tab) {
      case "bloqueados":
        return listas.bloqueados;
      case "proximos":
        return listas.proximos;
      case "em-dia":
        return listas.emDia;
      case "todos":
        return listas.todos;
    }
  }, [tab, listas]);

  const filtrados = useMemo(
    () => baseDaTab.filter((v) => matchFiltros(v, busca, tipo, obra)),
    [baseDaTab, busca, tipo, obra],
  );

  const podeExportar =
    !frota.loading && tab !== "bloqueados" && filtrados.length > 0;

  const handleExportar = useCallback(() => {
    if (!podeExportar) return;
    baixarPlanilhaRevisoes(filtrados, { prefeituraId });
  }, [podeExportar, filtrados, prefeituraId]);

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "bloqueados", label: "Bloqueados", count: listas.bloqueados.length },
    { id: "proximos", label: "Próximos", count: listas.proximos.length },
    { id: "em-dia", label: "Em dia", count: listas.emDia.length },
    { id: "todos", label: "Todos", count: listas.todos.length },
  ];

  return (
    <section className="rv-page">
      <header className="rv-page-head">
        <h1 className="rv-page-title">Preventiva</h1>
        <p className="rv-page-sub">
          Priorize bloqueados e acompanhe o uso do intervalo
        </p>
      </header>

      <div className="rv-kpis" role="group" aria-label="Resumo da preventiva">
        <button
          type="button"
          className={`rv-kpi rv-kpi--danger ${tab === "bloqueados" ? "is-active" : ""}`}
          onClick={() => setTab("bloqueados")}
        >
          <span className="rv-kpi__icon" aria-hidden>
            <Lock size={18} strokeWidth={2.25} />
          </span>
          <p className="rv-kpi__label">Bloqueados agora</p>
          <strong className="rv-kpi__value">{listas.bloqueados.length}</strong>
          <small className="rv-kpi__sub">Impedem abastecimento</small>
        </button>
        <button
          type="button"
          className={`rv-kpi rv-kpi--warn ${tab === "proximos" ? "is-active" : ""}`}
          onClick={() => setTab("proximos")}
        >
          <span className="rv-kpi__icon" aria-hidden>
            <AlertTriangle size={18} strokeWidth={2.25} />
          </span>
          <p className="rv-kpi__label">Próximos (90%+)</p>
          <strong className="rv-kpi__value">{listas.proximos.length}</strong>
          <small className="rv-kpi__sub">Atenção necessária</small>
        </button>
        <button
          type="button"
          className={`rv-kpi rv-kpi--ok ${tab === "em-dia" ? "is-active" : ""}`}
          onClick={() => setTab("em-dia")}
        >
          <span className="rv-kpi__icon" aria-hidden>
            <CheckCircle2 size={18} strokeWidth={2.25} />
          </span>
          <p className="rv-kpi__label">Em dia</p>
          <strong className="rv-kpi__value">{listas.emDia.length}</strong>
          <small className="rv-kpi__sub">Dentro do intervalo</small>
        </button>
        <button
          type="button"
          className={`rv-kpi ${tab === "todos" ? "is-active" : ""}`}
          onClick={() => setTab("todos")}
        >
          <span className="rv-kpi__icon" aria-hidden>
            <Wrench size={18} strokeWidth={2.25} />
          </span>
          <p className="rv-kpi__label">Total com preventiva</p>
          <strong className="rv-kpi__value">{listas.total}</strong>
          <small className="rv-kpi__sub">Cadastrados</small>
        </button>
      </div>

      <div className="rv-toolbar">
        <div className="rv-tabs" role="tablist" aria-label="Status da preventiva">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`rv-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="rv-tabpanel"
              className={`rv-tab ${tab === t.id ? "is-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="rv-tab__count">{t.count}</span>
            </button>
          ))}
        </div>

        {tab !== "bloqueados" ? (
          <button
            type="button"
            className="rv-btn-export"
            onClick={handleExportar}
            disabled={!podeExportar}
            title={
              podeExportar
                ? "Exportar lista filtrada para planilha"
                : "Nenhum equipamento para exportar"
            }
          >
            <FileDown size={15} strokeWidth={2.25} aria-hidden />
            Baixar planilha
          </button>
        ) : null}
      </div>

      <div className="rv-filtros">
        <input
          className="rv-filtro-busca"
          placeholder="Buscar por placa, nome ou obra…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar equipamentos"
        />

        <Select
          value={tipo}
          onValueChange={(v) => setTipo(v as TipoVeiculo | "todos")}
        >
          <SelectTrigger className="rv-filtro-select">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map((t) => (
              <SelectItem key={t} value={t}>
                {TIPO_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={obra} onValueChange={setObra}>
          <SelectTrigger className="rv-filtro-select">
            <SelectValue placeholder="Obra" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as obras</SelectItem>
            {obras.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="rv-filtro-count">
        {frota.loading
          ? "Carregando…"
          : `${filtrados.length} de ${baseDaTab.length} equipamentos`}
      </p>

      <div
        className="rv-panel"
        role="tabpanel"
        id="rv-tabpanel"
        aria-labelledby={`rv-tab-${tab}`}
      >
        {frota.loading ? (
          <p className="rv-empty">Carregando preventivas…</p>
        ) : tab === "bloqueados" ? (
          filtrados.length === 0 ? (
            <p className="rv-empty rv-empty--ok">
              {baseDaTab.length === 0
                ? "Nenhum equipamento bloqueado. Abastecimento liberado."
                : "Nenhum bloqueado corresponde aos filtros."}
            </p>
          ) : (
            <BloqueadosTable
              rows={filtrados}
              onRegistrar={(v) => {
                setMsg(null);
                setLiberando(v);
              }}
            />
          )
        ) : filtrados.length === 0 ? (
          <p className="rv-empty">
            {baseDaTab.length === 0
              ? "Nenhum equipamento nesta categoria."
              : "Nenhum equipamento corresponde aos filtros."}
          </p>
        ) : (
          <AcompanhamentoTable rows={filtrados} />
        )}
      </div>

      {frota.erro ? <p className="rv-msg rv-msg--err">{frota.erro}</p> : null}
      {msg ? (
        <p
          className={`rv-msg ${msg.tone === "ok" ? "rv-msg--ok" : "rv-msg--err"}`}
        >
          {msg.text}
        </p>
      ) : null}

      {liberando && (
        <RevisaoModal
          veiculo={liberando}
          onFechar={() => setLiberando(null)}
          onConfirmar={async (dados) => {
            await frota.registrarRevisao(liberando, dados);
            setMsg({ tone: "ok", text: "Preventiva registrada com sucesso." });
            setLiberando(null);
          }}
        />
      )}
    </section>
  );
}
