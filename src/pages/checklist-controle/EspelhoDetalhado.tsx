import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { PontoRegistro } from "./ponto-api";
import type { Escala } from "../../lib/api/escala";
import type { Abono } from "../../lib/api/abonos";
import { formatarCpf, limparCpf } from "../../lib/funcionarios/cpf";
import {
  fmtMin,
  minutosPrevistos,
  minutosTrabalhados,
} from "../prefeitura/sections/horasPonto";
import { baixarPDFTabela } from "../../lib/export/pdf-tabela";
import {
  ESPELHO_COLUNAS,
  ESPELHO_PESOS,
  abonosNoPeriodo,
  construirEspelho,
  dataBr,
  diasNoIntervalo,
  diasNoPeriodo,
  intervaloPreset,
  type PeriodoPreset,
} from "./espelho-export";
import { Download } from "lucide-react";
import "./espelho.css";

interface Props {
  batidas: PontoRegistro[];
  escala: Escala | null;
  nome: string;
  /** Abonos da prefeitura — filtramos pelo CPF abaixo. */
  abonos?: Abono[];
  /** CPF do funcionário (necessário pra casar com abonos). */
  funcionarioCpf?: string;
  onVoltar: () => void;
  /** Quando definido (contexto RH), as linhas viram clicáveis (abrir o dia). */
  onSelecionarDia?: (dia: string, batidas: PontoRegistro[]) => void;
  /** Dias (YYYY-MM-DD) com pendências a revisar — marca um badge na linha. */
  diasComPendencia?: Set<string>;
}

function diaLocal(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rotuloMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export function EspelhoDetalhado({
  batidas,
  escala,
  nome,
  abonos,
  funcionarioCpf,
  onVoltar,
  onSelecionarDia,
  diasComPendencia,
}: Props) {
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Modal de exportação por período (intervalo de datas).
  const [expAberto, setExpAberto] = useState(false);
  const [expDe, setExpDe] = useState("");
  const [expAte, setExpAte] = useState("");

  const presetsRange = useMemo(() => {
    const hoje = new Date();
    return (
      [
        { key: "hoje", label: "Hoje" },
        { key: "semana", label: "Esta semana" },
        { key: "mes", label: "Este mês" },
        { key: "mes-anterior", label: "Mês anterior" },
      ] as { key: PeriodoPreset; label: string }[]
    ).map((p) => ({ ...p, ...intervaloPreset(p.key, hoje) }));
  }, []);

  const minhasBatidas = useMemo(() => {
    const alvo = nome.trim().toLowerCase();
    if (!alvo) return [];
    // Ignora batidas canceladas (vieram de aprovação de solicitação tipo=cancelar).
    return batidas.filter(
      (b) =>
        b.status !== "cancelado" &&
        (b.name ?? "").trim().toLowerCase() === alvo,
    );
  }, [batidas, nome]);

  /** Datas (YYYY-MM-DD) abonadas pra este funcionário, indexadas. */
  const abonosDoMes = useMemo(() => {
    const cpf = limparCpf(funcionarioCpf ?? "");
    if (!cpf || !abonos?.length) return new Map<string, string | null | undefined>();
    const out = new Map<string, string | null | undefined>();
    for (const a of abonos) {
      if (limparCpf(a.funcionarioCpf) !== cpf) continue;
      if (!a.data.startsWith(mes)) continue;
      out.set(a.data, a.motivo);
    }
    return out;
  }, [abonos, funcionarioCpf, mes]);

  /**
   * Lista de [dia, batidas, abonado?, motivoAbono?] pra cada dia com
   * registro OU abono no mês selecionado.
   */
  const diasMes = useMemo(() => {
    const map = new Map<string, PontoRegistro[]>();
    for (const b of minhasBatidas) {
      const dia = diaLocal(b.timestampOriginal);
      if (!dia.startsWith(mes)) continue;
      const arr = map.get(dia) ?? [];
      arr.push(b);
      map.set(dia, arr);
    }
    // Inclui dias que não têm batida, mas têm abono — só assim aparecem.
    for (const data of abonosDoMes.keys()) {
      if (!map.has(data)) map.set(data, []);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [minhasBatidas, abonosDoMes, mes]);

  const totais = useMemo(() => {
    let trab = 0;
    let prev = 0;
    for (const [dia, bs] of diasMes) {
      const trabBruto = minutosTrabalhados(bs, escala?.almocoMinutos ?? 0);
      const previsto = minutosPrevistos(escala, dia);
      // Dia abonado (sem batidas, mas com abono): considera as previstas
      // como cumpridas — saldo do dia fica neutro.
      const abonado = bs.length === 0 && abonosDoMes.has(dia);
      trab += abonado ? previsto : trabBruto;
      prev += previsto;
    }
    return { trab, prev, saldo: trab - prev };
  }, [diasMes, escala, abonosDoMes]);

  function mudarMes(delta: number) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMes(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }

  function abrirExport() {
    const [y, m] = mes.split("-").map(Number);
    const ultimo = new Date(y, m, 0).getDate();
    setExpDe(`${mes}-01`);
    setExpAte(`${mes}-${String(ultimo).padStart(2, "0")}`);
    setExpAberto(true);
  }

  function gerarExport() {
    const de = expDe;
    const ate = expAte;
    if (!de || !ate || de > ate) return;
    const abonosDias = abonosNoPeriodo(abonos, funcionarioCpf, de, ate);
    const dias = diasNoPeriodo(minhasBatidas, abonosDias, de, ate);
    const { linhas, totais: totaisLinha } = construirEspelho(
      dias,
      abonosDias,
      escala,
    );
    const subtitulo = [
      funcionarioCpf ? `CPF ${formatarCpf(funcionarioCpf)}` : null,
      `Período: ${dataBr(de)} a ${dataBr(ate)}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const arquivo = `espelho-${(nome || "funcionario")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")}-${de}_a_${ate}`;
    baixarPDFTabela(arquivo, {
      titulo: `Espelho de ponto — ${nome || "—"}`,
      subtitulo,
      colunas: ESPELHO_COLUNAS,
      linhas,
      totais: totaisLinha,
      pesos: ESPELHO_PESOS,
    });
    setExpAberto(false);
  }

  return (
    <div className="esp">
      <header className="esp__topo">
        <button type="button" className="esp__voltar" onClick={onVoltar}>
          <ArrowLeft size={14} aria-hidden="true" />
          Voltar
        </button>
        <h2 className="esp__titulo">Espelho detalhado · {nome || "—"}</h2>
        <button
          type="button"
          className="esp__exportar"
          onClick={abrirExport}
        >
          <Download size={14} aria-hidden="true" />
          Exportar PDF
        </button>
      </header>

      <section className="esp__mes-bar">
        <button
          type="button"
          className="esp__mes-btn"
          aria-label="Mês anterior"
          onClick={() => mudarMes(-1)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <strong className="esp__mes-label">{rotuloMes(mes)}</strong>
        <button
          type="button"
          className="esp__mes-btn"
          aria-label="Próximo mês"
          onClick={() => mudarMes(1)}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </section>

      <section className="esp__totais">
        <div>
          <span>Trabalhado</span>
          <strong>{fmtMin(totais.trab)}</strong>
        </div>
        <div>
          <span>Previsto</span>
          <strong>{fmtMin(totais.prev)}</strong>
        </div>
        <div>
          <span>Saldo</span>
          <strong
            className={totais.saldo < 0 ? "is-neg" : "is-pos"}
          >
            {totais.saldo >= 0 ? "+" : ""}
            {fmtMin(totais.saldo)}
          </strong>
        </div>
      </section>

      <div className="esp__tabela-wrap">
        <table className="esp__tabela">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Entrada</th>
              <th>Almoço</th>
              <th>Volta</th>
              <th>Saída</th>
              <th>Trab.</th>
              <th>Prev.</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {diasMes.length === 0 ? (
              <tr>
                <td colSpan={8} className="esp__vazio">
                  Sem batidas registradas neste mês.
                </td>
              </tr>
            ) : (
              diasMes.map(([dia, bs]) => {
                const tipos: Record<string, string> = {};
                for (const b of bs) tipos[b.tipo] = horaDe(b.timestampOriginal);
                const trabBruto = minutosTrabalhados(
                  bs,
                  escala?.almocoMinutos ?? 0,
                );
                const prev = minutosPrevistos(escala, dia);
                const ehAbonado = bs.length === 0 && abonosDoMes.has(dia);
                const trab = ehAbonado ? prev : trabBruto;
                const saldo = trab - prev;
                const clicavel = !!onSelecionarDia;
                const temPendencia = diasComPendencia?.has(dia) ?? false;
                return (
                  <tr
                    key={dia}
                    className={`${ehAbonado ? "esp__linha-abonada" : ""}${
                      clicavel ? " esp__linha-click" : ""
                    }`}
                    onClick={
                      clicavel ? () => onSelecionarDia(dia, bs) : undefined
                    }
                    title={clicavel ? "Abrir detalhes do dia" : undefined}
                  >
                    <td>
                      {dia.split("-").reverse().join("/")}
                      {ehAbonado && (
                        <span
                          className="esp__chip-abono"
                          title={abonosDoMes.get(dia) ?? "Abono aprovado"}
                        >
                          Abonado
                        </span>
                      )}
                      {temPendencia && (
                        <span className="esp__chip-pendente" title="Pendências a revisar">
                          Pendências
                        </span>
                      )}
                    </td>
                    <td>{tipos.entrada ?? "—"}</td>
                    <td>{tipos.almoco ?? "—"}</td>
                    <td>{tipos.volta ?? "—"}</td>
                    <td>{tipos.saida ?? "—"}</td>
                    <td>{fmtMin(trab)}</td>
                    <td>{fmtMin(prev)}</td>
                    <td className={saldo < 0 ? "is-neg" : "is-pos"}>
                      {saldo >= 0 ? "+" : ""}
                      {fmtMin(saldo)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {expAberto &&
        (() => {
          const presetAtivo =
            presetsRange.find((p) => p.de === expDe && p.ate === expAte)?.key ??
            null;
          const totalDias = diasNoIntervalo(expDe, expAte);
          return (
            <div
              className="esp__modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Exportar espelho em PDF"
              onClick={() => setExpAberto(false)}
            >
              <div className="esp__modal" onClick={(e) => e.stopPropagation()}>
                <h3 className="esp__modal-titulo">Exportar PDF</h3>
                <p className="esp__modal-sub">
                  Escolha um atalho ou um período personalizado.
                </p>

                <div className="esp__chips">
                  {presetsRange.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className={`esp__chip${
                        presetAtivo === p.key ? " is-active" : ""
                      }`}
                      onClick={() => {
                        setExpDe(p.de);
                        setExpAte(p.ate);
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="esp__modal-campos">
                  <label className="esp__modal-campo">
                    <span>De</span>
                    <input
                      type="date"
                      value={expDe}
                      max={expAte || undefined}
                      onChange={(e) => setExpDe(e.target.value)}
                    />
                  </label>
                  <label className="esp__modal-campo">
                    <span>Até</span>
                    <input
                      type="date"
                      value={expAte}
                      min={expDe || undefined}
                      onChange={(e) => setExpAte(e.target.value)}
                    />
                  </label>
                </div>

                <p className="esp__modal-resumo">
                  {totalDias > 0
                    ? `${dataBr(expDe)} a ${dataBr(expAte)} · ${totalDias} ${
                        totalDias === 1 ? "dia" : "dias"
                      }`
                    : "Selecione um período válido."}
                </p>

                <div className="esp__modal-acoes">
                  <button
                    type="button"
                    className="esp__modal-cancelar"
                    onClick={() => setExpAberto(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="esp__exportar"
                    onClick={gerarExport}
                    disabled={totalDias === 0}
                  >
                    <Download size={14} aria-hidden="true" />
                    Gerar PDF
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
