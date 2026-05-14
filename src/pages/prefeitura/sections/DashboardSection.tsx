import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "@firebase/firestore";
import { db } from "../../../lib/firebase/firebase";

interface DashboardSectionProps {
  prefeituraId: string;
}

function formatBRL(v: number): string {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function MaxBars({
  values,
  labels,
  alt,
  fmt,
}: {
  values: number[];
  labels: string[];
  alt?: boolean;
  fmt?: (v: number) => string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className="pf-bars-wrap">
      <div className="pf-bars">
        {values.map((v, i) => (
          <div
            key={i}
            className={`bar ${alt ? "alt" : ""}`}
            style={{ height: `${Math.max(8, (v / max) * 140)}px` }}
          >
            <span className="bar-label">{fmt ? fmt(v) : v}</span>
            <span className="bar-foot">{labels[i] ?? ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Retorna semana do mês (0-based) a partir de um timestamp em segundos
function semanaDoMes(seconds: number): number {
  const d = new Date(seconds * 1000);
  return Math.min(3, Math.floor((d.getDate() - 1) / 7));
}

const SEMANA_LABELS = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];

export function DashboardSection({ prefeituraId }: DashboardSectionProps) {
  const [ativos, setAtivos] = useState<number | null>(null);
  const [checklists, setChecklists] = useState<number | null>(null);
  const [manutencao, setManutencao] = useState<number | null>(null);
  const [custoAcumulado, setCustoAcumulado] = useState<number | null>(null);

  const [gastosReais, setGastosReais] = useState<number[]>([0, 0, 0, 0]);
  const [checklistSemanas, setChecklistSemanas] = useState<number[]>([
    0, 0, 0, 0,
  ]);
  const [topOficinas, setTopOficinas] = useState<
    { nome: string; total: number }[]
  >([]);
  const [tituloPeriodo, setTituloPeriodo] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!prefeituraId) return;

    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth(); // 0-based

    const meses = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ];
    setTituloPeriodo(`Mês atual: ${meses[mesAtual]} de ${anoAtual}`);

    try {
      const [equipSnap, checkDevSnap, registrosSnap, ordemSnap] =
        await Promise.all([
          getDocs(
            query(
              collection(db, "equipamentos"),
              where("prefeituraId", "==", prefeituraId),
            ),
          ),
          getDocs(
            query(
              collection(db, "checklistsDevolucao"),
              where("prefeituraId", "==", prefeituraId),
            ),
          ),
          getDocs(
            query(
              collection(db, "checklistsRegistros"),
              where("prefeituraId", "==", prefeituraId),
            ),
          ),
          getDocs(
            query(
              collection(db, "ordensServico"),
              where("prefeituraId", "==", prefeituraId),
              where("status", "==", "aprovado"),
            ),
          ),
        ]);

      setAtivos(equipSnap.size);
      setChecklists(checkDevSnap.size + registrosSnap.size);

      // IDs de ordens que já têm checklist de devolução
      const ordemIdsComChecklist = new Set(
        checkDevSnap.docs
          .map(
            (d) =>
              (d.data() as { ordemServicoId?: string | null }).ordemServicoId,
          )
          .filter(Boolean) as string[],
      );

      // Gastos por semana do mês atual
      const gastosSem = [0, 0, 0, 0];
      let custo = 0;
      let emManutencao = 0;
      for (const d of ordemSnap.docs) {
        const data = d.data() as {
          valorTotal?: number;
          criadoEm?: { seconds: number } | null;
        };
        const valor = data.valorTotal ?? 0;
        custo += valor;
        if (!ordemIdsComChecklist.has(d.id)) emManutencao++;
        if (data.criadoEm) {
          const ts = data.criadoEm.seconds;
          const docDate = new Date(ts * 1000);
          if (
            docDate.getFullYear() === anoAtual &&
            docDate.getMonth() === mesAtual
          ) {
            gastosSem[semanaDoMes(ts)] += valor;
          }
        }
      }
      setCustoAcumulado(custo);
      setManutencao(emManutencao);
      setGastosReais([...gastosSem]);

      // Checklists por semana: combina checklistsDevolucao + checklistsRegistros
      const ckSem = [0, 0, 0, 0];
      const rankMap = new Map<string, number>();

      for (const d of checkDevSnap.docs) {
        const data = d.data() as {
          criadoEm?: { seconds: number } | null;
          oficinaNome?: string;
        };
        const nome = data.oficinaNome ?? "Desconhecida";
        rankMap.set(nome, (rankMap.get(nome) ?? 0) + 1);
        if (data.criadoEm) {
          const ts = data.criadoEm.seconds;
          const docDate = new Date(ts * 1000);
          if (
            docDate.getFullYear() === anoAtual &&
            docDate.getMonth() === mesAtual
          ) {
            ckSem[semanaDoMes(ts)]++;
          }
        }
      }

      for (const d of registrosSnap.docs) {
        const data = d.data() as {
          dataHoraIso?: string;
          operador?: string;
        };
        // Parse "YYYY-MM-DD HH:MM" or ISO string
        if (data.dataHoraIso) {
          const docDate = new Date(data.dataHoraIso.replace(" ", "T"));
          if (
            !isNaN(docDate.getTime()) &&
            docDate.getFullYear() === anoAtual &&
            docDate.getMonth() === mesAtual
          ) {
            const dia = docDate.getDate();
            const sem = Math.min(3, Math.floor((dia - 1) / 7));
            ckSem[sem]++;
          }
        }
      }

      setChecklistSemanas([...ckSem]);

      const ranking = Array.from(rankMap.entries())
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      setTopOficinas(ranking);
    } catch {
      // silently fail
    }
  }, [prefeituraId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const custoLabel = useMemo(() => {
    if (custoAcumulado === null) return "—";
    return custoAcumulado >= 1000
      ? `R$ ${(custoAcumulado / 1000).toFixed(1)}k`
      : `R$ ${custoAcumulado.toFixed(0)}`;
  }, [custoAcumulado]);

  return (
    <>
      <h1>Dashboard Estratégica</h1>

      <div className="card-grid">
        <article className="card">
          <h3>Total de Ativos</h3>
          <p>{ativos ?? "—"}</p>
        </article>
        <article className="card">
          <h3>Checklists Recebidos</h3>
          <p>{checklists ?? "—"}</p>
        </article>
        <article className="card">
          <h3>Em Manutenção</h3>
          <p>{manutencao ?? "—"}</p>
        </article>
        <article className="card">
          <h3>Custo Acumulado</h3>
          <p>{custoLabel}</p>
        </article>
      </div>

      <p
        className="topbar-user"
        style={{ margin: "0 0 10px", fontSize: "0.82rem" }}
      >
        {tituloPeriodo}
      </p>
      <div className="dash-graficos-grid">
        <article className="card chart-wrap">
          <h3>Gastos com manutenção</h3>
          <p className="chart-sub">
            Orçamentos aprovados no mês (R$) por semana
          </p>
          <MaxBars
            values={gastosReais}
            labels={SEMANA_LABELS}
            fmt={formatBRL}
          />
        </article>
        <article className="card chart-wrap">
          <h3>Checklists recebidos</h3>
          <p className="chart-sub">Volume recebido no mês por semana</p>
          <MaxBars values={checklistSemanas} labels={SEMANA_LABELS} alt />
        </article>
        <article className="card chart-wrap wide">
          <h3>Top 5 oficinas — checklists enviados</h3>
          <p className="chart-sub">
            Ranking por quantidade de checklists de devolução recebidos
          </p>
          {topOficinas.length === 0 ? (
            <p style={{ color: "var(--text-gray)", fontSize: "0.88rem" }}>
              Nenhum checklist recebido ainda.
            </p>
          ) : (
            <ol className="pf-rank-list">
              {topOficinas.map((op, i) => (
                <li key={op.nome}>
                  <span>
                    <span className="rank-pos">{i + 1}.</span> {op.nome}
                  </span>
                  <span className="rank-vals">{op.total} checklist(s)</span>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
    </>
  );
}
