import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  clientesApi,
  type ClienteApi,
  type ContratoClienteApi,
} from "../../../lib/api/clientes";
import { formatarCnpj } from "../../../lib/funcionarios/cnpj";
import type { TipoCliente } from "../../../lib/hu360";
import { CadastroAcessosTab } from "./CadastroAcessosTab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MODALIDADES: { value: string; label: string }[] = [
  { value: "pregao_eletronico", label: "Pregão eletrônico" },
  { value: "pregao_presencial", label: "Pregão presencial" },
  { value: "dispensa", label: "Dispensa de licitação" },
  { value: "inexigibilidade", label: "Inexigibilidade" },
  { value: "credenciamento", label: "Credenciamento / chamamento público" },
  {
    value: "inexigibilidade_chamamento",
    label: "Inexigibilidade com chamamento",
  },
  { value: "outros", label: "Outros" },
];

const PERIODICIDADES: { value: string; label: string }[] = [
  { value: "mensal", label: "Mensal" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "anual", label: "Anual" },
];

const STATUS_OPCOES: { value: string; label: string }[] = [
  { value: "ativo", label: "Ativo" },
  { value: "suspenso", label: "Suspenso" },
  { value: "encerrado", label: "Encerrado" },
];

type Segmento = "orgao_publico" | "empresa_privada";

interface FormState {
  segmento: Segmento;
  nome: string;
  uf: string;
  email: string;
  cnpj: string;
  caepf: string;
  cidade: string;
  whatsapp: string;
  numero: string;
  processo: string;
  modalidade: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  objeto: string;
  qtdAtivos: string;
  resp: string;
  // Avançado
  status: string;
  dataAssinatura: string;
  periodicidade: string;
  valorMensal: string;
  valorTotal: string;
  indiceReajuste: string;
  slaHoras: string;
  cargo: string;
  telefone: string;
  observacoes: string;
}

const FORM_INICIAL: FormState = {
  segmento: "orgao_publico",
  nome: "",
  uf: "",
  email: "",
  cnpj: "",
  caepf: "",
  cidade: "",
  whatsapp: "",
  numero: "",
  processo: "",
  modalidade: "pregao_eletronico",
  vigenciaInicio: "",
  vigenciaFim: "",
  objeto: "",
  qtdAtivos: "",
  resp: "",
  status: "ativo",
  dataAssinatura: "",
  periodicidade: "mensal",
  valorMensal: "",
  valorTotal: "",
  indiceReajuste: "",
  slaHoras: "",
  cargo: "",
  telefone: "",
  observacoes: "",
};

/** Documento do cliente (banco) → estado do formulário, para o modo edição. */
function clienteParaForm(c: ClienteApi): FormState {
  const ct: Partial<ContratoClienteApi> = c.contrato ?? {};
  return {
    segmento: c.tipoCliente === "locacao" ? "empresa_privada" : "orgao_publico",
    nome: c.nome ?? "",
    uf: c.uf ?? "",
    email: ct.emailContratante ?? "",
    cnpj: formatarCnpj(c.cnpj ?? ""),
    caepf: c.caepf ?? "",
    cidade: c.cidade ?? "",
    whatsapp: c.whatsapp ?? "",
    numero: ct.numero ?? "",
    processo: ct.processo ?? "",
    modalidade: ct.modalidade || "pregao_eletronico",
    vigenciaInicio: ct.vigenciaInicio ?? "",
    vigenciaFim: ct.vigenciaFim ?? "",
    objeto: ct.objeto ?? "",
    qtdAtivos: ct.qtdInicialAtivos != null ? String(ct.qtdInicialAtivos) : "",
    resp: ct.responsavelContratante ?? "",
    status: ct.status || "ativo",
    dataAssinatura: ct.dataAssinatura ?? "",
    periodicidade: ct.periodicidadeFaturamento || "mensal",
    valorMensal: ct.valorMensal ?? "",
    valorTotal: ct.valorTotal ?? "",
    indiceReajuste: ct.indiceReajuste ?? "",
    slaHoras: ct.slaRespostaHoras ?? "",
    cargo: ct.cargoContratante ?? "",
    telefone: ct.telefoneContratante ?? "",
    observacoes: ct.observacoes ?? "",
  };
}

const REQ = <span style={{ color: "#f87171" }}>*</span>;

type Aba = "contrato" | "acessos";

export function CadastroClientesSection() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId?: string }>();
  const [searchParams] = useSearchParams();
  const ehEdicao = !!clienteId;
  const [aba, setAba] = useState<Aba>(
    searchParams.get("aba") === "acessos" ? "acessos" : "contrato",
  );
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [avancado, setAvancado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"none" | "ok" | "err">("none");

  const isLoc = form.segmento === "empresa_privada";

  // Modo edição: carrega o cliente e pré-preenche o formulário.
  useEffect(() => {
    if (!clienteId) return;
    let ativo = true;
    void (async () => {
      try {
        const c = await clientesApi.obter(clienteId);
        if (!ativo) return;
        if (c) setForm(clienteParaForm(c));
        else setMsgTexto("err", "Cliente não encontrado.");
      } catch (err) {
        if (ativo) {
          setMsgTexto(
            "err",
            err instanceof Error ? err.message : "Falha ao carregar o cliente.",
          );
        }
      }
    })();
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  const introTexto = useMemo(() => {
    if (isLoc) {
      return (
        <>
          <strong>Empresa privada:</strong> contrato comercial,{" "}
          <strong>sem</strong> bloco de licitação (pregão, edital, modalidade
          legal). Informe objeto, valores e contato corporativo.
        </>
      );
    }
    return (
      <>
        <strong>Órgão público:</strong> obrigatório o instrumento público —
        processo / edital quando couber e{" "}
        <strong>modalidade de contratação</strong> compatível com a Lei
        14.133/2021 (ou lei local). Vigência, objeto e fiscal no órgão
        contratante.
      </>
    );
  }, [isLoc]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setMsgTexto(tone: "none" | "ok" | "err", texto: string) {
    setMsgTone(tone);
    setMsg(texto);
  }

  useEffect(() => {
    if (isLoc) {
      setForm((p) => ({
        ...p,
        modalidade: "contrato_privado_locacao",
        processo: "",
      }));
    } else if (form.modalidade === "contrato_privado_locacao") {
      setForm((p) => ({ ...p, modalidade: "pregao_eletronico" }));
    }
  }, [form.segmento]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsgTexto("none", "");
    setLoading(true);
    const tipoCliente: TipoCliente = isLoc ? "locacao" : "prefeitura";
    const payload = {
      nome: form.nome,
      uf: form.uf,
      tipoCliente,
      cnpj: form.cnpj.trim(),
      caepf: form.caepf.trim(),
      cidade: form.cidade.trim(),
      whatsapp: form.whatsapp.trim(),
      contrato: {
        numero: form.numero.trim(),
        processo: isLoc ? "" : form.processo.trim(),
        modalidade: isLoc ? "contrato_privado_locacao" : form.modalidade,
        dataAssinatura: form.dataAssinatura,
        vigenciaInicio: form.vigenciaInicio,
        vigenciaFim: form.vigenciaFim,
        objeto: form.objeto.trim(),
        valorMensal: form.valorMensal.trim(),
        valorTotal: form.valorTotal.trim(),
        indiceReajuste: form.indiceReajuste.trim(),
        periodicidadeFaturamento: form.periodicidade,
        slaRespostaHoras: form.slaHoras.trim(),
        responsavelContratante: form.resp.trim(),
        cargoContratante: form.cargo.trim(),
        emailContratante: form.email.trim(),
        telefoneContratante: form.telefone.trim(),
        observacoes: form.observacoes.trim(),
        status: form.status,
        qtdInicialAtivos: form.qtdAtivos.trim() ? Number(form.qtdAtivos) : 0,
      },
    };
    try {
      if (ehEdicao && clienteId) {
        await clientesApi.atualizar(clienteId, payload);
        setMsgTexto(
          "ok",
          `Cliente atualizado: ${form.nome.trim()} (${form.uf.toUpperCase()}).`,
        );
      } else {
        const { id } = await clientesApi.criar(payload);
        setMsgTexto(
          "ok",
          `Cliente cadastrado: ${form.nome.trim()} (${form.uf.toUpperCase()}). ID interno: ${id || "—"}.`,
        );
        setForm({ ...FORM_INICIAL, segmento: form.segmento });
      }
    } catch (err) {
      setMsgTexto(
        "err",
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o cliente.",
      );
    } finally {
      setLoading(false);
    }
  }

  const msgClass =
    msgTone === "none"
      ? "status"
      : `status status--${msgTone === "ok" ? "ok" : "err"}`;

  return (
    <section id="acessos" className="aba-conteudo ativa">
      <h2>{ehEdicao ? "Editar cliente" : "Cadastro de clientes"}</h2>
      <p className="topbar-user" style={{ marginBottom: 16 }}>
        Contrato de prestação de serviços e gestão de acessos por cliente.
      </p>

      <article className="card">
        <div className="cad-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={aba === "contrato"}
            className={`cad-tab ${aba === "contrato" ? "is-active" : ""}`}
            onClick={() => setAba("contrato")}
          >
            📁 Dados do contrato
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === "acessos"}
            className={`cad-tab ${aba === "acessos" ? "is-active" : ""}`}
            onClick={() => setAba("acessos")}
          >
            🔐 Acessos e logins
          </button>
        </div>

        {aba === "contrato" ? (
          <form id="formPrefeituraContrato" onSubmit={handleSubmit}>
            <div className="cad-banner">{introTexto}</div>

            <div className="contrato-secao">
              <div className="contrato-secao-titulo">Tipo de cliente</div>
              <div>
                <label htmlFor="cadastroTipoCliente">Segmento {REQ}</label>
                <Select
                  value={form.segmento}
                  onValueChange={(v) => update("segmento", v as Segmento)}
                >
                  <SelectTrigger id="cadastroTipoCliente" className="admin-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orgao_publico">
                      Órgão público
                    </SelectItem>
                    <SelectItem value="empresa_privada">
                      Empresa privada
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="contrato-secao">
              <div className="contrato-secao-titulo">
                {isLoc
                  ? "Contratante (empresa privada)"
                  : "Contratante (poder público municipal)"}
              </div>
              <div className="row-2">
                <div>
                  <label htmlFor="cadastroPrefNome">
                    {isLoc ? "Razão social ou nome fantasia" : "Município"} {REQ}
                  </label>
                  <input
                    id="cadastroPrefNome"
                    required
                    placeholder={
                      isLoc ? "Ex.: Frota Sul Transportes Ltda" : "Ex.: Campo Grande"
                    }
                    autoComplete="organization"
                    value={form.nome}
                    onChange={(e) => update("nome", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="cadastroPrefUf">
                    UF{" "}
                    <span style={{ fontWeight: 400, color: "var(--muted)" }}>
                      {isLoc ? "(da sede)" : "(do município)"}
                    </span>{" "}
                    {REQ}
                  </label>
                  <input
                    id="cadastroPrefUf"
                    required
                    maxLength={2}
                    placeholder="MS"
                    autoComplete="off"
                    style={{ textTransform: "uppercase" }}
                    value={form.uf}
                    onChange={(e) => update("uf", e.target.value.toUpperCase())}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label htmlFor="ctrEmail">E-mail da empresa / órgão {REQ}</label>
                <input
                  id="ctrEmail"
                  type="email"
                  required
                  placeholder="contato@empresa.com — usado para gerar os acessos"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>
              <div className="row-2" style={{ marginTop: 10 }}>
                <div>
                  <label htmlFor="ctrCnpj">CNPJ</label>
                  <input
                    id="ctrCnpj"
                    placeholder="12.345.678/0001-90"
                    value={form.cnpj}
                    onChange={(e) => update("cnpj", formatarCnpj(e.target.value))}
                  />
                </div>
                <div>
                  <label htmlFor="ctrCaepf">
                    CAEPF / CEI{" "}
                    <span style={{ fontWeight: 400, color: "var(--muted)" }}>
                      (sem CNPJ)
                    </span>
                  </label>
                  <input
                    id="ctrCaepf"
                    placeholder="Para órgão sem CNPJ"
                    value={form.caepf}
                    onChange={(e) => update("caepf", e.target.value)}
                  />
                </div>
              </div>
              <div className="row-2" style={{ marginTop: 10 }}>
                <div>
                  <label htmlFor="ctrCidade">Cidade</label>
                  <input
                    id="ctrCidade"
                    placeholder="Ex.: Campo Grande"
                    value={form.cidade}
                    onChange={(e) => update("cidade", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="ctrWhatsapp">WhatsApp</label>
                  <input
                    id="ctrWhatsapp"
                    placeholder="+5567999999999"
                    value={form.whatsapp}
                    onChange={(e) => update("whatsapp", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="contrato-secao">
              <div className="contrato-secao-titulo">
                {isLoc
                  ? "Contrato comercial — sem licitação"
                  : "Instrumento e licitação"}
              </div>
              <div className="row-2">
                <div>
                  <label htmlFor="ctrNumero">
                    {isLoc
                      ? "Nº contrato ou proposta comercial"
                      : "Nº do contrato / termo"}{" "}
                    {REQ}
                  </label>
                  <input
                    id="ctrNumero"
                    required
                    placeholder={isLoc ? "Ex.: PRIV-FROTA-2026-018" : "Ex.: 045/2026"}
                    value={form.numero}
                    onChange={(e) => update("numero", e.target.value)}
                  />
                </div>
                {!isLoc && (
                  <div>
                    <label htmlFor="ctrProcesso">Processo / edital / ata</label>
                    <input
                      id="ctrProcesso"
                      placeholder="Nº do processo licitatório"
                      value={form.processo}
                      onChange={(e) => update("processo", e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="row-3" style={{ marginTop: 10 }}>
                {!isLoc && (
                  <div>
                    <label htmlFor="ctrModalidade">Modalidade</label>
                    <Select
                      value={form.modalidade}
                      onValueChange={(v) => update("modalidade", v)}
                    >
                      <SelectTrigger id="ctrModalidade" className="admin-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODALIDADES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label htmlFor="ctrVigenciaInicio">Início da vigência</label>
                  <input
                    id="ctrVigenciaInicio"
                    type="date"
                    value={form.vigenciaInicio}
                    onChange={(e) => update("vigenciaInicio", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="ctrVigenciaFim">Fim da vigência</label>
                  <input
                    id="ctrVigenciaFim"
                    type="date"
                    value={form.vigenciaFim}
                    onChange={(e) => update("vigenciaFim", e.target.value)}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label htmlFor="ctrObjeto">
                  {isLoc
                    ? "Descrição do que será contratado"
                    : "Objeto do contrato"}{" "}
                  {REQ}
                </label>
                <textarea
                  id="ctrObjeto"
                  required
                  placeholder="Ex.: Gestão de frota e manutenção de veículos..."
                  value={form.objeto}
                  onChange={(e) => update("objeto", e.target.value)}
                />
              </div>
              <div className="row-2" style={{ marginTop: 10 }}>
                <div>
                  <label htmlFor="ctrQtdAtivos">Qtd. inicial de ativos</label>
                  <input
                    id="ctrQtdAtivos"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={form.qtdAtivos}
                    onChange={(e) =>
                      update("qtdAtivos", e.target.value.replace(/[^0-9]/g, ""))
                    }
                  />
                </div>
                <div>
                  <label htmlFor="ctrResp">
                    {isLoc
                      ? "Responsável pela conta (nome)"
                      : "Fiscal do contrato (órgão)"}
                  </label>
                  <input
                    id="ctrResp"
                    placeholder="Nome do gestor / fiscal responsável"
                    value={form.resp}
                    onChange={(e) => update("resp", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="contrato-secao">
              <button
                type="button"
                className="cad-avancado-toggle"
                aria-expanded={avancado}
                onClick={() => setAvancado((v) => !v)}
              >
                <span aria-hidden="true">{avancado ? "▾" : "▸"}</span> Avançado
                (status, valores, SLA, observações)
              </button>

              {avancado && (
                <div className="cad-avancado">
                  <div className="row-3" style={{ marginTop: 12 }}>
                    <div>
                      <label htmlFor="ctrStatus">Status do contrato</label>
                      <Select
                        value={form.status}
                        onValueChange={(v) => update("status", v)}
                      >
                        <SelectTrigger id="ctrStatus" className="admin-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPCOES.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="ctrDataAssinatura">
                        Data de assinatura
                      </label>
                      <input
                        id="ctrDataAssinatura"
                        type="date"
                        value={form.dataAssinatura}
                        onChange={(e) =>
                          update("dataAssinatura", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="ctrPeriodicidade">
                        Periodicidade de faturamento
                      </label>
                      <Select
                        value={form.periodicidade}
                        onValueChange={(v) => update("periodicidade", v)}
                      >
                        <SelectTrigger
                          id="ctrPeriodicidade"
                          className="admin-select"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERIODICIDADES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="row-3" style={{ marginTop: 10 }}>
                    <div>
                      <label htmlFor="ctrValorMensal">Valor mensal estimado</label>
                      <input
                        id="ctrValorMensal"
                        placeholder="Ex.: R$ 25.000,00"
                        value={form.valorMensal}
                        onChange={(e) => update("valorMensal", e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="ctrValorTotal">Valor total do contrato</label>
                      <input
                        id="ctrValorTotal"
                        placeholder="Ex.: R$ 900.000,00"
                        value={form.valorTotal}
                        onChange={(e) => update("valorTotal", e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="ctrSlaHoras">
                        SLA de resposta (horas úteis)
                      </label>
                      <input
                        id="ctrSlaHoras"
                        type="text"
                        inputMode="numeric"
                        placeholder="Ex.: 24"
                        value={form.slaHoras}
                        onChange={(e) => update("slaHoras", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="row-3" style={{ marginTop: 10 }}>
                    <div>
                      <label htmlFor="ctrIndiceReajuste">Índice / reajuste</label>
                      <input
                        id="ctrIndiceReajuste"
                        placeholder="Ex.: IPCA, IPCA + 1%"
                        value={form.indiceReajuste}
                        onChange={(e) => update("indiceReajuste", e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="ctrCargo">
                        {isLoc ? "Função ou departamento" : "Cargo ou setor"}
                      </label>
                      <input
                        id="ctrCargo"
                        placeholder={
                          isLoc
                            ? "Ex.: Gestão de frotas / Operações"
                            : "Ex.: Secretaria de Administração"
                        }
                        value={form.cargo}
                        onChange={(e) => update("cargo", e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="ctrTelefone">Telefone</label>
                      <input
                        id="ctrTelefone"
                        placeholder="Com DDD"
                        value={form.telefone}
                        onChange={(e) => update("telefone", e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label htmlFor="ctrObs">
                      Observações e cláusulas gerais
                    </label>
                    <textarea
                      id="ctrObs"
                      placeholder="Penalidades, renovação, rescisão, LGPD, horário de atendimento…"
                      value={form.observacoes}
                      onChange={(e) => update("observacoes", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="cad-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/admin/clientes")}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Salvando..."
                  : ehEdicao
                    ? "Salvar alterações"
                    : "Salvar cliente e contrato"}
              </button>
            </div>
            <div id="msgPrefeituras" className={msgClass} role="status">
              {msg}
            </div>
          </form>
        ) : (
          <CadastroAcessosTab clienteIdInicial={clienteId} />
        )}
      </article>
    </section>
  );
}
