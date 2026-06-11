import { useMemo, useState } from "react";
import {
  isBloqueado,
  isVencido,
  revisaoRestante,
  rotuloLeitura,
  revisaoEm,
  statusRevisao,
  TIPO_ICON,
  TIPO_LABEL,
  unidadeDe,
  type VeiculoFrota,
} from "./frota/types";
import { RevisaoModal } from "./frota/RevisaoModal";
import { useFrota } from "./frota/use-frota";
import "./revisoes.css";

function formatLeitura(v: VeiculoFrota, valor: number): string {
  return `${valor.toLocaleString("pt-BR")} ${unidadeDe(v.tipo)}`;
}

export function RevisoesSection({ prefeituraId }: { prefeituraId: string }) {
  const frota = useFrota(prefeituraId);
  const [liberando, setLiberando] = useState<VeiculoFrota | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null,
  );

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

  const resumo = useMemo(() => {
    const bloqueados = rows.filter((v) => isBloqueado(v));
    const proximos = rows.filter((v) => {
      if (isBloqueado(v)) return false;
      const limite = revisaoEm(v);
      if (limite <= 0) return false;
      return Math.round((v.medicaoAtual / limite) * 100) >= 90;
    });
    const emDia = rows.filter((v) => !isBloqueado(v) && !proximos.includes(v));
    return {
      bloqueados,
      emDiaRows: emDia,
      proximos: proximos.length,
      emDia: emDia.length,
      total: rows.length,
    };
  }, [rows]);

  return (
    <section className="rv-page">
      <div className="rv-kpis">
        <article className="rv-kpi rv-kpi--danger">
          <p className="rv-kpi__label">BLOQUEADOS AGORA</p>
          <strong className="rv-kpi__value">{resumo.bloqueados.length}</strong>
          <small className="rv-kpi__sub">Preventiva vencida</small>
        </article>
        <article className="rv-kpi rv-kpi--warn">
          <p className="rv-kpi__label">PRÓXIMOS (90%+)</p>
          <strong className="rv-kpi__value">{resumo.proximos}</strong>
          <small className="rv-kpi__sub">Atenção necessária</small>
        </article>
        <article className="rv-kpi rv-kpi--ok">
          <p className="rv-kpi__label">EM DIA</p>
          <strong className="rv-kpi__value">{resumo.emDia}</strong>
          <small className="rv-kpi__sub">Normal</small>
        </article>
        <article className="rv-kpi">
          <p className="rv-kpi__label">TOTAL COM PREVENTIVA</p>
          <strong className="rv-kpi__value">{resumo.total}</strong>
          <small className="rv-kpi__sub">cadastrados</small>
        </article>
      </div>

      <div className="rv-head">
        <h1 className="rv-title rv-title--blocked">
          <span className="rv-title__icon" aria-hidden>
            🔒
          </span>
          Equipamentos bloqueados
        </h1>
      </div>

      {frota.loading ? (
        <p className="rv-empty">Carregando preventivas...</p>
      ) : resumo.bloqueados.length === 0 ? (
        <p className="rv-empty">Nenhum equipamento bloqueado no momento.</p>
      ) : (
        <div className="rv-blocked-list">
          {resumo.bloqueados.map((v) => {
            const un = unidadeDe(v.tipo);
            const excesso = Math.max(v.medicaoAtual - revisaoEm(v), 0);
            const limite = revisaoEm(v);
            const uso =
              limite > 0 ? Math.round((v.medicaoAtual / limite) * 100) : 0;
            const usoCard = isVencido(v)
              ? 100
              : Math.max(Math.min(uso, 100), 0);
            return (
              <article key={v.id} className="rv-blocked-card">
                <header className="rv-blocked-card__head">
                  <div className="rv-blocked-card__title-wrap">
                    <span className="rv-plate">{v.placa}</span>
                    <div>
                      <h2 className="rv-vehicle">{v.nome}</h2>
                      <p className="rv-subtitle">
                        {TIPO_LABEL[v.tipo]} · obra: {v.obra || "Disponível"}
                      </p>
                    </div>
                  </div>
                  <div className="rv-blocked-card__tags">
                    <span className="rv-type-chip">
                      {TIPO_ICON[v.tipo]} {TIPO_LABEL[v.tipo].toUpperCase()}
                    </span>
                    <span className="rv-lock" aria-hidden>
                      🔒
                    </span>
                  </div>
                </header>

                <div className="rv-progress-wrap">
                  <div className="rv-progress-head">
                    <span>{rotuloLeitura(v.tipo)}</span>
                    <span className="rv-progress-text">
                      {isVencido(v)
                        ? `100% - VENCIDO +${excesso.toLocaleString("pt-BR")} ${un}`
                        : `${usoCard}% - BLOQUEADO`}
                    </span>
                  </div>
                  <div className="rv-progress">
                    <div style={{ width: `${usoCard}%` }} />
                  </div>
                </div>

                <div className="rv-metrics">
                  <div className="rv-metric">
                    <span>ATUAL</span>
                    <strong>{formatLeitura(v, v.medicaoAtual)}</strong>
                  </div>
                  <div className="rv-metric">
                    <span>INTERVALO</span>
                    <strong>{formatLeitura(v, v.intervaloRevisao)}</strong>
                  </div>
                  <div className="rv-metric">
                    <span>EXCESSO</span>
                    <strong>
                      {excesso.toLocaleString("pt-BR")} {un}
                    </strong>
                  </div>
                  <div className="rv-metric">
                    <span>USO</span>
                    <strong>{usoCard}%</strong>
                  </div>
                </div>

                <footer className="rv-blocked-card__foot">
                  <p>
                    Bloqueado - registre a preventiva para liberar o abastecimento
                  </p>
                  <button
                    type="button"
                    className="rv-done"
                    onClick={() => {
                      setMsg(null);
                      setLiberando(v);
                    }}
                  >
                    Registrar preventiva
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <div className="rv-head rv-head--ok">
        <h1 className="rv-title rv-title--ok">
          <span className="rv-title__icon" aria-hidden>
            ✓
          </span>
          Em dia
        </h1>
      </div>

      {frota.loading ? (
        <p className="rv-empty">Carregando equipamentos em dia...</p>
      ) : resumo.emDiaRows.length === 0 ? (
        <p className="rv-empty">Nenhum equipamento em dia no momento.</p>
      ) : (
        <div className="rv-ok-table-wrap">
          <table className="rv-ok-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Veículo</th>
                <th>Tipo</th>
                <th>Progresso</th>
                <th>Restante</th>
                <th>Configuração</th>
              </tr>
            </thead>
            <tbody>
              {resumo.emDiaRows.map((v) => {
                const limite = revisaoEm(v);
                const progresso =
                  limite > 0
                    ? Math.max(
                        Math.min(
                          Math.round((v.medicaoAtual / limite) * 100),
                          100,
                        ),
                        0,
                      )
                    : 0;
                return (
                  <tr key={`ok-${v.id}`}>
                    <td>
                      <span className="rv-ok-plate">{v.placa}</span>
                    </td>
                    <td>{v.nome}</td>
                    <td>
                      <span className="rv-ok-type">{TIPO_LABEL[v.tipo]}</span>
                    </td>
                    <td>
                      <div className="rv-ok-progress-row">
                        <div className="rv-ok-progress">
                          <div style={{ width: `${progresso}%` }} />
                        </div>
                        <span>{progresso}%</span>
                      </div>
                    </td>
                    <td className="rv-ok-restante">
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
      )}

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
