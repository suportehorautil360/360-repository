import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { PontoRegistro } from "./ponto-api";
import type { Escala } from "../../lib/api/escala";
import type { Abono } from "../../lib/api/abonos";
import { limparCpf } from "../../lib/funcionarios/cpf";
import {
  fmtMin,
  minutosPrevistos,
  minutosTrabalhados,
} from "../prefeitura/sections/horasPonto";
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
}: Props) {
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const minhasBatidas = useMemo(() => {
    const alvo = nome.trim().toLowerCase();
    if (!alvo) return [];
    return batidas.filter(
      (b) => (b.name ?? "").trim().toLowerCase() === alvo,
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

  return (
    <div className="esp">
      <header className="esp__topo">
        <button type="button" className="esp__voltar" onClick={onVoltar}>
          <ArrowLeft size={14} aria-hidden="true" />
          Voltar
        </button>
        <h2 className="esp__titulo">Espelho detalhado · {nome || "—"}</h2>
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
                return (
                  <tr key={dia} className={ehAbonado ? "esp__linha-abonada" : ""}>
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
    </div>
  );
}
