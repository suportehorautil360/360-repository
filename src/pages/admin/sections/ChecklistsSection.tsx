import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChecklistDefinitions } from "../hooks/checklists/use-checklist-definitions";
import type {
  ChecklistDefinition,
  ChecklistItemSeveridade,
} from "../../../features/checklist/api/checklist-definitions-api";

interface ItemForm {
  texto: string;
  severidade: ChecklistItemSeveridade;
}

interface FormState {
  id: string | null;
  nome: string;
  categoria: string;
  keywordsText: string;
  ativo: boolean;
  itens: ItemForm[];
}

const FORM_VAZIO: FormState = {
  id: null,
  nome: "",
  categoria: "",
  keywordsText: "",
  ativo: true,
  itens: [{ texto: "", severidade: "impeditivo" }],
};

function defToForm(def: ChecklistDefinition): FormState {
  return {
    id: def.id,
    nome: def.nome,
    categoria: def.categoria,
    keywordsText: (def.keywords ?? []).join(", "),
    ativo: def.ativo !== false,
    itens:
      def.itens?.length > 0
        ? def.itens
            .slice()
            .sort((a, b) => a.ordem - b.ordem)
            .map((i) => ({ texto: i.texto, severidade: i.severidade }))
        : [{ texto: "", severidade: "impeditivo" }],
  };
}

function parseKeywords(raw: string): string[] {
  const vistos = new Set<string>();
  return raw
    .split(/[,\n]/)
    .map((k) => k.trim().toLowerCase())
    .filter((k) => {
      if (!k || vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
}

export function ChecklistsSection() {
  const { lista, loading, erro, carregar, adicionar, atualizar, desativar, semear } =
    useChecklistDefinitions();
  const [form, setForm] = useState<FormState | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const editando = form !== null;
  const titulosOrdenados = useMemo(
    () => [...lista].sort((a, b) => a.nome.localeCompare(b.nome)),
    [lista],
  );

  function novoChecklist() {
    setAviso(null);
    setForm({ ...FORM_VAZIO, itens: [{ texto: "", severidade: "impeditivo" }] });
  }

  function editar(def: ChecklistDefinition) {
    setAviso(null);
    setForm(defToForm(def));
  }

  function atualizarItem(idx: number, patch: Partial<ItemForm>) {
    setForm((f) =>
      f
        ? {
            ...f,
            itens: f.itens.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
          }
        : f,
    );
  }

  function addItem() {
    setForm((f) =>
      f ? { ...f, itens: [...f.itens, { texto: "", severidade: "impeditivo" }] } : f,
    );
  }

  function removerItem(idx: number) {
    setForm((f) =>
      f ? { ...f, itens: f.itens.filter((_, i) => i !== idx) } : f,
    );
  }

  async function salvar() {
    if (!form) return;
    const nome = form.nome.trim();
    const categoria = form.categoria.trim() || nome;
    if (!nome) {
      setAviso("Informe o nome do checklist.");
      return;
    }
    const keywords = parseKeywords(form.keywordsText);
    if (keywords.length === 0) {
      setAviso("Informe ao menos uma palavra-chave para casar o equipamento.");
      return;
    }
    const itens = form.itens
      .map((it) => ({ texto: it.texto.trim(), severidade: it.severidade }))
      .filter((it) => it.texto.length > 0)
      .map((it, i) => ({ ordem: i + 1, texto: it.texto, severidade: it.severidade }));
    if (itens.length === 0) {
      setAviso("Adicione ao menos um item de verificação.");
      return;
    }

    setSalvando(true);
    setAviso(null);
    const payload = { nome, categoria, keywords, itens, ativo: form.ativo };
    const res = form.id
      ? await atualizar(form.id, payload)
      : await adicionar(payload);
    setSalvando(false);
    if (res.ok) {
      setForm(null);
    } else {
      setAviso(res.message);
    }
  }

  async function onDesativar(def: ChecklistDefinition) {
    if (
      !window.confirm(
        `Desativar o checklist "${def.nome}"? Ele deixa de aparecer para o operador (o histórico é preservado).`,
      )
    )
      return;
    await desativar(def.id);
  }

  return (
    <section id="checklists" className="aba-conteudo ativa">
      <div className="clientes-head">
        <h2>Checklists do operador</h2>
        {!editando && (
          <button
            type="button"
            className="btn btn-primary clientes-novo"
            onClick={novoChecklist}
          >
            + Novo checklist
          </button>
        )}
      </div>
      <p className="clientes-sub">
        Catálogo global de checklists. O equipamento é casado por palavra-chave
        (ex.: "picador", "munck", "pipa") com o nome/modelo cadastrado.
      </p>

      {erro && !editando && (
        <p className="admin-error" style={{ margin: "0 0 10px" }}>
          {erro}
        </p>
      )}

      {!editando && (
        <article className="card hub-dashboard-table-card">
          <div className="hub-table-scroll">
            <table className="hub-dashboard-table">
              <thead>
                <tr>
                  <th>Checklist</th>
                  <th>Categoria</th>
                  <th>Palavras-chave</th>
                  <th>Itens</th>
                  <th>Versão</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {titulosOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="hub-dash-empty">
                      {loading ? (
                        "Carregando…"
                      ) : (
                        <>
                          Nenhum checklist no catálogo.{" "}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => void semear()}
                          >
                            Popular do seed
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  titulosOrdenados.map((def) => (
                    <tr key={def.id}>
                      <td>
                        <strong>{def.nome}</strong>
                      </td>
                      <td>{def.categoria}</td>
                      <td>{(def.keywords ?? []).join(", ")}</td>
                      <td className="hub-dash-num">{def.itens?.length ?? 0}</td>
                      <td className="hub-dash-num">v{def.version}</td>
                      <td>
                        <span
                          className={
                            def.ativo !== false
                              ? "badge badge-ok"
                              : "badge badge-off"
                          }
                        >
                          {def.ativo !== false ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="hub-dash-action">
                        <button
                          type="button"
                          className="btn btn-secondary hub-dash-btn"
                          onClick={() => editar(def)}
                        >
                          Editar
                        </button>{" "}
                        {def.ativo !== false && (
                          <button
                            type="button"
                            className="btn btn-danger hub-dash-btn"
                            onClick={() => void onDesativar(def)}
                          >
                            Desativar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {editando && form && (
        <article className="card" style={{ padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>
            {form.id ? "Editar checklist" : "Novo checklist"}
          </h3>

          <div className="form-grid" style={{ display: "grid", gap: 12 }}>
            <label>
              <span>Nome</span>
              <input
                type="text"
                value={form.nome}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, nome: e.target.value } : f))
                }
                placeholder="Ex.: Picador de Madeira"
              />
            </label>

            <label>
              <span>Categoria (rótulo de match — usa o nome se vazio)</span>
              <input
                type="text"
                value={form.categoria}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, categoria: e.target.value } : f))
                }
                placeholder="Ex.: Picador de Madeira"
              />
            </label>

            <label>
              <span>Palavras-chave (separadas por vírgula)</span>
              <input
                type="text"
                value={form.keywordsText}
                onChange={(e) =>
                  setForm((f) =>
                    f ? { ...f, keywordsText: e.target.value } : f,
                  )
                }
                placeholder="picador, picador de madeira, chipper"
              />
            </label>

            <label
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, ativo: e.target.checked } : f))
                }
                style={{ width: "auto" }}
              />
              <span>Ativo (disponível para o operador)</span>
            </label>
          </div>

          <h4 style={{ marginBottom: 8 }}>Itens de verificação</h4>
          <div style={{ display: "grid", gap: 8 }}>
            {form.itens.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr 170px auto",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span className="hub-dash-num" style={{ width: 28 }}>
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={item.texto}
                  onChange={(e) =>
                    atualizarItem(idx, { texto: e.target.value })
                  }
                  placeholder="Pergunta / item a checar"
                />
                <Select
                  value={item.severidade}
                  onValueChange={(v) =>
                    atualizarItem(idx, {
                      severidade: v as ChecklistItemSeveridade,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="impeditivo">
                      Impeditivo (bloqueia)
                    </SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => removerItem(idx)}
                  aria-label="Remover item"
                  disabled={form.itens.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={addItem}
            style={{ marginTop: 10 }}
          >
            + Adicionar item
          </button>

          {aviso && (
            <p className="admin-error" style={{ marginTop: 12 }}>
              {aviso}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void salvar()}
              disabled={salvando}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setForm(null)}
              disabled={salvando}
            >
              Cancelar
            </button>
          </div>
        </article>
      )}
    </section>
  );
}
