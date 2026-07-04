import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck,
  Fuel,
  Lock,
  Wrench,
  Banknote,
  HardHat,
  BarChart3,
  Users,
} from "lucide-react";
import {
  checklistsRegistrosApi,
  type TopOperadorChecklistApi,
} from "../../../lib/api/checklists-registros";
import {
  equipamentosApi,
  isBloqueado,
  isVencido,
  revisaoEm,
  type EquipRow,
} from "./equipamentos/equipamentos-api";
import {
  abastecimentosApi,
  fmtTotalAbastecimento,
  totalAbastecimentoEhComboio,
  type Abastecimento,
} from "../../../lib/api/abastecimentos";
import { categoriaDoTipo } from "../../../lib/api/configuracoes";
import { topOperadoresParaGrafico } from "./painel-top-operadores";
import "./painel.css";

const GraficoBarras = lazy(() =>
  import("./PainelCharts").then((m) => ({ default: m.GraficoBarras })),
);

const GraficoBarrasHorizontais = lazy(() =>
  import("./PainelCharts").then((m) => ({
    default: m.GraficoBarrasHorizontais,
  })),
);

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}
function fmtStatus(s: string): string {
  if (s === "pendente") return "Pendente";
  if (s === "aprovado") return "Aprovado";
  if (s === "irregular") return "Rejeitado";
  return "—";
}
function fmtKBRL(v: number): string {
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
  return `R$${Math.round(v)}`;
}
function mesChave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function diasEntre(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

export function DashboardSection({ prefeituraId }: { prefeituraId: string }) {
  const navigate = useNavigate();
  const [equipamentos, setEquipamentos] = useState<EquipRow[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [topOperadores, setTopOperadores] = useState<TopOperadorChecklistApi[]>(
    [],
  );
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      const agora = new Date();
      const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
      const [eqs, abs, ranking] = await Promise.all([
        equipamentosApi.listar(prefeituraId).catch(() => []),
        abastecimentosApi.listar(prefeituraId).catch(() => []),
        checklistsRegistrosApi
          .topOperadores(prefeituraId, mesAtual)
          .catch(() => ({ mes: mesAtual, operadores: [] })),
      ]);
      if (!ativo) return;
      setEquipamentos(eqs);
      setAbastecimentos(abs);
      setTopOperadores(ranking.operadores);
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [prefeituraId]);

  const m = useMemo(() => {
    const hoje = new Date();
    const mesAtual = mesChave(hoje);
    const restante = (eq: EquipRow) => revisaoEm(eq) - eq.medicaoAtual;

    let carros = 0,
      caminhoes = 0,
      maquinas = 0;
    for (const eq of equipamentos) {
      const cat = categoriaDoTipo(eq.tipo);
      if (cat === "caminhao") caminhoes++;
      else if (cat === "maquina") maquinas++;
      else carros++;
    }

    const bloqueados = equipamentos.filter(isBloqueado);
    const pendentes = equipamentos.filter(
      (eq) => eq.intervaloRevisao > 0 && restante(eq) <= eq.intervaloRevisao * 0.1,
    );

    const noMes = abastecimentos.filter((a) => a.data.startsWith(mesAtual));
    const litrosMes = noMes.reduce((s, a) => s + a.litros, 0);
    const valorMes = noMes.reduce((s, a) => s + a.valor, 0);
    const totalGeral = abastecimentos.reduce((s, a) => s + a.valor, 0);

    const porTipo = new Map<string, number>();
    let litrosTotal = 0;
    for (const a of abastecimentos) {
      porTipo.set(a.combustivel, (porTipo.get(a.combustivel) ?? 0) + a.litros);
      litrosTotal += a.litros;
    }
    const consumo = [...porTipo.entries()]
      .map(([tipo, litros]) => ({
        tipo,
        pct: litrosTotal ? Math.round((litros / litrosTotal) * 100) : 0,
      }))
      .sort((a, b) => b.pct - a.pct);

    const gastos: { label: string; valor: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const chave = mesChave(d);
      const valor = abastecimentos
        .filter((a) => a.data.startsWith(chave))
        .reduce((s, a) => s + a.valor, 0);
      gastos.push({ label: MESES[d.getMonth()], valor });
    }

    const semanas = Array.from({ length: 7 }, (_, i) => ({
      label: `S${i + 1}`,
      valor: 0,
    }));
    for (const a of abastecimentos) {
      if (!a.data) continue;
      const dd = new Date(a.data + "T00:00:00");
      const wk = Math.floor(diasEntre(hoje, dd) / 7);
      if (wk >= 0 && wk < 7) semanas[6 - wk].valor += 1;
    }

    const proximas = [...equipamentos]
      .filter((eq) => eq.intervaloRevisao > 0)
      .sort((a, b) => restante(a) - restante(b))
      .slice(0, 5);

    const frentes = new Map<string, number>();
    for (const eq of equipamentos) {
      const f = eq.obra?.trim() || "Disponível";
      frentes.set(f, (frentes.get(f) ?? 0) + 1);
    }
    const porFrente = [...frentes.entries()]
      .map(([frente, qtd]) => ({ frente, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 6);

    return {
      frota: equipamentos.length,
      carros,
      caminhoes,
      maquinas,
      bloqueados,
      pendentes: pendentes.length,
      litrosMes,
      valorMes,
      totalGeral,
      ultimos: abastecimentos.slice(0, 5),
      consumo,
      gastos,
      semanas,
      proximas,
      porFrente,
      restante,
    };
  }, [equipamentos, abastecimentos]);

  const topOperadoresGrafico = useMemo(
    () => topOperadoresParaGrafico(topOperadores),
    [topOperadores],
  );

  const periodoOperadores = useMemo(() => {
    const agora = new Date();
    const mesLabel = agora.toLocaleString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    return `${mesLabel.charAt(0).toUpperCase()}${mesLabel.slice(1)}`;
  }, []);

  function abrirEquipamento(eq: EquipRow) {
    navigate(`/prefeitura/${prefeituraId}/equipamentos/${eq.id}/editar`);
  }

  if (carregando) {
    return <p className="pnl__loading">Carregando painel…</p>;
  }

  return (
    <div className="pnl">
      <div className="pnl__kpis">
        <article className="pnl__kpi">
          <span className="pnl__kpi-top">
            <Truck size={13} /> Veículos na frota
          </span>
          <strong>{m.frota}</strong>
          <small>
            {m.carros} carros · {m.caminhoes} cam. · {m.maquinas} máq.
          </small>
        </article>
        <article className="pnl__kpi">
          <span className="pnl__kpi-top">
            <Fuel size={13} /> Combustível (mês)
          </span>
          <strong>{fmtBRL(m.valorMes)}</strong>
          <small>{Math.round(m.litrosMes)} L abastecidos</small>
        </article>
        <article className="pnl__kpi pnl__kpi--alerta">
          <span className="pnl__kpi-top">
            <Lock size={13} /> Bloqueados
          </span>
          <strong className="pnl__num-alerta">{m.bloqueados.length}</strong>
          <small>Revisão vencida</small>
        </article>
        <article className="pnl__kpi">
          <span className="pnl__kpi-top">
            <Wrench size={13} /> Manutenções pendentes
          </span>
          <strong className="pnl__num-alerta">{m.pendentes}</strong>
        </article>
        <article className="pnl__kpi">
          <span className="pnl__kpi-top">
            <Banknote size={13} /> Total gasto geral
          </span>
          <strong>{fmtBRL(m.totalGeral)}</strong>
        </article>
      </div>

      <div className="pnl__grid2">
        <div className="pnl__col">
          <section className="pnl__card">
            <header className="pnl__card-head">
              <h2>⛽ Últimos abastecimentos</h2>
            </header>
            <div className="pnl__tab-wrap">
              <table className="pnl__tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Veículo</th>
                    <th>Combustível</th>
                    <th>Litros</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {m.ultimos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="pnl__vazio">
                        Nenhum abastecimento registrado.
                      </td>
                    </tr>
                  ) : (
                    m.ultimos.map((a) => (
                      <tr key={a.id}>
                        <td>{a.data.split("-").reverse().join("/")}</td>
                        <td>
                          <span className="pnl__placa">
                            {a.placa || a.veiculo || "—"}
                          </span>
                        </td>
                        <td>{a.combustivel}</td>
                        <td>{a.litros} L</td>
                        <td
                          className={
                            totalAbastecimentoEhComboio(a)
                              ? "pnl__total-comboio"
                              : a.valor <= 0
                                ? "pnl__total-sem-valor"
                                : undefined
                          }
                          title={
                            totalAbastecimentoEhComboio(a)
                              ? "Abastecimento interno — sem cobrança em posto"
                              : a.valor <= 0
                                ? "Posto não registrou valor total neste abastecimento"
                                : undefined
                          }
                        >
                          {fmtTotalAbastecimento(a)}
                        </td>
                        <td>
                          <span
                            className={`pnl__st pnl__st--${a.status || "aprovado"}`}
                          >
                            {fmtStatus(a.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="pnl__card pnl__card--operadores">
            <header className="pnl__card-head">
              <div>
                <h2>
                  <Users size={14} /> Top 5 operadores
                </h2>
                <p className="pnl__card-sub">
                  Ranking por checklists realizados — {periodoOperadores}
                </p>
              </div>
            </header>
            {topOperadoresGrafico.length === 0 ? (
              <p className="pnl__vazio">
                Nenhum checklist registrado para montar o ranking.
              </p>
            ) : (
              <div className="pnl__grafico-operadores">
                <Suspense fallback={<div className="pnl__grafico-ph" />}>
                  <GraficoBarrasHorizontais
                    dados={topOperadoresGrafico}
                    formato={(v) => `${v} insp.`}
                    altura={Math.max(180, topOperadoresGrafico.length * 48)}
                  />
                </Suspense>
              </div>
            )}
          </section>
        </div>

        <div className="pnl__col">
          <section className="pnl__card">
            <header className="pnl__card-head">
              <h2>🔒 Bloqueios por revisão</h2>
              <span className="pnl__badge">{m.bloqueados.length}</span>
            </header>
            {m.bloqueados.length === 0 ? (
              <p className="pnl__vazio">Nenhum equipamento bloqueado. 🎉</p>
            ) : (
              <ul className="pnl__lista">
                {m.bloqueados.map((eq) => {
                  const excesso = Math.max(0, eq.medicaoAtual - revisaoEm(eq));
                  return (
                    <li key={eq.id} className="pnl__bloq">
                      <div className="pnl__bloq-txt">
                        <strong>
                          {eq.chassis || eq.placa || "—"} — {eq.descricao}
                        </strong>
                        <small>
                          +{excesso.toLocaleString("pt-BR")} {eq.unidadeRevisao}{" "}
                          vencidos
                        </small>
                      </div>
                      <button
                        type="button"
                        className="pnl__liberar"
                        onClick={() => abrirEquipamento(eq)}
                      >
                        <Lock size={12} /> Liberar
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="pnl__card">
            <header className="pnl__card-head">
              <h2>🔧 Próximas manutenções</h2>
            </header>
            {m.proximas.length === 0 ? (
              <p className="pnl__vazio">Sem manutenções programadas.</p>
            ) : (
              <ul className="pnl__lista">
                {m.proximas.map((eq) => {
                  const r = m.restante(eq);
                  const vencida = isVencido(eq);
                  return (
                    <li key={eq.id} className="pnl__manut">
                      <span
                        className={`pnl__dot ${vencida ? "is-red" : "is-amber"}`}
                      />
                      <div className="pnl__manut-txt">
                        <strong>
                          {eq.descricao} — {eq.chassis || eq.placa}
                        </strong>
                        <small>
                          {eq.unidadeRevisao === "h" ? "Horímetro" : "KM"}
                        </small>
                      </div>
                      <span
                        className={`pnl__manut-val ${vencida ? "is-red" : "is-amber"}`}
                      >
                        {vencida
                          ? "Vencida"
                          : `${r.toLocaleString("pt-BR")} ${eq.unidadeRevisao}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="pnl__grid2">
        <section className="pnl__card">
          <header className="pnl__card-head">
            <h2>
              <HardHat size={14} /> Equipamentos por frente de trabalho
            </h2>
          </header>
          {m.porFrente.length === 0 ? (
            <p className="pnl__vazio">Sem equipamentos alocados.</p>
          ) : (
            <ul className="pnl__frentes">
              {m.porFrente.map((f) => (
                <li key={f.frente}>
                  <span>{f.frente}</span>
                  <strong>{f.qtd} equip.</strong>
                </li>
              ))}
            </ul>
          )}
          <h3 className="pnl__sub">Gastos mensais</h3>
          <div className="pnl__grafico-fill">
            <Suspense fallback={<div className="pnl__grafico-ph" />}>
              <GraficoBarras
                dados={m.gastos}
                formato={fmtKBRL}
                destacarUltimo
                altura="100%"
              />
            </Suspense>
          </div>
        </section>

        <section className="pnl__card">
          <header className="pnl__card-head">
            <h2>
              <BarChart3 size={14} /> Consumo combustível
            </h2>
          </header>
          {m.consumo.length === 0 ? (
            <p className="pnl__vazio">Sem dados de consumo.</p>
          ) : (
            <ul className="pnl__consumo">
              {m.consumo.map((c) => (
                <li key={c.tipo}>
                  <span className="pnl__consumo-lbl">{c.tipo}</span>
                  <span className="pnl__consumo-bar">
                    <span style={{ width: `${c.pct}%` }} />
                  </span>
                  <span className="pnl__consumo-pct">{c.pct}%</span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="pnl__sub">Abastecimentos / semana</h3>
          <div className="pnl__grafico-fill">
            <Suspense fallback={<div className="pnl__grafico-ph" />}>
              <GraficoBarras
                dados={m.semanas}
                formato={(v) => String(v)}
                destacarUltimo
                altura="100%"
              />
            </Suspense>
          </div>
        </section>
      </div>
    </div>
  );
}
