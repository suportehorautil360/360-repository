import { useCallback, useState } from "react";
import { baixarCSV } from "@/lib/export/export-utils";
import {
  ACOES_OPCOES,
  clonarMatrizPadrao,
  clsAcao,
  matrizParaCsv,
  novaLinhaVazia,
  novoCiclo,
  sincronizarAcoesLinha,
  type AcaoMatriz,
  type CicloMatriz,
  type LinhaMatriz,
  type MatrizPreventiva,
} from "./plano-preventivo-model";
import "./plano-preventivo.css";

export function PlanoPreventivoSection({
  prefeituraId: _prefeituraId,
}: {
  prefeituraId: string;
}) {
  const [matriz, setMatriz] = useState<MatrizPreventiva>(clonarMatrizPadrao);

  const atualizarLinha = useCallback(
    (id: string, patch: Partial<LinhaMatriz>) => {
      setMatriz((m) => ({
        ...m,
        linhas: m.linhas.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }));
    },
    [],
  );

  const atualizarAcao = useCallback(
    (linhaId: string, cicloId: string, acao: AcaoMatriz) => {
      setMatriz((m) => ({
        ...m,
        linhas: m.linhas.map((l) =>
          l.id === linhaId
            ? { ...l, acoes: { ...l.acoes, [cicloId]: acao } }
            : l,
        ),
      }));
    },
    [],
  );

  function atualizarCiclo(cicloId: string, titulo: string) {
    setMatriz((m) => ({
      ...m,
      ciclos: m.ciclos.map((c) =>
        c.id === cicloId ? { ...c, titulo } : c,
      ),
    }));
  }

  function adicionarCiclo() {
    setMatriz((m) => {
      const ultimo = m.ciclos[m.ciclos.length - 1];
      const ciclo = novoCiclo(m.ciclos.length + 1, ultimo);
      return {
        ciclos: [...m.ciclos, ciclo],
        linhas: m.linhas.map((l) => sincronizarAcoesLinha(l, [...m.ciclos, ciclo])),
      };
    });
  }

  function removerCiclo(cicloId: string) {
    setMatriz((m) => {
      if (m.ciclos.length <= 1) return m;
      const ciclos = m.ciclos.filter((c) => c.id !== cicloId);
      return {
        ciclos,
        linhas: m.linhas.map((l) => sincronizarAcoesLinha(l, ciclos)),
      };
    });
  }

  function adicionarLinha() {
    setMatriz((m) => ({
      ...m,
      linhas: [novaLinhaVazia(m.ciclos), ...m.linhas],
    }));
  }

  function removerLinha(linhaId: string) {
    setMatriz((m) => ({
      ...m,
      linhas: m.linhas.filter((l) => l.id !== linhaId),
    }));
  }

  function restaurarPadrao() {
    setMatriz(clonarMatrizPadrao());
  }

  function exportarCsv() {
    baixarCSV("matriz-manutencao-preventiva", matrizParaCsv(matriz));
  }

  return (
    <section className="pp-page">
      <div className="pp-wrap">
        <div className="pp-head">
          <div>
            <h1 className="pp-title">
              Matriz de manutenção preventiva — multimarcas
            </h1>
            <p className="pp-subtitle">
              Defina a ação de cada item por ciclo. Tudo editável — clique numa
              célula para alterar, adicione ou remova linhas e ciclos.
            </p>
          </div>
          <div className="pp-head__actions">
            <button
              type="button"
              className="pp-btn pp-btn--blue"
              onClick={adicionarCiclo}
            >
              + Ciclo
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--blue"
              onClick={adicionarLinha}
            >
              + Linha
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--green"
              onClick={exportarCsv}
            >
              ↓ CSV
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--ghost"
              onClick={restaurarPadrao}
            >
              ⟳ Restaurar padrão
            </button>
          </div>
        </div>

        <div className="pp-table-scroll">
          <table className="pp-table">
            <thead>
              <tr>
                <th className="pp-col-del" aria-label="Remover linha" />
                <th>Categoria</th>
                <th>Item / componente</th>
                <th>Especificação / tipo</th>
                {matriz.ciclos.map((c) => (
                  <th key={c.id} className="pp-col-ciclo">
                    <input
                      type="text"
                      className="pp-ciclo-titulo"
                      value={c.titulo}
                      onChange={(e) => atualizarCiclo(c.id, e.target.value)}
                      aria-label="Título do ciclo"
                    />
                    {matriz.ciclos.length > 1 ? (
                      <button
                        type="button"
                        className="pp-del-ciclo"
                        onClick={() => removerCiclo(c.id)}
                        title="Remover ciclo"
                        aria-label={`Remover ${c.titulo}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matriz.linhas.map((row) => (
                <LinhaTabela
                  key={row.id}
                  row={row}
                  ciclos={matriz.ciclos}
                  onRemover={() => removerLinha(row.id)}
                  onAtualizarLinha={atualizarLinha}
                  onAtualizarAcao={atualizarAcao}
                />
              ))}
            </tbody>
          </table>
        </div>

        <footer className="pp-legenda">
          <strong>Legenda de ações:</strong>
          {ACOES_OPCOES.map((a) => (
            <span key={a.value} className={`pp-legenda__item ${a.cls}`}>
              {a.label}
            </span>
          ))}
          <span className="pp-legenda__dica">
            — clique numa célula de ciclo para escolher a ação.
          </span>
        </footer>
      </div>
    </section>
  );
}

function LinhaTabela({
  row,
  ciclos,
  onRemover,
  onAtualizarLinha,
  onAtualizarAcao,
}: {
  row: LinhaMatriz;
  ciclos: CicloMatriz[];
  onRemover: () => void;
  onAtualizarLinha: (id: string, patch: Partial<LinhaMatriz>) => void;
  onAtualizarAcao: (linhaId: string, cicloId: string, acao: AcaoMatriz) => void;
}) {
  return (
    <tr>
      <td className="pp-col-del">
        <button
          type="button"
          className="pp-del-linha"
          onClick={onRemover}
          title="Remover linha"
          aria-label="Remover linha"
        >
          ×
        </button>
      </td>
      <td>
        <input
          className="pp-cell-input"
          value={row.categoria}
          onChange={(e) =>
            onAtualizarLinha(row.id, { categoria: e.target.value })
          }
        />
      </td>
      <td>
        <input
          className="pp-cell-input"
          value={row.item}
          onChange={(e) => onAtualizarLinha(row.id, { item: e.target.value })}
        />
      </td>
      <td>
        <input
          className="pp-cell-input pp-cell-input--wide"
          value={row.especificacao}
          onChange={(e) =>
            onAtualizarLinha(row.id, { especificacao: e.target.value })
          }
        />
      </td>
      {ciclos.map((c) => {
        const acao = row.acoes[c.id] ?? "na";
        return (
          <td key={c.id} className="pp-col-acao">
            <select
              className={`pp-acao-select ${clsAcao(acao)}`}
              value={acao}
              onChange={(e) =>
                onAtualizarAcao(row.id, c.id, e.target.value as AcaoMatriz)
              }
              aria-label={`Ação para ${row.item}`}
            >
              {ACOES_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </td>
        );
      })}
    </tr>
  );
}
