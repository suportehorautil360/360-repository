import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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
import "./funcionario-form.css";

interface Props {
  prefeituraId: string;
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

export function EquipamentoFormPage({ prefeituraId }: Props) {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const ehLocada = form.tipoFrota.toLowerCase().includes("locad");

  function setCampo<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((s) => ({ ...s, [k]: v }));
    setErros((e) => (e[k] ? { ...e, [k]: "" } : e));
  }

  function voltar() {
    navigate(`/prefeitura/${prefeituraId}/equipamentos`);
  }

  function validar(): Record<string, string> {
    const obrigatorios: (keyof FormState)[] = [
      "placa",
      "chassis",
      "combustivel",
      "status",
      "marca",
      "modelo",
      "cor",
      "renavam",
      "numeroSerie",
      "medicaoAtual",
      "tipo",
      "tipoFrota",
      "patrimonioBase",
      "anoFabricacao",
      "anoModelo",
      "capacidadeTanque",
      "condutorResponsavel",
    ];
    // Campos de locação só são obrigatórios quando a frota é locada.
    if (ehLocada) {
      obrigatorios.push("vigenciaInicio", "vigenciaFim");
    }
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
      await equipamentosApi.criar(input, prefeituraId);
      toast.success("Equipamento cadastrado.");
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

  return (
    <div className="ff">
      <div className="ff__topo">
        <button type="button" className="ff__voltar" onClick={voltar}>
          <ArrowLeft size={15} /> Voltar
        </button>
        <h1 className="ff__titulo">Novo equipamento</h1>
      </div>

      <section className="ff__card">
        <div className="ff__card-head">
          <h2>Identificação</h2>
        </div>
        <div className="ff__grid">
          {texto("placa", "Placa nova", { req: true, placeholder: "ABC-1234" })}
          {texto("chassis", "Chassi", {
            req: true,
            placeholder: "9BWZZZ...",
          })}
          {texto("renavam", "Renavam", { req: true })}
          {texto("numeroSerie", "Número de série", { req: true })}
          {texto("patrimonioBase", "Patrimônio / base", { req: true })}
        </div>
      </section>

      <section className="ff__card">
        <div className="ff__card-head">
          <h2>Veículo</h2>
        </div>
        <div className="ff__grid">
          {texto("marca", "Marca", { req: true })}
          {texto("modelo", "Modelo", { req: true })}
          {texto("cor", "Cor", { req: true })}
          {select("combustivel", "Combustível", opts(COMBUSTIVEL_OPTIONS), true)}
          {select("tipo", "Tipo de veículo", opts(TIPO_OPTIONS), true)}
          {select("tipoFrota", "Tipo de frota", opts(FROTA_OPTIONS), true)}
          {texto("motorizacao", "Motorização")}
          {texto("anoFabricacao", "Ano de fabricação", {
            req: true,
            numeric: true,
            placeholder: "2022",
          })}
          {texto("anoModelo", "Ano do modelo", {
            req: true,
            numeric: true,
            placeholder: "2023",
          })}
          {texto("capacidadeTanque", "Capacidade do tanque (L)", {
            req: true,
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
          {select("status", "Status", STATUS_OPTIONS, true)}
          {texto("medicaoAtual", "KM / horímetro atual", {
            req: true,
            numeric: true,
          })}
          {texto("intervaloRevisao", "Intervalo entre revisões", {
            numeric: true,
            placeholder: "0 = padrão por tipo",
          })}
          {texto("condutorResponsavel", "Condutor responsável", { req: true })}
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
            {data("vigenciaInicio", "Início da vigência", true)}
            {data("vigenciaFim", "Fim da vigência", true)}
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
          <Save size={15} /> {salvando ? "Salvando..." : "Cadastrar equipamento"}
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
