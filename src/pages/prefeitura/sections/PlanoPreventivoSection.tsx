import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { baixarCSV } from "@/lib/export/export-utils";
import { planosPreventivosApi } from "@/lib/api/planos-preventivos";
import {
  ACOES_OPCOES,
  adicionarCategoria,
  atualizarCategoriaMatriz,
  clonarPlanoPadrao,
  clsAcao,
  matrizParaCsv,
  novaLinhaVazia,
  novoCiclo,
  removerCategoria,
  renomearCategoria,
  sincronizarAcoesLinha,
  type AcaoMatriz,
  type CategoriaPlano,
  type CicloMatriz,
  type LinhaMatriz,
  type PlanoPreventivo,
} from "./plano-preventivo-model";
import "./plano-preventivo.css";

export function PlanoPreventivoSection({
  prefeituraId,
}: {
  prefeituraId: string;
}) {
  const [plano, setPlano] = useState<PlanoPreventivo>(clonarPlanoPadrao);
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modalCategoria, setModalCategoria] = useState<
    null | { modo: "criar" } | { modo: "editar"; categoria: CategoriaPlano }
  >(null);

  useEffect(() => {
    if (!prefeituraId) {
      const padrao = clonarPlanoPadrao();
      setPlano(padrao);
      setCategoriaId(padrao.categorias[0]?.id ?? "");
      setLoading(false);
      return;
    }

    let vivo = true;
    setLoading(true);
    setErro(null);

    void planosPreventivosApi
      .obter(prefeituraId)
      .then((salva) => {
        if (!vivo) return;
        const p = salva ?? clonarPlanoPadrao();
        setPlano(p);
        setCategoriaId((atual) =>
          p.categorias.some((c) => c.id === atual)
            ? atual
            : (p.categorias[0]?.id ?? ""),
        );
      })
      .catch((e) => {
        if (!vivo) return;
        const p = clonarPlanoPadrao();
        setPlano(p);
        setCategoriaId(p.categorias[0]?.id ?? "");
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar o plano preventivo.",
        );
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });

    return () => {
      vivo = false;
    };
  }, [prefeituraId]);

  const categoriaAtiva = useMemo(
    () => plano.categorias.find((c) => c.id === categoriaId) ?? null,
    [plano.categorias, categoriaId],
  );

  const patchCategoriaAtiva = useCallback(
    (fn: (cat: CategoriaPlano) => CategoriaPlano) => {
      setPlano((p) => {
        const cat = p.categorias.find((c) => c.id === categoriaId);
        if (!cat) return p;
        const next = fn(cat);
        return atualizarCategoriaMatriz(p, categoriaId, {
          ciclos: next.ciclos,
          linhas: next.linhas,
        });
      });
    },
    [categoriaId],
  );

  const atualizarLinha = useCallback(
    (id: string, patch: Partial<LinhaMatriz>) => {
      patchCategoriaAtiva((cat) => ({
        ...cat,
        linhas: cat.linhas.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }));
    },
    [patchCategoriaAtiva],
  );

  const atualizarAcao = useCallback(
    (linhaId: string, cicloId: string, acao: AcaoMatriz) => {
      patchCategoriaAtiva((cat) => ({
        ...cat,
        linhas: cat.linhas.map((l) =>
          l.id === linhaId
            ? { ...l, acoes: { ...l.acoes, [cicloId]: acao } }
            : l,
        ),
      }));
    },
    [patchCategoriaAtiva],
  );

  function atualizarCiclo(cicloId: string, titulo: string) {
    patchCategoriaAtiva((cat) => ({
      ...cat,
      ciclos: cat.ciclos.map((c) =>
        c.id === cicloId ? { ...c, titulo } : c,
      ),
    }));
  }

  function adicionarCiclo() {
    patchCategoriaAtiva((cat) => {
      const ultimo = cat.ciclos[cat.ciclos.length - 1];
      const ciclo = novoCiclo(cat.ciclos.length + 1, ultimo);
      const ciclos = [...cat.ciclos, ciclo];
      return {
        ...cat,
        ciclos,
        linhas: cat.linhas.map((l) => sincronizarAcoesLinha(l, ciclos)),
      };
    });
  }

  function removerCiclo(cicloId: string) {
    patchCategoriaAtiva((cat) => {
      if (cat.ciclos.length <= 1) return cat;
      const ciclos = cat.ciclos.filter((c) => c.id !== cicloId);
      return {
        ...cat,
        ciclos,
        linhas: cat.linhas.map((l) => sincronizarAcoesLinha(l, ciclos)),
      };
    });
  }

  function adicionarLinha() {
    patchCategoriaAtiva((cat) => ({
      ...cat,
      linhas: [novaLinhaVazia(cat.ciclos), ...cat.linhas],
    }));
  }

  function removerLinha(linhaId: string) {
    patchCategoriaAtiva((cat) => ({
      ...cat,
      linhas: cat.linhas.filter((l) => l.id !== linhaId),
    }));
  }

  function salvarCategoriaModal(nome: string) {
    const n = nome.trim();
    if (!n) {
      toast.error("Informe o nome da categoria.");
      return;
    }

    if (modalCategoria?.modo === "editar") {
      const id = modalCategoria.categoria.id;
      const conflito = plano.categorias.some(
        (c) =>
          c.id !== id &&
          c.nome.toLocaleLowerCase("pt-BR") === n.toLocaleLowerCase("pt-BR"),
      );
      if (conflito) {
        toast.error("Já existe uma categoria com esse nome.");
        return;
      }
      setPlano((p) => renomearCategoria(p, id, n));
      toast.success("Categoria atualizada.");
    } else {
      const next = adicionarCategoria(plano, n);
      if (!next) {
        toast.error("Já existe uma categoria com esse nome.");
        return;
      }
      const nova = next.categorias[next.categorias.length - 1];
      setPlano(next);
      if (nova) setCategoriaId(nova.id);
      toast.success("Categoria criada com matriz vazia.");
    }
    setModalCategoria(null);
  }

  function excluirCategoriaAtual() {
    if (!categoriaAtiva) return;
    if (plano.categorias.length <= 1) {
      toast.error("É necessário manter ao menos uma categoria.");
      return;
    }
    const nLinhas = categoriaAtiva.linhas.length;
    if (
      !window.confirm(
        `Excluir a categoria "${categoriaAtiva.nome}" e toda a matriz dela${
          nLinhas > 0 ? ` (${nLinhas} item${nLinhas === 1 ? "" : "s"})` : ""
        }?`,
      )
    ) {
      return;
    }
    const next = removerCategoria(plano, categoriaAtiva.id);
    if (!next) {
      toast.error("Não foi possível excluir a categoria.");
      return;
    }
    setPlano(next);
    setCategoriaId(next.categorias[0]?.id ?? "");
    toast.success("Categoria e matriz excluídas.");
  }

  async function salvarAlteracoes() {
    if (!prefeituraId) {
      toast.error("Município não identificado.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const salva = await planosPreventivosApi.salvar(prefeituraId, plano);
      setPlano(salva);
      setCategoriaId((atual) =>
        salva.categorias.some((c) => c.id === atual)
          ? atual
          : (salva.categorias[0]?.id ?? ""),
      );
      toast.success("Plano preventivo salvo.");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Não foi possível salvar o plano.";
      setErro(msg);
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  }

  async function restaurarPadrao() {
    if (!prefeituraId) {
      const p = clonarPlanoPadrao();
      setPlano(p);
      setCategoriaId(p.categorias[0]?.id ?? "");
      return;
    }
    if (
      !window.confirm(
        "Restaurar o plano padrão? As alterações não salvas serão perdidas.",
      )
    ) {
      return;
    }
    setRestaurando(true);
    setErro(null);
    try {
      const padrao = await planosPreventivosApi.restaurarPadrao(prefeituraId);
      setPlano(padrao);
      setCategoriaId(padrao.categorias[0]?.id ?? "");
      toast.success("Plano padrão restaurado.");
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Não foi possível restaurar o padrão.";
      setErro(msg);
      toast.error(msg);
    } finally {
      setRestaurando(false);
    }
  }

  function exportarCsv() {
    if (!categoriaAtiva) {
      toast.error("Selecione uma categoria.");
      return;
    }
    baixarCSV(
      `matriz-preventiva-${categoriaAtiva.nome}`,
      matrizParaCsv(categoriaAtiva),
    );
  }

  const busy = loading || salvando || restaurando;

  return (
    <section className="pp-page">
      <div className="pp-wrap">
        <div className="pp-head">
          <div>
            <h1 className="pp-title">
              Matriz de manutenção preventiva — por categoria
            </h1>
            <p className="pp-subtitle">
              Cada categoria tem a própria matriz (ciclos × itens). Crie
              categorias e configure a matriz de cada uma.
            </p>
            {erro ? (
              <p className="pp-erro" role="alert">
                {erro}
              </p>
            ) : null}
          </div>
          <div className="pp-head__actions">
            <button
              type="button"
              className="pp-btn pp-btn--green"
              onClick={() => void salvarAlteracoes()}
              disabled={busy || !prefeituraId}
            >
              {salvando ? "Salvando…" : "Salvar alterações"}
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--blue"
              onClick={() => setModalCategoria({ modo: "criar" })}
              disabled={busy}
            >
              + Categoria
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--blue"
              onClick={adicionarCiclo}
              disabled={busy || !categoriaAtiva}
            >
              + Ciclo
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--blue"
              onClick={adicionarLinha}
              disabled={busy || !categoriaAtiva}
            >
              + Linha
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--green"
              onClick={exportarCsv}
              disabled={busy || !categoriaAtiva}
            >
              ↓ CSV
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--ghost"
              onClick={() => void restaurarPadrao()}
              disabled={busy || !prefeituraId}
            >
              {restaurando ? "Restaurando…" : "⟳ Restaurar padrão"}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="pp-loading">Carregando plano preventivo…</p>
        ) : (
          <>
            <div className="pp-cat-bar">
              <div
                className="pp-tabs pp-tabs--cats"
                role="tablist"
                aria-label="Categorias do plano"
              >
                {plano.categorias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={c.id === categoriaId}
                    className={`pp-tab${c.id === categoriaId ? " pp-tab--active" : ""}`}
                    onClick={() => setCategoriaId(c.id)}
                  >
                    {c.nome}
                    <span className="pp-tab__meta">
                      {c.linhas.length} it.
                    </span>
                  </button>
                ))}
              </div>
              {categoriaAtiva ? (
                <div className="pp-cat-bar__acoes">
                  <button
                    type="button"
                    className="pp-btn pp-btn--ghost"
                    onClick={() =>
                      setModalCategoria({
                        modo: "editar",
                        categoria: categoriaAtiva,
                      })
                    }
                    disabled={busy}
                  >
                    Renomear
                  </button>
                  <button
                    type="button"
                    className="pp-btn pp-btn--danger"
                    onClick={excluirCategoriaAtual}
                    disabled={busy || plano.categorias.length <= 1}
                  >
                    Excluir categoria
                  </button>
                </div>
              ) : null}
            </div>

            {!categoriaAtiva ? (
              <p className="pp-loading">
                Nenhuma categoria. Crie uma para começar a matriz.
              </p>
            ) : (
              <>
                <p className="pp-cat-ativa">
                  Matriz da categoria <strong>{categoriaAtiva.nome}</strong>
                </p>
                <div className="pp-table-scroll">
                  <table className="pp-table">
                    <thead>
                      <tr>
                        <th className="pp-col-del" aria-label="Remover linha" />
                        <th>Item / componente</th>
                        <th>Especificação / tipo</th>
                        {categoriaAtiva.ciclos.map((c) => (
                          <th key={c.id} className="pp-col-ciclo">
                            <input
                              type="text"
                              className="pp-ciclo-titulo"
                              value={c.titulo}
                              onChange={(e) =>
                                atualizarCiclo(c.id, e.target.value)
                              }
                              aria-label="Título do ciclo"
                              disabled={busy}
                            />
                            {categoriaAtiva.ciclos.length > 1 ? (
                              <button
                                type="button"
                                className="pp-del-ciclo"
                                onClick={() => removerCiclo(c.id)}
                                title="Remover ciclo"
                                aria-label={`Remover ${c.titulo}`}
                                disabled={busy}
                              >
                                ×
                              </button>
                            ) : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {categoriaAtiva.linhas.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2 + categoriaAtiva.ciclos.length}
                            className="pp-empty-row"
                          >
                            Matriz vazia — use + Linha para adicionar itens.
                          </td>
                        </tr>
                      ) : (
                        categoriaAtiva.linhas.map((row) => (
                          <LinhaTabela
                            key={row.id}
                            row={row}
                            ciclos={categoriaAtiva.ciclos}
                            disabled={busy}
                            onRemover={() => removerLinha(row.id)}
                            onAtualizarLinha={atualizarLinha}
                            onAtualizarAcao={atualizarAcao}
                          />
                        ))
                      )}
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
              </>
            )}
          </>
        )}
      </div>

      {modalCategoria ? (
        <CategoriaModal
          titulo={
            modalCategoria.modo === "editar"
              ? "Renomear categoria"
              : "Nova categoria"
          }
          nomeInicial={
            modalCategoria.modo === "editar"
              ? modalCategoria.categoria.nome
              : ""
          }
          onFechar={() => setModalCategoria(null)}
          onSalvar={salvarCategoriaModal}
        />
      ) : null}
    </section>
  );
}

function CategoriaModal({
  titulo,
  nomeInicial,
  onFechar,
  onSalvar,
}: {
  titulo: string;
  nomeInicial: string;
  onFechar: () => void;
  onSalvar: (nome: string) => void;
}) {
  const [nome, setNome] = useState(nomeInicial);

  return (
    <div className="pp-modal-backdrop" role="presentation" onClick={onFechar}>
      <div
        className="pp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pp-cat-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pp-cat-modal-title" className="pp-modal__title">
          {titulo}
        </h2>
        <label className="pp-modal__label" htmlFor="pp-cat-nome">
          Nome
        </label>
        <input
          id="pp-cat-nome"
          className="pp-modal__input"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") onSalvar(nome);
          }}
        />
        <div className="pp-modal__actions">
          <button
            type="button"
            className="pp-btn pp-btn--ghost"
            onClick={onFechar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pp-btn pp-btn--green"
            onClick={() => onSalvar(nome)}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function LinhaTabela({
  row,
  ciclos,
  disabled,
  onRemover,
  onAtualizarLinha,
  onAtualizarAcao,
}: {
  row: LinhaMatriz;
  ciclos: CicloMatriz[];
  disabled: boolean;
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
          disabled={disabled}
        >
          ×
        </button>
      </td>
      <td>
        <input
          className="pp-cell-input"
          value={row.item}
          onChange={(e) => onAtualizarLinha(row.id, { item: e.target.value })}
          disabled={disabled}
        />
      </td>
      <td>
        <input
          className="pp-cell-input pp-cell-input--wide"
          value={row.especificacao}
          onChange={(e) =>
            onAtualizarLinha(row.id, { especificacao: e.target.value })
          }
          disabled={disabled}
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
              disabled={disabled}
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
