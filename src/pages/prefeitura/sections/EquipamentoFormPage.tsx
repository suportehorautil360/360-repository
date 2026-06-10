import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMBUSTIVEL_OPTIONS,
  defaultInterval,
  equipamentosApi,
  FROTA_OPTIONS,
  STATUS_OPTIONS,
  TIPO_OPTIONS,
  UF_OPTIONS,
  unitForTipo,
  type NovoEquip,
  type StatusEquipamento,
} from "./equipamentos/equipamentos-api";
import {
  configuracoesApi,
  categoriaDoTipo,
  type Configuracao,
} from "../../../lib/api/configuracoes";
import "./funcionario-form.css";

interface Props {
  prefeituraId: string;
  modo: "novo" | "editar";
}

interface FormState {
  // Identificação
  placa: string;
  chassis: string;
  renavam: string;
  numeroSerie: string;
  patrimonioBase: string;
  // Veículo
  marca: string;
  modelo: string;
  cor: string;
  combustivel: string;
  tipo: string;
  tipoFrota: string;
  motorizacao: string;
  anoFabricacao: string;
  anoModelo: string;
  capacidadeTanque: string;
  valorVeiculo: string;
  // Operação / revisão
  status: StatusEquipamento;
  medicaoAtual: string;
  intervaloRevisao: string;
  condutorResponsavel: string;
  gestorResponsavel: string;
  // Localização
  centroCusto: string;
  cidade: string;
  estado: string;
  regiao: string;
  // Documentos
  ipva: string;
  seguro: string;
  licenciamento: string;
  // Locação
  vigenciaInicio: string;
  vigenciaFim: string;
  inativarAposVigencia: boolean;
}

const FORM_VAZIO: FormState = {
  placa: "",
  chassis: "",
  renavam: "",
  numeroSerie: "",
  patrimonioBase: "",
  marca: "",
  modelo: "",
  cor: "",
  combustivel: COMBUSTIVEL_OPTIONS[0],
  tipo: TIPO_OPTIONS[0],
  tipoFrota: FROTA_OPTIONS[0],
  motorizacao: "",
  anoFabricacao: "",
  anoModelo: "",
  capacidadeTanque: "",
  valorVeiculo: "",
  status: "ativo",
  medicaoAtual: "0",
  intervaloRevisao: "0",
  condutorResponsavel: "",
  gestorResponsavel: "",
  centroCusto: "",
  cidade: "",
  estado: "",
  regiao: "",
  ipva: "",
  seguro: "",
  licenciamento: "",
  vigenciaInicio: "",
  vigenciaFim: "",
  inativarAposVigencia: false,
};

function asNumber(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Documento bruto (banco) → estado do formulário, para o modo edição. */
function paraFormState(d: Record<string, unknown>): FormState {
  const num = (...vs: unknown[]) => {
    const v = vs.find((x) => x === 0 || (x !== undefined && x !== null && x !== ""));
    return v === undefined ? "" : String(v);
  };
  const st = asStr(d.status).toLowerCase();
  return {
    placa: asStr(d.placa),
    chassis: asStr(d.chassis),
    renavam: asStr(d.renavam),
    numeroSerie: asStr(d.numeroSerie),
    patrimonioBase: asStr(d.patrimonioBase),
    marca: asStr(d.marca),
    modelo: asStr(d.modelo) || asStr(d.descricao),
    cor: asStr(d.cor),
    combustivel: asStr(d.combustivel) || COMBUSTIVEL_OPTIONS[0],
    tipo: asStr(d.tipo) || TIPO_OPTIONS[0],
    tipoFrota: asStr(d.tipoFrota) || FROTA_OPTIONS[0],
    motorizacao: asStr(d.motorizacao),
    anoFabricacao: asStr(d.anoFabricacao) || asStr(d.ano),
    anoModelo: asStr(d.anoModelo),
    capacidadeTanque: num(d.capacidadeTanque),
    valorVeiculo: num(d.valorVeiculo),
    status:
      st === "bloqueado" || st === "inativo"
        ? (st as StatusEquipamento)
        : "ativo",
    medicaoAtual: num(d.medicaoAtual, d.currentMeter) || "0",
    intervaloRevisao: num(d.intervaloRevisao),
    condutorResponsavel: asStr(d.condutorResponsavel),
    gestorResponsavel: asStr(d.gestorResponsavel),
    centroCusto: asStr(d.centroCusto),
    cidade: asStr(d.cidade),
    estado: asStr(d.estado),
    regiao: asStr(d.regiao),
    ipva: asStr(d.ipva),
    seguro: asStr(d.seguro),
    licenciamento: asStr(d.licenciamento),
    vigenciaInicio: asStr(d.vigenciaInicio),
    vigenciaFim: asStr(d.vigenciaFim),
    inativarAposVigencia: Boolean(d.inativarAposVigencia),
  };
}

export function EquipamentoFormPage({ prefeituraId, modo }: Props) {
  const navigate = useNavigate();
  const { equipId } = useParams<{ equipId?: string }>();
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(modo === "editar");
  const [config, setConfig] = useState<Configuracao | null>(null);

  // Intervalos de revisão padrão da prefeitura (Configurações).
  useEffect(() => {
    let ativo = true;
    configuracoesApi
      .obter(prefeituraId)
      .then((c) => ativo && setConfig(c))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [prefeituraId]);

  const ehLocada = form.tipoFrota.toLowerCase().includes("locad");

  // Em "editar", carrega o equipamento e preenche o formulário.
  useEffect(() => {
    if (modo !== "editar" || !equipId) return;
    let ativo = true;
    (async () => {
      setCarregando(true);
      try {
        const doc = await equipamentosApi.obter(equipId);
        if (!ativo) return;
        if (!doc) {
          toast.error("Equipamento não encontrado.");
          voltar();
          return;
        }
        setForm(paraFormState(doc));
      } catch (err) {
        if (!ativo) return;
        console.error("[Prefeitura Equipamentos] Erro ao carregar:", err);
        toast.error("Não foi possível carregar o equipamento.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, equipId]);

  function setCampo<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((s) => ({ ...s, [k]: v }));
    setErros((e) => (e[k] ? { ...e, [k]: "" } : e));
  }

  function voltar() {
    navigate(`/prefeitura/${prefeituraId}/equipamentos`);
  }

  function validar(): Record<string, string> {
    // Apenas o essencial é obrigatório: chassi, número de série e a leitura
    // atual (KM/horímetro). O resto é opcional para agilizar o cadastro.
    const obrigatorios: (keyof FormState)[] = [
      "chassis",
      "numeroSerie",
      "medicaoAtual",
    ];
    const novos: Record<string, string> = {};
    for (const campo of obrigatorios) {
      const valor = form[campo];
      if (typeof valor === "string" && !valor.trim()) {
        novos[campo] = "Obrigatório";
      }
    }
    return novos;
  }

  async function salvar() {
    const novos = validar();
    if (Object.keys(novos).length) {
      setErros(novos);
      toast.error("Preencha os campos obrigatórios destacados.");
      return;
    }
    setSalvando(true);
    try {
      const tipo = form.tipo;
      const intervalo =
        asNumber(form.intervaloRevisao) ||
        config?.intervalos[categoriaDoTipo(tipo)]?.valor ||
        defaultInterval(tipo, unitForTipo(tipo));
      const input: NovoEquip = {
        placa: form.placa.trim(),
        chassis: form.chassis.trim(),
        renavam: form.renavam.trim(),
        numeroSerie: form.numeroSerie.trim(),
        patrimonioBase: form.patrimonioBase.trim(),
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        cor: form.cor.trim(),
        combustivel: form.combustivel,
        tipo,
        tipoFrota: form.tipoFrota,
        motorizacao: form.motorizacao.trim(),
        anoFabricacao: form.anoFabricacao.trim(),
        anoModelo: form.anoModelo.trim(),
        capacidadeTanque: asNumber(form.capacidadeTanque),
        valorVeiculo: asNumber(form.valorVeiculo),
        status: form.status,
        medicaoAtual: asNumber(form.medicaoAtual),
        intervaloRevisao: intervalo,
        condutorResponsavel: form.condutorResponsavel.trim(),
        gestorResponsavel: form.gestorResponsavel.trim(),
        centroCusto: form.centroCusto.trim(),
        cidade: form.cidade.trim(),
        estado: form.estado,
        regiao: form.regiao.trim(),
        ipva: form.ipva,
        seguro: form.seguro,
        licenciamento: form.licenciamento,
        vigenciaInicio: ehLocada ? form.vigenciaInicio : "",
        vigenciaFim: ehLocada ? form.vigenciaFim : "",
        inativarAposVigencia: ehLocada ? form.inativarAposVigencia : false,
      };
      if (modo === "editar" && equipId) {
        await equipamentosApi.atualizar(equipId, input, prefeituraId);
        toast.success("Equipamento atualizado.");
      } else {
        await equipamentosApi.criar(input, prefeituraId);
        toast.success("Equipamento cadastrado.");
      }
      voltar();
    } catch (err) {
      console.error("[Prefeitura Equipamentos] Erro ao cadastrar:", err);
      toast.error(
        err instanceof Error ? err.message : "Não foi possível cadastrar.",
      );
    } finally {
      setSalvando(false);
    }
  }

  // --- Helpers de render ---
  const texto = (
    k: keyof FormState,
    label: string,
    opts: { req?: boolean; placeholder?: string; numeric?: boolean } = {},
  ) => (
    <Campo label={label} req={opts.req} erro={erros[k]}>
      <input
        value={String(form[k] ?? "")}
        inputMode={opts.numeric ? "numeric" : undefined}
        placeholder={opts.placeholder}
        onChange={(e) => setCampo(k, e.target.value as never)}
      />
    </Campo>
  );

  const data = (k: keyof FormState, label: string, req?: boolean) => (
    <Campo label={label} req={req} erro={erros[k]}>
      <input
        type="date"
        value={String(form[k] ?? "")}
        onChange={(e) => setCampo(k, e.target.value as never)}
      />
    </Campo>
  );

  const select = (
    k: keyof FormState,
    label: string,
    options: { value: string; label: string }[],
    req?: boolean,
  ) => {
    // Radix não aceita item com value vazio — o "" vira placeholder.
    const placeholder = options.find((o) => o.value === "")?.label ?? "Selecione";
    const items = options.filter((o) => o.value !== "");
    return (
      <Campo label={label} req={req} erro={erros[k]}>
        <Select
          value={String(form[k] ?? "")}
          onValueChange={(v) => setCampo(k, v as never)}
        >
          <SelectTrigger className="w-full border-white/15 bg-white/[0.04] text-slate-100 data-[placeholder]:text-slate-400">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {items.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Campo>
    );
  };

  const opts = (arr: string[]) => arr.map((v) => ({ value: v, label: v }));

  if (carregando) {
    return (
      <div className="ff">
        <div className="ff__topo">
          <button type="button" className="ff__voltar" onClick={voltar}>
            <ArrowLeft size={15} /> Voltar
          </button>
          <h1 className="ff__titulo">Editar equipamento</h1>
        </div>
        <p className="ff__carregando">Carregando equipamento...</p>
      </div>
    );
  }

  return (
    <div className="ff">
      <div className="ff__topo">
        <button type="button" className="ff__voltar" onClick={voltar}>
          <ArrowLeft size={15} /> Voltar
        </button>
        <h1 className="ff__titulo">
          {modo === "editar" ? "Editar equipamento" : "Novo equipamento"}
        </h1>
      </div>

      <section className="ff__card">
        <div className="ff__card-head">
          <h2>Identificação</h2>
        </div>
        <div className="ff__grid">
          {texto("placa", "Placa nova", { placeholder: "ABC-1234" })}
          {texto("chassis", "Chassi", {
            req: true,
            placeholder: "9BWZZZ...",
          })}
          {texto("renavam", "Renavam")}
          {texto("numeroSerie", "Número de série", { req: true })}
          {texto("patrimonioBase", "Patrimônio / base")}
        </div>
      </section>

      <section className="ff__card">
        <div className="ff__card-head">
          <h2>Veículo</h2>
        </div>
        <div className="ff__grid">
          {texto("marca", "Marca")}
          {texto("modelo", "Modelo")}
          {texto("cor", "Cor")}
          {select("combustivel", "Combustível", opts(COMBUSTIVEL_OPTIONS))}
          {select("tipo", "Tipo de veículo", opts(TIPO_OPTIONS))}
          {select("tipoFrota", "Tipo de frota", opts(FROTA_OPTIONS))}
          {texto("motorizacao", "Motorização")}
          {texto("anoFabricacao", "Ano de fabricação", {
            numeric: true,
            placeholder: "2022",
          })}
          {texto("anoModelo", "Ano do modelo", {
            numeric: true,
            placeholder: "2023",
          })}
          {texto("capacidadeTanque", "Capacidade do tanque (L)", {
            numeric: true,
          })}
          {texto("valorVeiculo", "Valor do veículo (R$)", { numeric: true })}
        </div>
      </section>

      <section className="ff__card">
        <div className="ff__card-head">
          <h2>Operação e revisão</h2>
        </div>
        <div className="ff__grid">
          {select("status", "Status", STATUS_OPTIONS)}
          {texto("medicaoAtual", "KM / horímetro atual", {
            req: true,
            numeric: true,
          })}
          {texto("intervaloRevisao", "Intervalo entre revisões", {
            numeric: true,
            placeholder: "0 = padrão por tipo",
          })}
          {texto("condutorResponsavel", "Condutor responsável")}
          {texto("gestorResponsavel", "Gestor responsável")}
        </div>
      </section>

      <section className="ff__card">
        <div className="ff__card-head">
          <h2>Localização</h2>
        </div>
        <div className="ff__grid">
          {texto("centroCusto", "Base / nº centro de custo")}
          {texto("cidade", "Cidade")}
          {select("estado", "Estado (UF)", [
            { value: "", label: "—" },
            ...opts(UF_OPTIONS),
          ])}
          {texto("regiao", "Região")}
        </div>
      </section>

      <section className="ff__card">
        <div className="ff__card-head">
          <h2>Documentos</h2>
        </div>
        <div className="ff__grid">
          {data("ipva", "Vencimento IPVA")}
          {data("seguro", "Vencimento do seguro")}
          {data("licenciamento", "Vencimento do licenciamento")}
        </div>
      </section>

      {ehLocada ? (
        <section className="ff__card ff__card--acento">
          <div className="ff__card-head">
            <h2>Locação</h2>
          </div>
          <div className="ff__grid">
            {data("vigenciaInicio", "Início da vigência")}
            {data("vigenciaFim", "Fim da vigência")}
            <Campo label="Inativar após fim da vigência">
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.82rem",
                  color: "#e8ecf6",
                }}
              >
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={form.inativarAposVigencia}
                  onChange={(e) =>
                    setCampo("inativarAposVigencia", e.target.checked)
                  }
                />
                Inativar automaticamente
              </label>
            </Campo>
          </div>
        </section>
      ) : null}

      <div className="ff__rodape">
        <button type="button" className="ff__btn" onClick={voltar}>
          Cancelar
        </button>
        <button
          type="button"
          className="ff__btn ff__btn--primary"
          disabled={salvando}
          onClick={salvar}
        >
          <Save size={15} />{" "}
          {salvando
            ? "Salvando..."
            : modo === "editar"
              ? "Salvar alterações"
              : "Cadastrar equipamento"}
        </button>
      </div>
    </div>
  );
}

function Campo({
  label,
  req,
  erro,
  children,
}: {
  label: string;
  req?: boolean;
  erro?: string;
  children: ReactNode;
}) {
  return (
    <div className="ff__campo">
      <label>
        {label}
        {req ? <span className="ff__obrig">*</span> : null}
      </label>
      {children}
      {erro ? <span className="ff__erro">{erro}</span> : null}
    </div>
  );
}
