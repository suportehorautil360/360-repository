import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import "./preventiva.css";
import { useFrota } from "./frota/use-frota";
import type { StatusRevisao, VeiculoFrota } from "./frota/types";
import {
  FILTROS_PREVENTIVA_PADRAO,
  filtrarPreventivas,
  frentesDistintas,
  montarPreventivas,
  type PreventivaFiltros,
  type PreventivaRow,
} from "./preventiva-model";

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS: Record<PreventivaRow["status"], { label: string; cls: string }> = {
  "em-dia": { label: "Em dia", cls: "is-ok" },
  vencida: { label: "Vencida", cls: "is-overdue" },
  proxima: { label: "Próxima", cls: "is-next" },
};

export function PreventivaSection({ prefeituraId }: { prefeituraId: string }) {
  const frota = useFrota(prefeituraId);
  const [registrando, setRegistrando] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<PreventivaFiltros>(
    FILTROS_PREVENTIVA_PADRAO,
  );

  const rows = useMemo(() => montarPreventivas(frota.lista), [frota.lista]);
  const frentes = useMemo(() => frentesDistintas(rows), [rows]);
  const filtradas = useMemo(
    () => filtrarPreventivas(rows, filtros),
    [rows, filtros],
  );

  function setFiltro<K extends keyof PreventivaFiltros>(
    k: K,
    v: PreventivaFiltros[K],
  ) {
    setFiltros((f) => ({ ...f, [k]: v }));
  }

  // Scroll horizontal espelhado no topo (sincronizado com a tabela).
  const topRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [larguraTabela, setLarguraTabela] = useState(0);

  useEffect(() => {
    const medir = () => setLarguraTabela(tableRef.current?.scrollWidth ?? 0);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [filtradas.length]);

  function syncDoTopo() {
    if (scrollRef.current && topRef.current)
      scrollRef.current.scrollLeft = topRef.current.scrollLeft;
  }
  function syncDaTabela() {
    if (topRef.current && scrollRef.current)
      topRef.current.scrollLeft = scrollRef.current.scrollLeft;
  }

  async function handleFeito(v: VeiculoFrota) {
    setRegistrando(v.id);
    try {
      await frota.registrarRevisao(v, {
        data: hojeISO(),
        hodometro: v.medicaoAtual,
        oficina: "",
        servicos: "Preventiva (registro rápido)",
        custo: 0,
        notaFiscal: "",
      });
      toast.success("Preventiva registrada.");
    } catch {
      toast.error("Não foi possível registrar a preventiva.");
    } finally {
      setRegistrando(null);
    }
  }

  return (
    <section className="pv-page">
      <div className="pv-wrap">
        <div className="pv-head">
          <h1 className="pv-title">Plano de manutenção preventiva</h1>
        </div>

        {/* Filtros */}
        <div className="pv-filtros">
          <input
            className="pv-filtro-busca"
            placeholder="Buscar por chassi, placa ou nome..."
            value={filtros.busca}
            onChange={(e) => setFiltro("busca", e.target.value)}
          />

          <Select
            value={filtros.status}
            onValueChange={(v) =>
              setFiltro("status", v as StatusRevisao | "todos")
            }
          >
            <SelectTrigger className="pv-filtro-select">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="vencida">Vencida</SelectItem>
              <SelectItem value="proxima">Próxima</SelectItem>
              <SelectItem value="em-dia">Em dia</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filtros.medidor}
            onValueChange={(v) =>
              setFiltro("medidor", v as PreventivaFiltros["medidor"])
            }
          >
            <SelectTrigger className="pv-filtro-select">
              <SelectValue placeholder="Medidor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os medidores</SelectItem>
              <SelectItem value="KM">KM</SelectItem>
              <SelectItem value="Horímetro">Horímetro</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filtros.frente}
            onValueChange={(v) => setFiltro("frente", v)}
          >
            <SelectTrigger className="pv-filtro-select">
              <SelectValue placeholder="Frente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as frentes</SelectItem>
              {frentes.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {frota.loading ? (
          <p className="pv-empty">Carregando preventivas...</p>
        ) : rows.length === 0 ? (
          <p className="pv-empty">Nenhum equipamento cadastrado.</p>
        ) : (
          <>
            <p className="pv-contagem">
              {filtradas.length} de {rows.length} equipamento
              {rows.length === 1 ? "" : "s"}
            </p>

            {/* Barra de rolagem horizontal espelhada no topo */}
            <div
              className="pv-scroll-topo"
              ref={topRef}
              onScroll={syncDoTopo}
              aria-hidden="true"
            >
              <div style={{ width: larguraTabela }} />
            </div>

            <div
              className="pv-table-scroll"
              ref={scrollRef}
              onScroll={syncDaTabela}
            >
              <table className="pv-table" ref={tableRef}>
                <thead>
                  <tr>
                    <th>ID (Chassi / Placa)</th>
                    <th>Nome do Equipamento</th>
                    <th>Tipo de Medidor</th>
                    <th>Plano / Intervalo</th>
                    <th>Última Preventiva</th>
                    <th>Próxima Preventiva (Meta)</th>
                    <th>Leitura Atual</th>
                    <th>Restante para Vencer</th>
                    <th>Frente</th>
                    <th>Status / Alerta</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="pv-sem-resultado">
                        Nenhum equipamento para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filtradas.map((row) => {
                      const st = STATUS[row.status];
                      return (
                        <tr key={row.id}>
                          <td>{row.idChassiPlaca}</td>
                          <td>{row.nomeEquipamento}</td>
                          <td>{row.tipoMedidor}</td>
                          <td>{row.planoIntervalo}</td>
                          <td>{row.ultimaPreventiva}</td>
                          <td>{row.proximaPreventivaMeta}</td>
                          <td>{row.leituraAtual}</td>
                          <td>{row.restanteParaVencer}</td>
                          <td>{row.frente}</td>
                          <td>
                            <span className={`pv-status ${st.cls}`}>
                              {st.label}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="pv-done"
                              disabled={registrando === row.id}
                              onClick={() => {
                                const v = frota.lista.find(
                                  (e) => e.id === row.id,
                                );
                                if (v) void handleFeito(v);
                              }}
                            >
                              <span aria-hidden="true">✓</span>
                              <span>
                                {registrando === row.id ? "..." : "Feito"}
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
