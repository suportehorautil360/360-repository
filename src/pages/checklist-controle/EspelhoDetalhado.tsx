import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { PontoRegistro } from "./ponto-api";
import type { Escala } from "../../lib/api/escala";
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

export function EspelhoDetalhado({ batidas, escala, nome, onVoltar }: Props) {
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

  const diasMes = useMemo(() => {
    const map = new Map<string, PontoRegistro[]>();
    for (const b of minhasBatidas) {
      const dia = diaLocal(b.timestampOriginal);
      if (!dia.startsWith(mes)) continue;
      const arr = map.get(dia) ?? [];
      arr.push(b);
      map.set(dia, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [minhasBatidas, mes]);

  const totais = useMemo(() => {
    let trab = 0;
    let prev = 0;
    for (const [dia, bs] of diasMes) {
      trab += minutosTrabalhados(bs, escala?.almocoMinutos ?? 0);
      prev += minutosPrevistos(escala, dia);
    }
    return { trab, prev, saldo: trab - prev };
  }, [diasMes, escala]);

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
                const trab = minutosTrabalhados(bs, escala?.almocoMinutos ?? 0);
                const prev = minutosPrevistos(escala, dia);
                const saldo = trab - prev;
                return (
                  <tr key={dia}>
                    <td>{dia.split("-").reverse().join("/")}</td>
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
