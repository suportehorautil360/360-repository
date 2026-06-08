import { type FormEvent, useEffect, useState } from "react";
import {
  financeiroApi,
  type FinanceiroOverviewApi,
  type LancamentoApi,
  type StatusLancamentoApi,
  type TipoLancamentoApi,
} from "../../../lib/api/financeiro";

const VAZIO: FinanceiroOverviewApi = {
  lancamentos: [],
  resumo: { receitas: 0, despesas: 0, saldo: 0, total: 0 },
};

const STATUS_LABEL: Record<StatusLancamentoApi, string> = {
  pago: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado",
};

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function valorComSinal(l: LancamentoApi): string {
  const base = moeda(l.valor);
  return l.tipo === "despesa" ? `-${base}` : base;
}

function formatVenc(iso: string): string {
  if (!iso) return "—";
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

function parseMoeda(s: string): number {
  const limpo = s
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

interface LancForm {
  tipo: TipoLancamentoApi;
  status: StatusLancamentoApi;
  descricao: string;
  valor: string;
  vencimento: string;
}

const FORM_INICIAL: LancForm = {
  tipo: "receita",
  status: "pendente",
  descricao: "",
  valor: "",
  vencimento: "",
};

export function FinanceiroSection() {
  const [dados, setDados] = useState<FinanceiroOverviewApi>(VAZIO);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<LancForm>(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [formErro, setFormErro] = useState("");

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      setDados(await financeiroApi.overview());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar o financeiro.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function update<K extends keyof LancForm>(key: K, value: LancForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function abrir() {
    setForm(FORM_INICIAL);
    setFormErro("");
    setModal(true);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setFormErro("");
    if (!form.descricao.trim()) {
      setFormErro("Informe a descrição.");
      return;
    }
    const valor = parseMoeda(form.valor);
    if (!(valor > 0)) {
      setFormErro("Informe um valor maior que zero.");
      return;
    }
    setSalvando(true);
    try {
      await financeiroApi.criar({
        tipo: form.tipo,
        status: form.status,
        descricao: form.descricao.trim(),
        valor,
        vencimento: form.vencimento,
      });
      setModal(false);
      await carregar();
    } catch (err) {
      setFormErro(
        err instanceof Error ? err.message : "Não foi possível salvar.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function remover(l: LancamentoApi) {
    if (!window.confirm(`Remover o lançamento ${l.documento}?`)) return;
    try {
      await financeiroApi.remover(l.id);
      await carregar();
    } catch {
      /* ignora; a lista é recarregada na próxima ação */
    }
  }

  const { resumo, lancamentos } = dados;
  const saldoNegativo = resumo.saldo < 0;

  return (
    <section id="financeiro" className="aba-conteudo ativa">
      <div className="fin-head">
        <div>
          <p className="fin-breadcrumb">Módulos › Financeiro</p>
          <h2 style={{ margin: 0 }}>Contas a Pagar e Receber</h2>
        </div>
        <button type="button" className="btn btn-primary fin-novo" onClick={abrir}>
          + Novo Lançamento
        </button>
      </div>

      {erro && !loading && (
        <p className="admin-error" style={{ marginTop: 12 }}>
          {erro}
        </p>
      )}

      <div className="fin-cards">
        <article className="fin-card">
          <span className="fin-card__label">Receitas</span>
          <span className="fin-card__value fin-value--receita">
            {loading ? "…" : moeda(resumo.receitas)}
          </span>
          <span className="fin-card__sub">▲ entradas registradas</span>
        </article>
        <article className="fin-card">
          <span className="fin-card__label">Despesas</span>
          <span className="fin-card__value fin-value--despesa">
            {loading ? "…" : moeda(resumo.despesas)}
          </span>
          <span className="fin-card__sub">▼ saídas registradas</span>
        </article>
        <article className="fin-card">
          <span className="fin-card__label">Saldo</span>
          <span
            className={`fin-card__value ${saldoNegativo ? "fin-value--despesa" : "fin-value--receita"}`}
          >
            {loading ? "…" : moeda(resumo.saldo)}
          </span>
          <span className="fin-card__sub">
            {saldoNegativo ? "resultado negativo" : "resultado positivo"}
          </span>
        </article>
        <article className="fin-card">
          <span className="fin-card__label">Lançamentos</span>
          <span className="fin-card__value">{loading ? "…" : resumo.total}</span>
          <span className="fin-card__sub">títulos registrados</span>
        </article>
      </div>

      <article className="card fin-tabela-card">
        <div className="hub-table-scroll">
          <table className="fin-tabela">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th style={{ textAlign: "right" }}>Valor</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="topbar-user">
                    {loading ? "Carregando…" : "Nenhum lançamento registrado."}
                  </td>
                </tr>
              ) : (
                lancamentos.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <code style={{ fontSize: "0.8rem" }}>{l.documento}</code>
                    </td>
                    <td>
                      <span className={`fin-tipo fin-tipo--${l.tipo}`}>
                        {l.tipo === "receita" ? "Receita" : "Despesa"}
                      </span>
                    </td>
                    <td>{l.descricao}</td>
                    <td
                      style={{ textAlign: "right" }}
                      className={`fin-valor fin-value--${l.tipo}`}
                    >
                      {valorComSinal(l)}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatVenc(l.vencimento)}
                    </td>
                    <td>
                      <span className={`fin-status fin-status--${l.status}`}>
                        {STATUS_LABEL[l.status]}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="fin-remover"
                        aria-label={`Remover ${l.documento}`}
                        title="Remover"
                        onClick={() => remover(l)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      {modal && (
        <div
          className="fin-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Novo Lançamento Financeiro"
          onClick={() => setModal(false)}
        >
          <div className="fin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fin-modal__head">
              <strong>Novo Lançamento Financeiro</strong>
              <button
                type="button"
                className="fin-modal__close"
                aria-label="Fechar"
                onClick={() => setModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={salvar}>
              <div className="row-2">
                <div>
                  <label htmlFor="finTipo">Tipo</label>
                  <select
                    id="finTipo"
                    value={form.tipo}
                    onChange={(e) =>
                      update("tipo", e.target.value as TipoLancamentoApi)
                    }
                  >
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="finStatus">Status</label>
                  <select
                    id="finStatus"
                    value={form.status}
                    onChange={(e) =>
                      update("status", e.target.value as StatusLancamentoApi)
                    }
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="atrasado">Atrasado</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label htmlFor="finDesc">Descrição</label>
                <input
                  id="finDesc"
                  required
                  placeholder="Ex.: Venda NF 4500"
                  value={form.descricao}
                  onChange={(e) => update("descricao", e.target.value)}
                />
              </div>
              <div className="row-2" style={{ marginTop: 10 }}>
                <div>
                  <label htmlFor="finValor">Valor (R$)</label>
                  <input
                    id="finValor"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.valor}
                    onChange={(e) => update("valor", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="finVenc">Vencimento</label>
                  <input
                    id="finVenc"
                    type="date"
                    value={form.vencimento}
                    onChange={(e) => update("vencimento", e.target.value)}
                  />
                </div>
              </div>
              {formErro && (
                <p className="admin-error" style={{ margin: "10px 0 0" }}>
                  {formErro}
                </p>
              )}
              <div className="cad-actions" style={{ marginTop: 18 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModal(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={salvando}
                >
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
