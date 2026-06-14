import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  parceirosApi,
  type CriarParceiroPayload,
  type ParceirosOverviewApi,
  type TipoParceiroApi,
} from "../../../lib/api/parceiros";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BANDEIRAS = [
  "Petrobras / BR",
  "Ipiranga",
  "Shell",
  "Raízen",
  "Vibra",
  "Ale",
  "Sem bandeira (branca)",
  "Outra",
];
const COMBUSTIVEIS = [
  "Gasolina Comum",
  "Gasolina Aditivada",
  "Etanol",
  "Diesel S10",
  "Diesel S500",
  "GNV",
  "Eletroposto",
];
const SERVICOS_POSTO = [
  "Pátio p/ caminhões",
  "Conveniência",
  "Troca de óleo",
  "Atendimento 24h",
];
const LINHAS = [
  { emoji: "🟨", label: "Linha Amarela" },
  { emoji: "🟩", label: "Linha Verde" },
  { emoji: "⬜", label: "Linha Branca" },
  { emoji: "🟦", label: "Linha Leve" },
];
const CATEGORIAS = [
  { emoji: "⚙️", label: "Mecânica Geral" },
  { emoji: "⚡", label: "Autoelétrica / Injeção" },
  { emoji: "🛞", label: "Borracharia" },
  { emoji: "🎨", label: "Funilaria e Pintura" },
];
const CONDICOES = [
  "Faturamento Quinzenal",
  "Faturamento Mensal",
  "Faturamento Semanal",
  "30 dias",
  "À vista",
];

type Aba = "dados" | "posto" | "oficina" | "financeiro";

interface ParceiroForm {
  tipo: TipoParceiroApi;
  cnpj: string;
  telefonePrincipal: string;
  razaoSocial: string;
  nomeFantasia: string;
  emailComercial: string;
  cidadeUf: string;
  endereco: string;
  bandeira: string;
  combustiveis: string[];
  servicos: string[];
  linhasAtuacao: string[];
  categoriasServico: string[];
  especificacoes: string;
  condicaoPagamento: string;
  limiteCredito: string;
  descontoComercial: string;
  observacoesFaturamento: string;
}

const FORM_INICIAL: ParceiroForm = {
  tipo: "posto",
  cnpj: "",
  telefonePrincipal: "",
  razaoSocial: "",
  nomeFantasia: "",
  emailComercial: "",
  cidadeUf: "",
  endereco: "",
  bandeira: BANDEIRAS[0],
  combustiveis: [],
  servicos: [],
  linhasAtuacao: [],
  categoriasServico: [],
  especificacoes: "",
  condicaoPagamento: CONDICOES[0],
  limiteCredito: "",
  descontoComercial: "",
  observacoesFaturamento: "",
};

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseMoeda(s: string): number {
  const limpo = s
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

interface ParceiroLinha {
  id: string;
  tipo: TipoParceiroApi;
  razaoSocial: string;
  fantasia: string;
  cidade: string;
  condicao: string;
  limite: number;
}

export function CadastroParceiroSection({
  onVoltar,
}: {
  onVoltar: () => void;
}) {
  const [aba, setAba] = useState<Aba>("dados");
  const [form, setForm] = useState<ParceiroForm>(FORM_INICIAL);
  const [dados, setDados] = useState<ParceirosOverviewApi>({
    postos: [],
    oficinas: [],
  });
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"none" | "ok" | "err">("none");

  function setMsgTexto(tone: "none" | "ok" | "err", texto: string) {
    setMsgTone(tone);
    setMsg(texto);
  }

  function update<K extends keyof ParceiroForm>(key: K, value: ParceiroForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggle(
    key: "combustiveis" | "servicos" | "linhasAtuacao" | "categoriasServico",
    value: string,
  ) {
    setForm((prev) => {
      const atual = prev[key];
      const novo = atual.includes(value)
        ? atual.filter((v) => v !== value)
        : [...atual, value];
      return { ...prev, [key]: novo };
    });
  }

  async function carregar() {
    try {
      setDados(await parceirosApi.overview());
    } catch {
      /* a lista some, mas o form segue utilizável */
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const linhas: ParceiroLinha[] = useMemo(() => {
    const dePosto: ParceiroLinha[] = dados.postos.map((p) => ({
      id: p.id,
      tipo: "posto",
      razaoSocial: p.razaoSocial,
      fantasia: p.nome,
      cidade: p.cidadeUf,
      condicao: p.condicaoPagamento,
      limite: p.limiteCredito,
    }));
    const deOficina: ParceiroLinha[] = dados.oficinas.map((o) => ({
      id: o.id,
      tipo: "oficina",
      razaoSocial: o.razaoSocial,
      fantasia: o.nome,
      cidade: o.cidadeUf,
      condicao: o.condicaoPagamento,
      limite: o.limiteCredito,
    }));
    return [...dePosto, ...deOficina];
  }, [dados]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setMsgTexto("none", "");
    if (!form.razaoSocial.trim()) {
      setAba("dados");
      setMsgTexto("err", "Informe a razão social do parceiro.");
      return;
    }
    setSalvando(true);
    try {
      const payload: CriarParceiroPayload = {
        tipo: form.tipo,
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim(),
        cnpj: form.cnpj.trim(),
        telefonePrincipal: form.telefonePrincipal.trim(),
        emailComercial: form.emailComercial.trim(),
        cidadeUf: form.cidadeUf.trim(),
        endereco: form.endereco.trim(),
        bandeira: form.bandeira,
        combustiveis: form.combustiveis,
        servicos: form.servicos,
        linhasAtuacao: form.linhasAtuacao,
        categoriasServico: form.categoriasServico,
        especificacoes: form.especificacoes.trim(),
        condicaoPagamento: form.condicaoPagamento,
        limiteCredito: form.limiteCredito
          ? parseMoeda(form.limiteCredito)
          : 0,
        descontoComercial: form.descontoComercial.trim(),
        observacoesFaturamento: form.observacoesFaturamento.trim(),
      };
      await parceirosApi.criar(payload);
      setMsgTexto("ok", `Parceiro "${form.razaoSocial.trim()}" cadastrado.`);
      setForm(FORM_INICIAL);
      setAba("dados");
      await carregar();
    } catch (err) {
      setMsgTexto(
        "err",
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o parceiro.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function remover(tipo: TipoParceiroApi, id: string, nome: string) {
    if (!window.confirm(`Remover o parceiro "${nome}"?`)) return;
    try {
      await parceirosApi.remover(tipo, id);
      await carregar();
    } catch (err) {
      setMsgTexto(
        "err",
        err instanceof Error ? err.message : "Não foi possível remover.",
      );
    }
  }

  const msgClass =
    msgTone === "none"
      ? "status"
      : `status status--${msgTone === "ok" ? "ok" : "err"}`;

  const ABAS: { id: Aba; label: string }[] = [
    { id: "dados", label: "📋 Dados Gerais" },
    { id: "posto", label: "🛢️ Postos de Combustível" },
    { id: "oficina", label: "🔧 Oficinas Mecânicas" },
    { id: "financeiro", label: "💳 Financeiro / Contrato" },
  ];

  const abasVisiveis = useMemo(
    () =>
      ABAS.filter((a) => {
        if (a.id === "posto") return form.tipo === "posto";
        if (a.id === "oficina") return form.tipo === "oficina";
        return true;
      }),
    [form.tipo],
  );

  useEffect(() => {
    if (abasVisiveis.some((a) => a.id === aba)) return;
    setAba("dados");
  }, [aba, abasVisiveis]);

  return (
    <>
      <h2>Cadastro do Parceiro</h2>
      <p className="topbar-user" style={{ marginBottom: 16 }}>
        Postos de combustível e oficinas mecânicas credenciados.
      </p>

      <article className="card">
        <div className="parc-tabs" role="tablist">
          {abasVisiveis.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              className={`parc-tab ${aba === a.id ? "is-active" : ""}`}
              onClick={() => setAba(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>

        <form id="formParceiro" onSubmit={salvar}>
          {aba === "dados" && (
            <>
              <div className="parc-sec-titulo">
                Informações cadastrais da empresa
              </div>
              <div className="row-3">
                <div>
                  <label htmlFor="pcTipo">Tipo de parceiro</label>
                  <Select
                    value={form.tipo}
                    onValueChange={(v) => update("tipo", v as TipoParceiroApi)}
                  >
                    <SelectTrigger id="pcTipo" className="admin-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="posto">Posto</SelectItem>
                      <SelectItem value="oficina">Oficina</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="pcCnpj">CNPJ</label>
                  <input
                    id="pcCnpj"
                    placeholder="00.000.000/0001-00"
                    value={form.cnpj}
                    onChange={(e) => update("cnpj", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="pcTel">Telefone principal</label>
                  <input
                    id="pcTel"
                    placeholder="(00) 0000-0000"
                    value={form.telefonePrincipal}
                    onChange={(e) =>
                      update("telefonePrincipal", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="row-2" style={{ marginTop: 10 }}>
                <div>
                  <label htmlFor="pcRazao">
                    Razão social <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <input
                    id="pcRazao"
                    required
                    placeholder="Nome empresarial completo"
                    value={form.razaoSocial}
                    onChange={(e) => update("razaoSocial", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="pcFantasia">Nome fantasia</label>
                  <input
                    id="pcFantasia"
                    placeholder="Nome comercial"
                    value={form.nomeFantasia}
                    onChange={(e) => update("nomeFantasia", e.target.value)}
                  />
                </div>
              </div>
              <div className="row-2" style={{ marginTop: 10 }}>
                <div>
                  <label htmlFor="pcEmail">E-mail comercial</label>
                  <input
                    id="pcEmail"
                    type="email"
                    placeholder="contato@empresa.com"
                    value={form.emailComercial}
                    onChange={(e) => update("emailComercial", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="pcCidade">Cidade / UF</label>
                  <input
                    id="pcCidade"
                    placeholder="Ex.: Campinas/SP"
                    value={form.cidadeUf}
                    onChange={(e) => update("cidadeUf", e.target.value)}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label htmlFor="pcEndereco">Endereço</label>
                <input
                  id="pcEndereco"
                  placeholder="Rua, número, bairro"
                  value={form.endereco}
                  onChange={(e) => update("endereco", e.target.value)}
                />
              </div>
            </>
          )}

          {aba === "posto" && (
            <>
              <div className="parc-sec-titulo">
                Infraestrutura do posto de combustível
              </div>
              <div style={{ maxWidth: 420 }}>
                <label htmlFor="pcBandeira">Bandeira do posto</label>
                <Select
                  value={form.bandeira}
                  onValueChange={(v) => update("bandeira", v)}
                >
                  <SelectTrigger id="pcBandeira" className="admin-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANDEIRAS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="parc-grupo-label">Combustíveis fornecidos:</div>
              <div className="parc-check-grid">
                {COMBUSTIVEIS.map((c) => (
                  <label key={c} className="parc-check">
                    <input
                      type="checkbox"
                      checked={form.combustiveis.includes(c)}
                      onChange={() => toggle("combustiveis", c)}
                    />
                    {c}
                  </label>
                ))}
              </div>
              <div className="parc-grupo-label">Serviços adicionais:</div>
              <div className="parc-check-grid">
                {SERVICOS_POSTO.map((s) => (
                  <label key={s} className="parc-check">
                    <input
                      type="checkbox"
                      checked={form.servicos.includes(s)}
                      onChange={() => toggle("servicos", s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </>
          )}

          {aba === "oficina" && (
            <>
              <div className="parc-sec-titulo">📁 Linhas de atuação</div>
              <div className="parc-check-grid">
                {LINHAS.map((l) => (
                  <label key={l.label} className="parc-check">
                    <input
                      type="checkbox"
                      checked={form.linhasAtuacao.includes(l.label)}
                      onChange={() => toggle("linhasAtuacao", l.label)}
                    />
                    <span aria-hidden="true">{l.emoji}</span> {l.label}
                  </label>
                ))}
              </div>
              <div className="parc-sec-titulo">🔧 Categorias de serviço</div>
              <div className="parc-check-grid">
                {CATEGORIAS.map((c) => (
                  <label key={c.label} className="parc-check">
                    <input
                      type="checkbox"
                      checked={form.categoriasServico.includes(c.label)}
                      onChange={() => toggle("categoriasServico", c.label)}
                    />
                    <span aria-hidden="true">{c.emoji}</span> {c.label}
                  </label>
                ))}
              </div>
              <div className="parc-sec-titulo">
                🛠️ Especificações e detalhes técnicos
              </div>
              <textarea
                id="pcEspec"
                placeholder="Ex.: Eletricista com scanner para linha Amarela (CAT/JCB). Borracharia equipada para vulcanização de pneus de tratores agrícolas pesados..."
                value={form.especificacoes}
                onChange={(e) => update("especificacoes", e.target.value)}
                rows={5}
              />
            </>
          )}

          {aba === "financeiro" && (
            <>
              <div className="parc-sec-titulo">
                Acordo comercial e financeiro
              </div>
              <div className="row-3">
                <div>
                  <label htmlFor="pcCondicao">Condição de pagamento</label>
                  <Select
                    value={form.condicaoPagamento}
                    onValueChange={(v) => update("condicaoPagamento", v)}
                  >
                    <SelectTrigger id="pcCondicao" className="admin-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDICOES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="pcLimite">Limite de crédito (R$)</label>
                  <input
                    id="pcLimite"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.limiteCredito}
                    onChange={(e) => update("limiteCredito", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="pcDesconto">Desconto comercial</label>
                  <input
                    id="pcDesconto"
                    placeholder="Ex.: 10% peças / 5% mão de obra"
                    value={form.descontoComercial}
                    onChange={(e) => update("descontoComercial", e.target.value)}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label htmlFor="pcObs">
                  Observações de cobrança / faturamento
                </label>
                <textarea
                  id="pcObs"
                  placeholder="Dados de faturamento, e-mail para NF, regras contratuais..."
                  value={form.observacoesFaturamento}
                  onChange={(e) =>
                    update("observacoesFaturamento", e.target.value)
                  }
                  rows={4}
                />
              </div>
            </>
          )}

          <div className="cad-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onVoltar}
            >
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar Cadastro de Parceiro"}
            </button>
          </div>
          <div id="msgParceiro" className={msgClass} role="status">
            {msg}
          </div>
        </form>
      </article>

      <h3 className="parc-lista-titulo">Parceiros cadastrados</h3>
      <div className="hub-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Razão social</th>
              <th>Fantasia</th>
              <th>Cidade</th>
              <th>Condição pgto.</th>
              <th style={{ textAlign: "right" }}>Limite</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={7} className="topbar-user">
                  Nenhum parceiro cadastrado.
                </td>
              </tr>
            ) : (
              linhas.map((l) => (
                <tr key={`${l.tipo}-${l.id}`}>
                  <td>
                    <span className={`parc-tipo parc-tipo--${l.tipo}`}>
                      {l.tipo === "posto" ? "Posto" : "Oficina"}
                    </span>
                  </td>
                  <td>
                    <strong>{l.razaoSocial}</strong>
                  </td>
                  <td>{l.fantasia || "—"}</td>
                  <td>{l.cidade || "—"}</td>
                  <td>{l.condicao || "—"}</td>
                  <td style={{ textAlign: "right" }}>{moeda(l.limite)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => remover(l.tipo, l.id, l.razaoSocial)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
