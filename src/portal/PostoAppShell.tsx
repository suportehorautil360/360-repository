import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "@firebase/firestore";
import { db } from "../lib/firebase/firebase";
import { usePostoPortal } from "./PostoPortalContext";
import {
  buildFaturamentoSnapshot,
  postoExportarFaturamentoCsvFromSnapshot,
  postoExportarFaturamentoPdfFromSnapshot,
} from "./postoPortalFaturamento";
import {
  computeAbsRowsSorted,
  computeDashboardKpis,
} from "./postoPortalCompute";
import { esc } from "./postoPortalFormat";
import { mesesOptions } from "./postoPortalHu360Data";
import { postoResolverSessaoPortal } from "./postoPortalLegacy";
import type { FatUltimoSnapshot } from "./postoPortalTypes";

const TAB_DASH = "posto-tab-dash";
const TAB_ABS = "posto-tab-abs";
const TAB_FAT = "posto-tab-fat";
const TAB_NOVO_ABS = "posto-tab-novo-abs";

function parseValorBR(v: string): number {
  if (!v) return 0;
  const limpo = v
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

//@ts-ignore
function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PostoAppShell() {
  const {
    refreshKey,
    activeTab,
    setActiveTab,
    usuarioLogadoLine,
    postoCtxPrefLine,
    logout,
  } = usePostoPortal();

  const mesAbsChoices = useMemo(() => mesesOptions(18), []);
  const fatMesChoices = useMemo(() => mesesOptions(24), []);
  const [mesAbs, setMesAbs] = useState(() => mesAbsChoices[0]?.value ?? "");
  const [fatMes, setFatMes] = useState(() => fatMesChoices[0]?.value ?? "");
  const [fatSecretaria, setFatSecretaria] = useState("__todas__");

  const portal = useMemo(() => postoResolverSessaoPortal(), [refreshKey]);

  // Novo Abastecimento form state
  const postoIdSessao =
    portal && "postoId" in portal && portal.postoId ? portal.postoId : "";
  const prefIdSessao =
    portal && "prefeituraId" in portal && portal.prefeituraId
      ? portal.prefeituraId
      : "";

  const [veiculosOptions, setVeiculosOptions] = useState<string[]>([]);
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("");
  const [novoVeic, setNovoVeic] = useState("");
  const [novoMotor, setNovoMotor] = useState("");
  const [novoSec, setNovoSec] = useState("Secretaria de Infraestrutura");
  const [novoComb, setNovoComb] = useState("Diesel S10");
  const [novoLitros, setNovoLitros] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [novoKm, setNovoKm] = useState("");
  const [novoCupom, setNovoCupom] = useState("");
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [msgNovoAbs, setMsgNovoAbs] = useState<{
    tone: "none" | "ok" | "err";
    text: string;
  }>({ tone: "none", text: "" });

  useEffect(() => {
    if (!prefIdSessao || activeTab !== TAB_NOVO_ABS) return;
    void (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "equipamentos"),
            where("prefeituraId", "==", prefIdSessao),
          ),
        );
        const veics = snap.docs
          .map((d) => {
            const dt = d.data();
            return [
              dt.label ?? dt.descricao ?? "",
              dt.marca ?? "",
              dt.modelo ?? "",
            ]
              .filter(Boolean)
              .join(" · ");
          })
          .filter(Boolean);
        setVeiculosOptions(Array.from(new Set(veics)));
      } catch {
        /* ignore */
      }
    })();
  }, [prefIdSessao, activeTab]);

  async function handleNovoAbastecimento() {
    setMsgNovoAbs({ tone: "none", text: "" });
    const litrosNum = Number(novoLitros);
    const valorNum = parseValorBR(novoValor);
    if (!novaData || !novoVeic || !novoMotor) {
      setMsgNovoAbs({
        tone: "err",
        text: "Preencha data, veículo e motorista.",
      });
      return;
    }
    if (!Number.isFinite(litrosNum) || litrosNum <= 0) {
      setMsgNovoAbs({ tone: "err", text: "Litros inválidos." });
      return;
    }
    if (valorNum <= 0) {
      setMsgNovoAbs({ tone: "err", text: "Valor inválido." });
      return;
    }
    setSalvandoNovo(true);
    try {
      await addDoc(collection(db, "abastecimentos"), {
        id: `abs-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`,
        prefeituraId: prefIdSessao,
        postoId: postoIdSessao,
        data: novaData,
        hora: novaHora,
        veiculo: novoVeic,
        placa: "",
        motorista: novoMotor,
        secretaria: novoSec,
        litros: litrosNum,
        valorTotal: novoValor,
        km: Number(novoKm) || 0,
        combustivel: novoComb,
        cupomFiscal: novoCupom,
        criadoEm: serverTimestamp(),
      });
      setMsgNovoAbs({
        tone: "ok",
        text: "Abastecimento registrado com sucesso.",
      });
      setNovaData("");
      setNovaHora("");
      setNovoVeic("");
      setNovoMotor("");
      setNovoLitros("");
      setNovoValor("");
      setNovoKm("");
      setNovoCupom("");
    } catch {
      setMsgNovoAbs({ tone: "err", text: "Erro ao salvar. Tente novamente." });
    } finally {
      setSalvandoNovo(false);
    }
  }

  const kpis = useMemo(
    () => computeDashboardKpis(portal),
    [portal, refreshKey],
  );

  const absRows = useMemo(
    () => computeAbsRowsSorted(portal, mesAbs || null),
    [portal, mesAbs, refreshKey],
  );

  const fatSnapshot = useMemo(() => {
    if (!portal || !fatMes) return null;
    const p = fatMes.split("-");
    const ano = parseInt(p[0], 10);
    const mes = parseInt(p[1], 10);
    return buildFaturamentoSnapshot(
      portal,
      ano,
      mes,
      fatSecretaria || "__todas__",
    );
  }, [portal, fatMes, fatSecretaria, refreshKey]);

  useEffect(() => {
    if (fatSnapshot) {
      window.__postoFatUltimoAgg = fatSnapshot;
    }
  }, [fatSnapshot]);

  const gerarFat = useCallback(() => {}, []);

  useEffect(() => {
    window.postoGerarRelatorioFaturamento = () => {
      gerarFat();
    };
    window.postoExportarFaturamentoCsv = () => {
      const u: FatUltimoSnapshot | undefined = window.__postoFatUltimoAgg;
      if (!u?.agg) return;
      postoExportarFaturamentoCsvFromSnapshot(u);
    };
    window.postoExportarFaturamentoPdf = () => {
      const u: FatUltimoSnapshot | undefined = window.__postoFatUltimoAgg;
      if (!u?.agg) return;
      postoExportarFaturamentoPdfFromSnapshot(u);
    };
    return () => {
      delete window.postoGerarRelatorioFaturamento;
      delete window.postoExportarFaturamentoCsv;
      delete window.postoExportarFaturamentoPdf;
    };
  }, [gerarFat]);

  return (
    <div id="appShell" className="posto-app">
      <aside className="posto-app__aside">
        <p id="usuarioLogado" className="posto-app__user">
          {usuarioLogadoLine}
        </p>
        <button
          type="button"
          className={
            "posto-nav-item" + (activeTab === TAB_DASH ? " active" : "")
          }
          onClick={() => setActiveTab(TAB_DASH)}
        >
          Painel
        </button>
        <button
          type="button"
          className={
            "posto-nav-item" + (activeTab === TAB_ABS ? " active" : "")
          }
          onClick={() => setActiveTab(TAB_ABS)}
        >
          Abastecimentos
        </button>
        <button
          type="button"
          className={
            "posto-nav-item" + (activeTab === TAB_FAT ? " active" : "")
          }
          onClick={() => setActiveTab(TAB_FAT)}
        >
          Faturamento
        </button>
        <button
          type="button"
          className={
            "posto-nav-item" + (activeTab === TAB_NOVO_ABS ? " active" : "")
          }
          onClick={() => setActiveTab(TAB_NOVO_ABS)}
        >
          Novo Abastecimento
        </button>
        <button
          type="button"
          className="posto-nav-item"
          style={{ marginTop: 16 }}
          onClick={() => logout()}
        >
          Sair
        </button>
      </aside>
      <main className="posto-app__main">
        <p id="posto-ctx-pref" className="posto-app__ctx">
          {postoCtxPrefLine}
        </p>

        {activeTab === TAB_DASH && (
          <section className="tab-content active" id={TAB_DASH}>
            <h2>Resumo</h2>
            <p id="posto-nome-banner" className="posto-banner">
              {kpis?.postoLabel ?? "—"}
            </p>
            <div className="posto-kpis">
              <div>
                Abastecimentos no mês:{" "}
                <strong id="posto-kpi-abs-mes">{kpis?.absMes ?? "—"}</strong>
              </div>
              <div>
                Litros no mês:{" "}
                <strong id="posto-kpi-litros-mes">
                  {kpis?.litrosMes ?? "—"}
                </strong>
              </div>
              <div>
                Valor no mês:{" "}
                <strong id="posto-kpi-valor-mes">
                  {kpis?.valorMes ?? "—"}
                </strong>
              </div>
              <div>
                Total de abastecimentos:{" "}
                <strong id="posto-kpi-total-geral">
                  {kpis != null ? kpis.totalGeralAbs : "—"}
                </strong>
              </div>
            </div>
          </section>
        )}

        {activeTab === TAB_ABS && (
          <section className="tab-content active" id={TAB_ABS}>
            <h2>Abastecimentos</h2>
            <label htmlFor="posto-sel-mes-abs">Mês</label>
            <select
              id="posto-sel-mes-abs"
              className="auth-select"
              value={mesAbs}
              onChange={(e) => setMesAbs(e.target.value)}
            >
              {mesAbsChoices.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <table className="posto-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Veículo</th>
                  <th>Motorista</th>
                  <th>Combustível</th>
                  <th>Litros</th>
                  <th>Valor</th>
                  <th>Cupom</th>
                </tr>
              </thead>
              <tbody id="posto-tbody-abs">
                {absRows.map((a, i) => (
                  <tr key={i}>
                    <td>
                      {esc(a.data)} {esc(a.hora || "")}
                    </td>
                    <td>{esc(a.veiculo)}</td>
                    <td>{esc(a.motorista || "—")}</td>
                    <td>{esc(a.combustivel || "—")}</td>
                    <td>{esc(a.litros != null ? a.litros : "—")}</td>
                    <td>{esc(a.valorTotal || "—")}</td>
                    <td>{esc(a.cupomFiscal || "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p
              id="posto-sem-abs"
              style={{ display: absRows.length ? "none" : "block" }}
            >
              Nenhum abastecimento no período.
            </p>
          </section>
        )}

        {activeTab === TAB_FAT && (
          <section className="tab-content active" id={TAB_FAT}>
            <h2>Faturamento</h2>
            <div className="posto-fat-toolbar">
              <div>
                <label htmlFor="posto-fat-mes">Mês</label>
                <select
                  id="posto-fat-mes"
                  className="auth-select"
                  value={fatMes}
                  onChange={(e) => setFatMes(e.target.value)}
                >
                  {fatMesChoices.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="posto-fat-secretaria">Secretaria</label>
                <select
                  id="posto-fat-secretaria"
                  className="auth-select"
                  value={fatSecretaria}
                  onChange={(e) => setFatSecretaria(e.target.value)}
                >
                  <option value="__todas__">Todas</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() =>
                  fatSnapshot &&
                  postoExportarFaturamentoCsvFromSnapshot(fatSnapshot)
                }
                disabled={!fatSnapshot}
              >
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  fatSnapshot &&
                  postoExportarFaturamentoPdfFromSnapshot(fatSnapshot)
                }
                disabled={!fatSnapshot}
              >
                Exportar PDF
              </button>
            </div>
            {fatSnapshot && (
              <>
                <div className="posto-kpis">
                  <div>
                    Litros:{" "}
                    <strong id="posto-fat-kpi-litros">
                      {fatSnapshot.agg.totalLitros.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      L
                    </strong>
                  </div>
                  <div>
                    Valor edital (R$/L):{" "}
                    <strong id="posto-fat-kpi-edital">
                      {fatSnapshot.agg.valorUnitarioEdital.toLocaleString(
                        "pt-BR",
                        { style: "currency", currency: "BRL" },
                      )}
                    </strong>
                  </div>
                  <div>
                    Total:{" "}
                    <strong id="posto-fat-kpi-total">
                      {fatSnapshot.agg.totalFaturar.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </strong>
                  </div>
                </div>
                <table className="posto-table">
                  <thead>
                    <tr>
                      <th>Equipamento</th>
                      <th>Qtd</th>
                      <th>Litros</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody id="posto-tbody-fat">
                    {fatSnapshot.agg.rows.map((r) => (
                      <tr key={r.equip}>
                        <td>{esc(r.equip)}</td>
                        <td>{r.qtd}</td>
                        <td>
                          {String(r.litros).replace(
                            /\B(?=(\d{3})+(?!\d))/g,
                            ".",
                          )}{" "}
                          L
                        </td>
                        <td>
                          <strong>
                            {r.valorFaturar.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p
                  id="posto-fat-sem-dados"
                  style={{
                    display: fatSnapshot.agg.rows.length ? "none" : "block",
                  }}
                >
                  Sem dados para o período.
                </p>
              </>
            )}
          </section>
        )}

        {activeTab === TAB_NOVO_ABS && (
          <section className="tab-content active" id={TAB_NOVO_ABS}>
            <h2>
              Novo abastecimento{" "}
              <span
                style={{
                  fontWeight: 400,
                  color: "var(--text-gray)",
                  fontSize: "0.9rem",
                }}
              >
                (consome crédito semanal)
              </span>
            </h2>
            <p
              style={{
                color: "var(--text-gray)",
                fontSize: "0.8rem",
                margin: "0 0 16px",
              }}
            >
              O valor do cupom será debitado do saldo do convênio. O posto
              registrado automaticamente é{" "}
              <strong>{postoIdSessao || "—"}</strong>.
            </p>
            <div className="grid">
              <div>
                <label htmlFor="ps-abs-data">Data</label>
                <input
                  type="date"
                  id="ps-abs-data"
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ps-abs-hora">Hora</label>
                <input
                  type="time"
                  id="ps-abs-hora"
                  value={novaHora}
                  onChange={(e) => setNovaHora(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ps-abs-sel-veiculo">
                  Veículo / equipamento
                </label>
                <select
                  id="ps-abs-sel-veiculo"
                  value={novoVeic}
                  onChange={(e) => setNovoVeic(e.target.value)}
                >
                  <option value="">— selecione —</option>
                  {veiculosOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ps-abs-motorista">Motorista</label>
                <input
                  type="text"
                  id="ps-abs-motorista"
                  placeholder="Nome completo"
                  value={novoMotor}
                  onChange={(e) => setNovoMotor(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ps-abs-secretaria">
                  Secretaria / departamento
                </label>
                <select
                  id="ps-abs-secretaria"
                  value={novoSec}
                  onChange={(e) => setNovoSec(e.target.value)}
                >
                  <option value="Secretaria de Infraestrutura">
                    Secretaria de Infraestrutura
                  </option>
                  <option value="Secretaria de Transportes">
                    Secretaria de Transportes
                  </option>
                  <option value="Secretaria de Administração">
                    Secretaria de Administração
                  </option>
                </select>
              </div>
              <div>
                <label htmlFor="ps-abs-combustivel">Combustível</label>
                <select
                  id="ps-abs-combustivel"
                  value={novoComb}
                  onChange={(e) => setNovoComb(e.target.value)}
                >
                  <option value="Diesel S10">Diesel S10</option>
                  <option value="Gasolina comum">Gasolina comum</option>
                  <option value="Etanol">Etanol</option>
                </select>
              </div>
              <div>
                <label htmlFor="ps-abs-litros">Litros</label>
                <input
                  type="number"
                  id="ps-abs-litros"
                  min={1}
                  step={1}
                  placeholder="120"
                  value={novoLitros}
                  onChange={(e) => setNovoLitros(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ps-abs-valor">Valor total (R$)</label>
                <input
                  type="text"
                  id="ps-abs-valor"
                  placeholder="850,00"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ps-abs-km">Km / horímetro</label>
                <input
                  type="number"
                  id="ps-abs-km"
                  min={0}
                  step={1}
                  placeholder="45210"
                  value={novoKm}
                  onChange={(e) => setNovoKm(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ps-abs-cupom">Cupom / NF</label>
                <input
                  type="text"
                  id="ps-abs-cupom"
                  placeholder="Número"
                  value={novoCupom}
                  onChange={(e) => setNovoCupom(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              className="btn btn-success"
              onClick={() => {
                void handleNovoAbastecimento();
              }}
              disabled={salvandoNovo}
              style={{ marginTop: 12 }}
            >
              {salvandoNovo ? "Salvando…" : "Registrar abastecimento"}
            </button>
            {msgNovoAbs.text && (
              <span
                style={{
                  marginLeft: 12,
                  fontSize: "0.88rem",
                  color:
                    msgNovoAbs.tone === "ok"
                      ? "#86efac"
                      : msgNovoAbs.tone === "err"
                        ? "#fca5a5"
                        : "var(--text-gray)",
                }}
              >
                {msgNovoAbs.text}
              </span>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
