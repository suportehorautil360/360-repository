import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, AlertTriangle, Calendar, Image as ImageIcon } from "lucide-react";
import {
  pontosApi,
  TIPOS_PONTO,
  type PontoRegistro,
  type StatusPonto,
} from "../../../lib/api/pontos";
import { escalaApi, type Escala } from "../../../lib/api/escala";
import {
  agruparPorFuncionario,
  intervaloDoPeriodo,
  type FuncionarioResumo,
  type PeriodoPreset,
  type StatusDia,
} from "../../../lib/ponto/agruparPorFuncionario";
import { funcionariosApi, type Funcionario } from "../../../lib/funcionarios/funcionarios";
import { limparCpf, formatarCpf } from "../../../lib/funcionarios/cpf";
import { fmtMin } from "./horasPonto";
import { KpiCard } from "../../../components/Kpi/KpiCard";
import { JornadaInline } from "../../../components/JornadaInline/JornadaInline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import "./pontos-rh.css";

const PERIODO_LABEL: Record<PeriodoPreset, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  semana: "Últimos 7 dias",
  mes: "Últimos 30 dias",
};

const STATUS_DIA_LABEL: Record<StatusDia, string> = {
  ok: "OK",
  atraso: "Atraso",
  incompleto: "Incompleto",
  falta: "Falta",
  "sem-jornada": "—",
};

const STATUS_PONTO_LABEL: Record<StatusPonto, string> = {
  pendente: "Pendente",
  aprovado: "Aprovada",
  reprovado: "Reprovada",
};

type FiltroSituacao = "todos" | StatusDia | "com-pendencia";

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diaLegivel(diaIso: string): string {
  return new Date(`${diaIso}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

interface DetalheAberto {
  resumo: FuncionarioResumo;
  diaIso: string; // dia em foco no drawer
}

export function PontosRhSection({ prefeituraId }: { prefeituraId: string }) {
  const [registros, setRegistros] = useState<PontoRegistro[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [escala, setEscala] = useState<Escala | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [periodo, setPeriodo] = useState<PeriodoPreset>("hoje");
  const [busca, setBusca] = useState("");
  const [filtroSit, setFiltroSit] = useState<FiltroSituacao>("todos");

  const [detalhe, setDetalhe] = useState<DetalheAberto | null>(null);
  const [reprovandoId, setReprovandoId] = useState<string | null>(null);
  const [motivoReprov, setMotivoReprov] = useState("");
  const [fotoAmpliada, setFotoAmpliada] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const intervalo = useMemo(() => intervaloDoPeriodo(periodo), [periodo]);

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setCarregando(true);
    setErro("");
    try {
      const [lista, funcs, esc] = await Promise.all([
        pontosApi.listar(prefeituraId),
        funcionariosApi.listar(prefeituraId),
        escalaApi.obter(prefeituraId).catch(() => null),
      ]);
      setRegistros(lista);
      setFuncionarios(funcs);
      setEscala(esc);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const resumos = useMemo(
    () => agruparPorFuncionario(registros, funcionarios, intervalo.dias, escala),
    [registros, funcionarios, intervalo.dias, escala],
  );

  const filtrados = useMemo(() => {
    const termo = limparCpf(busca) || busca.trim().toLowerCase();
    const ehNum = /\d/.test(busca);
    return resumos.filter((r) => {
      // Filtro de busca: nome OU CPF (se houver cadastro casado).
      if (busca.trim()) {
        if (ehNum) {
          if (!r.funcionario || !r.funcionario.cpf.includes(termo)) return false;
        } else {
          if (!r.nome.toLowerCase().includes(termo)) return false;
        }
      }
      // Filtro de situação. "hoje"/"ontem" olha o status do único dia;
      // semana/mês olha se ALGUM dia se encaixa.
      if (filtroSit === "todos") return true;
      if (filtroSit === "com-pendencia") return r.totais.pendentes > 0;
      return r.dias.some((d) => d.status === filtroSit);
    });
  }, [resumos, busca, filtroSit]);

  // ---- KPIs ----
  const kpis = useMemo(() => {
    let pendentes = 0;
    let atrasos = 0;
    let faltas = 0;
    let semRegistro = 0;
    const ehHoje = periodo === "hoje";
    for (const r of resumos) {
      pendentes += r.totais.pendentes;
      atrasos += r.totais.atrasos;
      faltas += r.totais.faltas;
      // "Sem registro" só faz sentido em "hoje": funcionários ativos
      // cadastrados que não bateram nenhum ponto hoje.
      if (ehHoje && r.funcionario?.status === "ativo") {
        const hoje = intervalo.dias[0];
        const diaHoje = r.dias.find((d) => d.dia === hoje);
        if (diaHoje && diaHoje.batidas.length === 0 && diaHoje.status !== "sem-jornada") {
          semRegistro += 1;
        }
      }
    }
    return { pendentes, atrasos, faltas, semRegistro };
  }, [resumos, periodo, intervalo.dias]);

  function abrirDetalhe(r: FuncionarioResumo) {
    // Abre no dia mais recente que tenha batidas; se nenhum, no primeiro do período.
    const comBatidas = r.dias.find((d) => d.batidas.length > 0);
    setDetalhe({ resumo: r, diaIso: (comBatidas ?? r.dias[0])?.dia ?? intervalo.fim });
    setReprovandoId(null);
    setMotivoReprov("");
  }

  async function aprovar(id: string) {
    setOcupado(true);
    try {
      await pontosApi.aprovar(id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao aprovar.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarReprovacao(id: string) {
    if (!motivoReprov.trim()) return;
    setOcupado(true);
    try {
      await pontosApi.reprovar(id, motivoReprov.trim());
      setReprovandoId(null);
      setMotivoReprov("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao reprovar.");
    } finally {
      setOcupado(false);
    }
  }

  if (carregando) {
    return <p className="rh-msg">Carregando registros de ponto…</p>;
  }

  const periodoLabel = PERIODO_LABEL[periodo];
  const diaUnico = periodo === "hoje" || periodo === "ontem";

  return (
    <div className="rh">
      <h1 className="rh__page-titulo">Central de Ponto</h1>
      <p className="rh__lead">
        Visão diária do RH: pendências de aprovação, faltas, atrasos e jornada
        do dia por funcionário.
      </p>

      <div className="rh__kpis">
        <KpiCard
          label="Pendentes"
          valor={kpis.pendentes}
          sub="correções aguardando RH"
          tom={kpis.pendentes > 0 ? "aviso" : "neutro"}
          onClick={() => setFiltroSit("com-pendencia")}
          titulo="Mostrar quem tem batida pendente"
        />
        <KpiCard
          label="Atrasos"
          valor={kpis.atrasos}
          sub={`no período · ${periodoLabel.toLowerCase()}`}
          tom={kpis.atrasos > 0 ? "aviso" : "neutro"}
          onClick={() => setFiltroSit("atraso")}
          titulo="Mostrar quem teve atraso"
        />
        <KpiCard
          label="Faltas"
          valor={kpis.faltas}
          sub={`no período · ${periodoLabel.toLowerCase()}`}
          tom={kpis.faltas > 0 ? "erro" : "neutro"}
          onClick={() => setFiltroSit("falta")}
          titulo="Mostrar quem teve falta"
        />
        <KpiCard
          label="Sem registro hoje"
          valor={periodo === "hoje" ? kpis.semRegistro : "—"}
          sub={periodo === "hoje" ? "ativos sem ponto hoje" : "só em Hoje"}
          tom={kpis.semRegistro > 0 ? "erro" : "neutro"}
          titulo="Funcionários ativos sem nenhuma batida hoje"
        />
      </div>

      {erro && <p className="rh-msg rh-msg--err">{erro}</p>}

      <div className="rh__filtros">
        <div className="rh__busca">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar nome ou CPF…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoPreset)}>
          {Object.entries(PERIODO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filtroSit}
          onChange={(e) => setFiltroSit(e.target.value as FiltroSituacao)}
        >
          <option value="todos">Todos</option>
          <option value="com-pendencia">Com pendência</option>
          <option value="atraso">Com atraso</option>
          <option value="falta">Com falta</option>
          <option value="incompleto">Incompletos</option>
          <option value="ok">Só OK</option>
        </select>
      </div>

      <div className="rh__tabela-wrap">
        <table className="rh__tabela">
          <thead>
            <tr>
              <th>Funcionário</th>
              {diaUnico ? (
                <>
                  <th>Jornada</th>
                  <th>Situação</th>
                  <th>Saldo</th>
                </>
              ) : (
                <>
                  <th>OK</th>
                  <th>Atrasos</th>
                  <th>Faltas</th>
                  <th>Saldo total</th>
                </>
              )}
              <th>Pendências</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="rh__vazio">
                  Nenhum funcionário corresponde aos filtros.
                </td>
              </tr>
            ) : (
              filtrados.map((r) => {
                const dia = diaUnico ? r.dias[0] : null;
                return (
                  <tr key={r.nome}>
                    <td>
                      <strong>{r.nome || "(sem nome)"}</strong>
                      {r.funcionario && (
                        <span className="rh__sub">
                          {r.funcionario.cargo || "—"}
                          {r.funcionario.matricula && ` · mat. ${r.funcionario.matricula}`}
                        </span>
                      )}
                      {!r.funcionario && (
                        <span className="rh__sub rh__sub--alerta">
                          Sem cadastro vinculado
                        </span>
                      )}
                    </td>

                    {diaUnico && dia ? (
                      <>
                        <td>
                          {dia.batidas.length > 0 ? (
                            <JornadaInline batidas={dia.batidas} />
                          ) : (
                            <span className="rh__mute">—</span>
                          )}
                        </td>
                        <td>
                          <span className={`rh__chip rh__chip--${dia.status}`}>
                            {STATUS_DIA_LABEL[dia.status]}
                          </span>
                        </td>
                        <td className="rh__num">
                          {dia.previstoMin === 0 ? (
                            "—"
                          ) : (
                            <span
                              className={
                                dia.saldoMin < 0 ? "rh__neg" : "rh__pos"
                              }
                            >
                              {dia.saldoMin >= 0 ? "+" : ""}
                              {fmtMin(dia.saldoMin)}
                            </span>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="rh__num">{r.totais.diasOk}</td>
                        <td className="rh__num">
                          {r.totais.atrasos > 0 ? (
                            <span className="rh__neg">{r.totais.atrasos}</span>
                          ) : (
                            r.totais.atrasos
                          )}
                        </td>
                        <td className="rh__num">
                          {r.totais.faltas > 0 ? (
                            <span className="rh__neg">{r.totais.faltas}</span>
                          ) : (
                            r.totais.faltas
                          )}
                        </td>
                        <td className="rh__num">
                          <span
                            className={
                              r.totais.saldoMin < 0 ? "rh__neg" : "rh__pos"
                            }
                          >
                            {r.totais.saldoMin >= 0 ? "+" : ""}
                            {fmtMin(r.totais.saldoMin)}
                          </span>
                        </td>
                      </>
                    )}

                    <td>
                      {r.totais.pendentes > 0 ? (
                        <span className="rh__chip rh__chip--pendente">
                          {r.totais.pendentes} pendente
                          {r.totais.pendentes !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="rh__mute">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="rh__link"
                        onClick={() => abrirDetalhe(r)}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer de detalhe */}
      <Dialog
        open={!!detalhe}
        onOpenChange={(aberto) => {
          if (!aberto) setDetalhe(null);
        }}
      >
        <DialogContent className="rh-drawer">
          {detalhe && (
            <>
              <DialogTitle asChild>
                <h2 className="rh-drawer__titulo">
                  {detalhe.resumo.nome}
                  {detalhe.resumo.funcionario && (
                    <span className="rh-drawer__sub">
                      {detalhe.resumo.funcionario.cpf
                        ? formatarCpf(detalhe.resumo.funcionario.cpf)
                        : ""}
                      {detalhe.resumo.funcionario.cargo
                        ? ` · ${detalhe.resumo.funcionario.cargo}`
                        : ""}
                    </span>
                  )}
                </h2>
              </DialogTitle>
              <DialogDescription className="rh-drawer__lead">
                Detalhe do dia {diaLegivel(detalhe.diaIso)}.
              </DialogDescription>

              {/* Navegação entre dias do período (se mais de 1) */}
              {detalhe.resumo.dias.length > 1 && (
                <div className="rh-drawer__dias">
                  {detalhe.resumo.dias.map((d) => (
                    <button
                      key={d.dia}
                      type="button"
                      className={`rh-drawer__dia-btn ${detalhe.diaIso === d.dia ? "is-ativo" : ""}`}
                      onClick={() => setDetalhe({ ...detalhe, diaIso: d.dia })}
                    >
                      {diaLegivel(d.dia)}
                      <span className={`rh__chip rh__chip--${d.status}`}>
                        {STATUS_DIA_LABEL[d.status]}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="rh-drawer__batidas">
                {TIPOS_PONTO.map(({ tipo, label }) => {
                  const dia = detalhe.resumo.dias.find(
                    (x) => x.dia === detalhe.diaIso,
                  );
                  const reg = dia?.batidas.find((b) => b.tipo === tipo);
                  if (!reg) {
                    return (
                      <div key={tipo} className="rh-drawer__batida rh-drawer__batida--vazia">
                        <span className="rh-drawer__batida-label">{label}</span>
                        <span className="rh__mute">Sem registro</span>
                      </div>
                    );
                  }
                  const status = reg.status ?? "pendente";
                  return (
                    <div key={tipo} className="rh-drawer__batida">
                      <span className="rh-drawer__batida-label">{label}</span>
                      {reg.photo ? (
                        <button
                          type="button"
                          className="rh-drawer__foto"
                          onClick={() => setFotoAmpliada(reg.photo ?? "")}
                          aria-label="Ampliar foto"
                        >
                          <img src={reg.photo} alt={`Selfie ${label}`} />
                        </button>
                      ) : (
                        <span className="rh-drawer__foto rh-drawer__foto--sem">
                          <ImageIcon size={14} aria-hidden="true" />
                        </span>
                      )}
                      <strong className="rh-drawer__hora">
                        {horaDe(reg.timestampOriginal)}
                      </strong>
                      <span className={`rh__chip rh__chip--${status}`}>
                        {STATUS_PONTO_LABEL[status]}
                      </span>

                      {reprovandoId === reg.id ? (
                        <div className="rh-drawer__reprovar">
                          <input
                            type="text"
                            placeholder="Motivo da reprovação"
                            value={motivoReprov}
                            onChange={(e) => setMotivoReprov(e.target.value)}
                          />
                          <button
                            type="button"
                            className="rh-btn rh-btn--err"
                            disabled={ocupado || !motivoReprov.trim()}
                            onClick={() => void confirmarReprovacao(reg.id)}
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            className="rh-btn"
                            onClick={() => {
                              setReprovandoId(null);
                              setMotivoReprov("");
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="rh-drawer__acoes">
                          {status !== "aprovado" && (
                            <button
                              type="button"
                              className="rh-btn rh-btn--ok"
                              disabled={ocupado}
                              onClick={() => void aprovar(reg.id)}
                            >
                              Aprovar
                            </button>
                          )}
                          {status !== "reprovado" && (
                            <button
                              type="button"
                              className="rh-btn rh-btn--err"
                              disabled={ocupado}
                              onClick={() => {
                                setReprovandoId(reg.id);
                                setMotivoReprov("");
                              }}
                            >
                              Reprovar
                            </button>
                          )}
                        </div>
                      )}

                      {reg.motivoReprovacao && status === "reprovado" && (
                        <span className="rh-drawer__motivo">
                          <AlertTriangle size={12} aria-hidden="true" />
                          {reg.motivoReprovacao}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {detalhe.resumo.funcionario && (
                <div className="rh-drawer__atalhos">
                  <a
                    className="rh-drawer__link-mes"
                    href={`/prefeitura/${prefeituraId}/funcionarios/${detalhe.resumo.funcionario.id}/historico`}
                  >
                    <Calendar size={14} aria-hidden="true" />
                    Ver histórico do mês
                  </a>
                  <a
                    className="rh-drawer__link-mes"
                    href={`/prefeitura/${prefeituraId}/funcionarios/${detalhe.resumo.funcionario.id}/editar`}
                  >
                    Abrir cadastro
                  </a>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {fotoAmpliada && (
        <div
          className="rh-foto-modal"
          role="presentation"
          onClick={() => setFotoAmpliada("")}
        >
          <img src={fotoAmpliada} alt="Selfie ampliada" />
        </div>
      )}
    </div>
  );
}
