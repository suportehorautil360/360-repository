import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, AlertTriangle, Calendar, Image as ImageIcon } from "lucide-react";
import {
  pontosApi,
  TIPOS_PONTO,
  type PontoRegistro,
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
import { abonosApi, type Abono } from "../../../lib/api/abonos";
import { limparCpf, formatarCpf } from "../../../lib/funcionarios/cpf";
import { fmtMin } from "./horasPonto";
import { KpiCard } from "../../../components/Kpi/KpiCard";
import { JornadaInline } from "../../../components/JornadaInline/JornadaInline";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  abonado: "Abonado",
  "sem-jornada": "—",
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

/** Iniciais de uma pessoa para o avatar (até 2 caracteres). */
function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

interface DetalheAberto {
  resumo: FuncionarioResumo;
  diaIso: string; // dia em foco no drawer
}

export function PontosRhSection({ prefeituraId }: { prefeituraId: string }) {
  const [registros, setRegistros] = useState<PontoRegistro[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [escala, setEscala] = useState<Escala | null>(null);
  const [abonos, setAbonos] = useState<Abono[]>([]);
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
      const [lista, funcs, esc, abs] = await Promise.all([
        pontosApi.listar(prefeituraId),
        funcionariosApi.listar(prefeituraId),
        escalaApi.obter(prefeituraId).catch(() => null),
        abonosApi.listar(prefeituraId).catch(() => []),
      ]);
      setRegistros(lista);
      setFuncionarios(funcs);
      setEscala(esc);
      setAbonos(abs);
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
    () =>
      agruparPorFuncionario(
        registros,
        funcionarios,
        intervalo.dias,
        escala,
        abonos,
      ),
    [registros, funcionarios, intervalo.dias, escala, abonos],
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
          <option value="abonado">Com abono</option>
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

      {/* Drawer de detalhe (Sheet do shadcn — lateral à direita) */}
      <Sheet
        open={!!detalhe}
        onOpenChange={(aberto) => {
          if (!aberto) setDetalhe(null);
        }}
      >
        <SheetContent side="right" className="rh-sheet sm:max-w-lg">
          {(() => {
            if (!detalhe) return null;
            const f = detalhe.resumo.funcionario;
            const diaAtual = detalhe.resumo.dias.find(
              (x) => x.dia === detalhe.diaIso,
            );

            return (
              <>
                <SheetHeader className="rh-sheet__head">
                  <div className="rh-sheet__head-row">
                    <div className="rh-sheet__avatar" aria-hidden="true">
                      {iniciaisDe(detalhe.resumo.nome)}
                    </div>
                    <div className="rh-sheet__id">
                      <SheetTitle asChild>
                        <h2 className="rh-sheet__nome">
                          {detalhe.resumo.nome}
                        </h2>
                      </SheetTitle>
                      <SheetDescription asChild>
                        <span className="rh-sheet__id-sub">
                          {f?.cpf ? formatarCpf(f.cpf) : "Sem cadastro"}
                          {f?.cargo ? ` · ${f.cargo}` : ""}
                          {f?.matricula ? ` · mat. ${f.matricula}` : ""}
                        </span>
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="rh-sheet__corpo">
                  <p className="rh-sheet__contexto">
                    <Calendar size={13} aria-hidden="true" />
                    <span>
                      Detalhe do dia{" "}
                      <strong>{diaLegivel(detalhe.diaIso)}</strong>
                    </span>
                    {diaAtual && (
                      <span
                        className={`rh__chip rh__chip--${diaAtual.status}`}
                      >
                        {STATUS_DIA_LABEL[diaAtual.status]}
                      </span>
                    )}
                  </p>

                  {diaAtual?.status === "abonado" && (
                    <p className="rh-sheet__abono-info">
                      <AlertTriangle size={13} aria-hidden="true" />
                      <span>
                        <strong>Dia abonado</strong>
                        {diaAtual.motivoAbono
                          ? ` · ${diaAtual.motivoAbono}`
                          : ""}
                      </span>
                    </p>
                  )}

                  {detalhe.resumo.dias.length > 1 && (
                    <div className="rh-sheet__dias">
                      {detalhe.resumo.dias.map((d) => (
                        <button
                          key={d.dia}
                          type="button"
                          className={`rh-sheet__dia-btn ${detalhe.diaIso === d.dia ? "is-ativo" : ""}`}
                          onClick={() =>
                            setDetalhe({ ...detalhe, diaIso: d.dia })
                          }
                        >
                          <span>{diaLegivel(d.dia)}</span>
                          <span className={`rh__chip rh__chip--${d.status}`}>
                            {STATUS_DIA_LABEL[d.status]}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <ul className="rh-sheet__batidas">
                    {TIPOS_PONTO.map(({ tipo, label }) => {
                      const reg = diaAtual?.batidas.find((b) => b.tipo === tipo);
                      if (!reg) {
                        return (
                          <li
                            key={tipo}
                            className="rh-sheet__bat rh-sheet__bat--vazia"
                          >
                            <span className="rh-sheet__bat-label">{label}</span>
                            <span className="rh-sheet__bat-vazio">
                              Sem registro
                            </span>
                          </li>
                        );
                      }
                      // A marcação original é sempre válida e read-only
                      // (Portaria 671). O RH só decide sobre uma CORREÇÃO
                      // pendente, quando existe.
                      const temPendencia =
                        !!reg.ajustePendente && !!reg.ajustePendenteId;
                      const ajusteId = reg.ajustePendenteId ?? "";
                      const reprovandoEssa =
                        !!ajusteId && reprovandoId === ajusteId;
                      return (
                        <li
                          key={tipo}
                          className={`rh-sheet__bat rh-sheet__bat--${
                            temPendencia ? "pendente" : "aprovado"
                          }`}
                        >
                          <div className="rh-sheet__bat-linha">
                            {reg.photo ? (
                              <button
                                type="button"
                                className="rh-sheet__foto"
                                onClick={() => setFotoAmpliada(reg.photo ?? "")}
                                aria-label="Ampliar selfie"
                              >
                                <img src={reg.photo} alt={`Selfie ${label}`} />
                              </button>
                            ) : (
                              <span
                                className="rh-sheet__foto rh-sheet__foto--sem"
                                aria-hidden="true"
                              >
                                <ImageIcon size={14} />
                              </span>
                            )}
                            <div className="rh-sheet__bat-meio">
                              <span className="rh-sheet__bat-label">
                                {label}
                              </span>
                              <strong className="rh-sheet__bat-hora">
                                {horaDe(reg.timestampOriginal)}
                              </strong>
                            </div>
                            <span className="rh__chip rh__chip--aprovado">
                              Registrado
                            </span>
                          </div>

                          {temPendencia && (
                            <>
                              <span className="rh-sheet__motivo">
                                <AlertTriangle size={12} aria-hidden="true" />
                                Correção solicitada para{" "}
                                {horaDe(reg.horarioAjustePendente ?? "")}
                                {reg.motivoAjustePendente
                                  ? ` — ${reg.motivoAjustePendente}`
                                  : ""}
                              </span>

                              {reprovandoEssa ? (
                                <div className="rh-sheet__reprovar">
                                  <input
                                    type="text"
                                    placeholder="Motivo da reprovação"
                                    value={motivoReprov}
                                    onChange={(e) =>
                                      setMotivoReprov(e.target.value)
                                    }
                                    autoFocus
                                  />
                                  <div className="rh-sheet__reprovar-acoes">
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
                                    <button
                                      type="button"
                                      className="rh-btn rh-btn--err"
                                      disabled={ocupado || !motivoReprov.trim()}
                                      onClick={() =>
                                        void confirmarReprovacao(ajusteId)
                                      }
                                    >
                                      Confirmar reprovação
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="rh-sheet__bat-acoes">
                                  <button
                                    type="button"
                                    className="rh-btn rh-btn--ok"
                                    disabled={ocupado}
                                    onClick={() => void aprovar(ajusteId)}
                                  >
                                    Aprovar correção
                                  </button>
                                  <button
                                    type="button"
                                    className="rh-btn rh-btn--err"
                                    disabled={ocupado}
                                    onClick={() => {
                                      setReprovandoId(ajusteId);
                                      setMotivoReprov("");
                                    }}
                                  >
                                    Reprovar
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {diaAtual && diaAtual.previstoMin > 0 && (
                    <div className="rh-sheet__resumo">
                      <div>
                        <span>Trabalhado</span>
                        <strong>{fmtMin(diaAtual.trabalhadoMin)}</strong>
                      </div>
                      <div>
                        <span>Previsto</span>
                        <strong>{fmtMin(diaAtual.previstoMin)}</strong>
                      </div>
                      <div>
                        <span>Saldo</span>
                        <strong
                          className={
                            diaAtual.saldoMin < 0 ? "rh__neg" : "rh__pos"
                          }
                        >
                          {diaAtual.saldoMin >= 0 ? "+" : ""}
                          {fmtMin(diaAtual.saldoMin)}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                {f && (
                  <SheetFooter className="rh-sheet__rodape">
                    <a
                      className="rh-sheet__link rh-sheet__link--primary"
                      href={`/prefeitura/${prefeituraId}/funcionarios/${f.id}/historico`}
                    >
                      <Calendar size={14} aria-hidden="true" />
                      Ver histórico do mês
                    </a>
                    <a
                      className="rh-sheet__link"
                      href={`/prefeitura/${prefeituraId}/funcionarios/${f.id}/editar`}
                    >
                      Abrir cadastro
                    </a>
                  </SheetFooter>
                )}
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

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
