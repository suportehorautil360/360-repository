import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  IdCard,
  Lock,
  Save,
  UserCog,
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import {
  funcionariosApi,
  TIPOS_FUNCIONARIO,
  CNH_CATEGORIAS,
  gerarLogin,
  type Funcionario,
  type FuncionarioInput,
  type FuncionarioStatus,
  type FuncionarioTipo,
} from "../../../lib/funcionarios/funcionarios";
import { cpfValido, formatarCpf, limparCpf } from "../../../lib/funcionarios/cpf";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import "./funcionario-form.css";

const SELECT_TRIGGER_CLS =
  "w-full border-white/15 bg-white/[0.04] text-slate-100 data-[placeholder]:text-slate-400";

const CARGOS = [
  "Operador",
  "Motorista",
  "Mecânico",
  "Supervisor",
  "Outro",
];

/** Cargos predefinidos (sem o "Outro", que abre digitação livre). */
const CARGOS_PREDEF = CARGOS.filter((c) => c !== "Outro");

type Modo = "novo" | "editar";

interface FormState {
  nome: string;
  cpf: string;
  matricula: string;
  dataNascimento: string;
  rg: string;
  telefone: string;
  cargo: string;
  status: FuncionarioStatus;
  cnh: string;
  cnhCategoria: string;
  cnhLocalEmissao: string;
  cnhEmissao: string;
  cnhValidade: string;
  cnhRestricao: string;
  tipo: FuncionarioTipo;
  observacoes: string;
}

const FORM_VAZIO: FormState = {
  nome: "",
  cpf: "",
  matricula: "",
  dataNascimento: "",
  rg: "",
  telefone: "",
  cargo: CARGOS[0],
  status: "ativo",
  cnh: "",
  cnhCategoria: "",
  cnhLocalEmissao: "",
  cnhEmissao: "",
  cnhValidade: "",
  cnhRestricao: "",
  tipo: "operador",
  observacoes: "",
};

function paraFormState(f: Funcionario): FormState {
  return {
    nome: f.nome,
    cpf: f.cpf,
    matricula: f.matricula ?? "",
    dataNascimento: f.dataNascimento ?? "",
    rg: f.rg ?? "",
    telefone: f.telefone ?? "",
    cargo: f.cargo || CARGOS[0],
    status: f.status,
    cnh: f.cnh ?? "",
    cnhCategoria: f.cnhCategoria ?? "",
    cnhLocalEmissao: f.cnhLocalEmissao ?? "",
    cnhEmissao: f.cnhEmissao ?? "",
    cnhValidade: f.cnhValidade ?? "",
    cnhRestricao: f.cnhRestricao ?? "",
    tipo: f.tipo,
    observacoes: f.observacoes ?? "",
  };
}

interface Props {
  prefeituraId: string;
  modo: Modo;
}

export function FuncionarioFormPage({ prefeituraId, modo }: Props) {
  const navigate = useNavigate();
  const { funcId } = useParams<{ funcId?: string }>();

  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [carregando, setCarregando] = useState(modo === "editar");
  const [salvando, setSalvando] = useState(false);
  const [resetandoSenha, setResetandoSenha] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState("");

  // Em "editar", carrega o funcionário antes de pintar o form.
  useEffect(() => {
    if (modo !== "editar" || !funcId) return;
    let ativo = true;
    (async () => {
      setCarregando(true);
      try {
        const f = await funcionariosApi.obter(funcId);
        if (!ativo) return;
        if (!f) {
          setErroGeral("Funcionário não encontrado.");
        } else {
          setForm(paraFormState(f));
        }
      } catch (e) {
        if (!ativo) return;
        setErroGeral(e instanceof Error ? e.message : "Erro ao carregar.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [modo, funcId]);

  const setCampo = useCallback(
    <K extends keyof FormState>(k: K, v: FormState[K]) =>
      setForm((s) => ({ ...s, [k]: v })),
    [],
  );

  const loginGerado = useMemo(
    () => gerarLogin(form.nome, form.cpf),
    [form.nome, form.cpf],
  );
  const senhaInicial = useMemo(() => limparCpf(form.cpf), [form.cpf]);

  function voltar() {
    navigate(`/prefeitura/${prefeituraId}/funcionarios`);
  }

  async function resetarSenha() {
    if (modo !== "editar" || !funcId) return;
    const ok = window.confirm(
      "Resetar a senha deste funcionário para o CPF? Ele perderá a senha atual.",
    );
    if (!ok) return;
    setResetandoSenha(true);
    setResetMsg("");
    try {
      await funcionariosApi.resetarSenha(funcId);
      setResetMsg("Senha resetada para o CPF.");
    } catch (e) {
      setResetMsg(e instanceof Error ? e.message : "Erro ao resetar a senha.");
    } finally {
      setResetandoSenha(false);
    }
  }

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Informe o nome completo.";
    if (!cpfValido(form.cpf)) e.cpf = "CPF inválido.";
    // Matrícula é opcional.
    if (!form.dataNascimento) e.dataNascimento = "Informe a data de nascimento.";
    if (!form.cargo.trim()) e.cargo = "Informe o cargo.";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function salvar() {
    setErroGeral("");
    if (!validar()) return;
    setSalvando(true);
    try {
      const emUso = await funcionariosApi.cpfEmUso(
        prefeituraId,
        form.cpf,
        modo === "editar" ? funcId : undefined,
      );
      if (emUso) {
        setErros((p) => ({ ...p, cpf: "Já existe um funcionário com esse CPF." }));
        return;
      }
      const input: FuncionarioInput = {
        nome: form.nome,
        cpf: form.cpf,
        cargo: form.cargo,
        telefone: form.telefone,
        tipo: form.tipo,
        status: form.status,
        matricula: form.matricula,
        dataNascimento: form.dataNascimento,
        rg: form.rg,
        cnh: form.cnh,
        cnhCategoria: form.cnhCategoria,
        cnhValidade: form.cnhValidade,
        cnhLocalEmissao: form.cnhLocalEmissao,
        cnhEmissao: form.cnhEmissao,
        cnhRestricao: form.cnhRestricao,
        observacoes: form.observacoes,
      };
      if (modo === "editar" && funcId) {
        await funcionariosApi.atualizar(funcId, input);
      } else {
        await funcionariosApi.criar(prefeituraId, input);
      }
      voltar();
    } catch (e) {
      setErroGeral(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <p className="ff__carregando">Carregando funcionário…</p>;
  }

  return (
    <div className="ff">
      <header className="ff__topo">
        <button type="button" className="ff__voltar" onClick={voltar}>
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar
        </button>
        <h1 className="ff__titulo">
          {modo === "editar" ? "Editar Funcionário" : "Novo Funcionário"}
        </h1>
      </header>

      {erroGeral && (
        <div className="ff__alerta" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{erroGeral}</span>
        </div>
      )}

      <section className="ff__card">
        <header className="ff__card-head">
          <IdCard size={16} aria-hidden="true" />
          <h2>Dados Pessoais</h2>
        </header>
        <div className="ff__grid">
          <Campo label="Matrícula" erro={erros.matricula} wide={1}>
            <input
              type="text"
              placeholder="Ex: 001"
              value={form.matricula}
              onChange={(e) => setCampo("matricula", e.target.value)}
            />
          </Campo>
          <Campo
            label="Nome Completo"
            obrig
            erro={erros.nome}
            wide={2}
          >
            <input
              type="text"
              placeholder="Nome do funcionário"
              value={form.nome}
              onChange={(e) => setCampo("nome", e.target.value)}
            />
          </Campo>
          <Campo
            label="Data de Nascimento"
            obrig
            erro={erros.dataNascimento}
            wide={1}
          >
            <input
              type="date"
              value={form.dataNascimento}
              onChange={(e) => setCampo("dataNascimento", e.target.value)}
            />
          </Campo>

          <Campo label="CPF" obrig erro={erros.cpf} wide={1}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={formatarCpf(form.cpf)}
              onChange={(e) => setCampo("cpf", limparCpf(e.target.value))}
            />
          </Campo>
          <Campo label="RG" wide={1}>
            <input
              type="text"
              placeholder="Ex: 12.345.678-9"
              value={form.rg}
              onChange={(e) => setCampo("rg", e.target.value)}
            />
          </Campo>
          <Campo label="Celular" wide={1}>
            <input
              type="tel"
              inputMode="tel"
              placeholder="(00) 00000-0000"
              value={form.telefone}
              onChange={(e) => setCampo("telefone", e.target.value)}
            />
          </Campo>

          <Campo label="Cargo" obrig erro={erros.cargo} wide={2}>
            <Select
              value={CARGOS_PREDEF.includes(form.cargo) ? form.cargo : "Outro"}
              onValueChange={(v) => {
                // "Outro" → entra em digitação livre (limpa só se vinha de um
                // cargo predefinido, pra não apagar o que já foi digitado).
                if (v === "Outro") {
                  if (CARGOS_PREDEF.includes(form.cargo)) setCampo("cargo", "");
                } else {
                  setCampo("cargo", v);
                }
              }}
            >
              <SelectTrigger className={SELECT_TRIGGER_CLS}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {CARGOS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!CARGOS_PREDEF.includes(form.cargo) && (
              <input
                type="text"
                placeholder="Digite o cargo"
                value={form.cargo}
                onChange={(e) => setCampo("cargo", e.target.value)}
                style={{ marginTop: 8 }}
              />
            )}
          </Campo>
          <Campo label="Status" wide={1}>
            <Select
              value={form.status}
              onValueChange={(v) =>
                setCampo("status", v as FuncionarioStatus)
              }
            >
              <SelectTrigger className={SELECT_TRIGGER_CLS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
        </div>
      </section>

      <div className="ff__col2">
        <section className="ff__card">
          <header className="ff__card-head">
            <IdCard size={16} aria-hidden="true" />
            <h2>Habilitação (CNH)</h2>
          </header>
          <div className="ff__grid">
            <Campo label="Nº CNH" wide={1}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Número da CNH"
                value={form.cnh}
                onChange={(e) =>
                  setCampo("cnh", e.target.value.replace(/\D/g, ""))
                }
              />
            </Campo>
            <Campo label="Categoria CNH" wide={1}>
              <Select
                value={form.cnhCategoria || "__none__"}
                onValueChange={(v) =>
                  setCampo("cnhCategoria", v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className={SELECT_TRIGGER_CLS}>
                  <SelectValue placeholder="Sem CNH" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem CNH</SelectItem>
                  {CNH_CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo label="Local de Emissão CNH" wide={1}>
              <input
                type="text"
                placeholder="Ex: SP, MG..."
                value={form.cnhLocalEmissao}
                onChange={(e) => setCampo("cnhLocalEmissao", e.target.value)}
              />
            </Campo>
            <Campo label="Emissão CNH" wide={1}>
              <input
                type="date"
                value={form.cnhEmissao}
                onChange={(e) => setCampo("cnhEmissao", e.target.value)}
              />
            </Campo>

            <Campo label="Validade CNH" wide={1}>
              <input
                type="date"
                value={form.cnhValidade}
                onChange={(e) => setCampo("cnhValidade", e.target.value)}
              />
            </Campo>
            <Campo label="Restrição / Observação" wide={1}>
              <input
                type="text"
                placeholder="Ex: Usa óculos"
                value={form.cnhRestricao}
                onChange={(e) => setCampo("cnhRestricao", e.target.value)}
              />
            </Campo>
          </div>
        </section>

        <section className="ff__card ff__card--acento">
          <header className="ff__card-head">
            <Lock size={16} aria-hidden="true" />
            <h2>Acesso ao Sistema</h2>
          </header>

          <div className="ff__credenciais">
            <span className="ff__credenciais-rotulo">
              Credenciais geradas automaticamente
            </span>
            <div className="ff__credenciais-grid">
              <div className="ff__cred">
                <label>Login (usuário)</label>
                <output className="ff__cred-valor">
                  {loginGerado || "—"}
                </output>
              </div>
              <div className="ff__cred">
                <label>Senha inicial (CPF)</label>
                <output className="ff__cred-valor ff__cred-valor--ok">
                  {senhaInicial || "—"}
                </output>
              </div>
            </div>
            <p className="ff__credenciais-dica">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>
                Login = <strong>primeiro nome</strong> +{" "}
                <strong>3 últimos dígitos do CPF</strong>. A senha é o{" "}
                <strong>CPF sem pontuação</strong>.
              </span>
            </p>

            {modo === "editar" && (
              <div className="ff__reset">
                <button
                  type="button"
                  className="ff__btn"
                  disabled={resetandoSenha}
                  onClick={() => void resetarSenha()}
                  title="Volta a senha do funcionário para o CPF"
                >
                  <KeyRound size={14} aria-hidden="true" />
                  {resetandoSenha ? "Resetando…" : "Resetar senha para o CPF"}
                </button>
                {resetMsg && <span className="ff__reset-msg">{resetMsg}</span>}
              </div>
            )}
          </div>

          <div className="ff__grid ff__grid--apertado">
            <Campo
              label="Perfil de Acesso"
              wide={2}
              icone={<UserCog size={14} aria-hidden="true" />}
            >
              <Select
                value={form.tipo}
                onValueChange={(v) => setCampo("tipo", v as FuncionarioTipo)}
              >
                <SelectTrigger className={SELECT_TRIGGER_CLS}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_FUNCIONARIO.map((t) => (
                    <SelectItem key={t.tipo} value={t.tipo}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>

          <Campo label="Observações" wide={3}>
            <textarea
              rows={3}
              placeholder="Observações adicionais…"
              value={form.observacoes}
              onChange={(e) => setCampo("observacoes", e.target.value)}
            />
          </Campo>
        </section>
      </div>

      <footer className="ff__rodape">
        <button
          type="button"
          className="ff__btn ff__btn--primary"
          disabled={salvando}
          onClick={() => void salvar()}
        >
          <Save size={16} aria-hidden="true" />
          {salvando
            ? "Salvando…"
            : modo === "editar"
              ? "Salvar alterações"
              : "Salvar Funcionário"}
        </button>
        <button type="button" className="ff__btn" onClick={voltar}>
          Cancelar
        </button>
      </footer>
    </div>
  );
}

/** Campo de formulário com label, asterisco de obrigatório e erro inline. */
function Campo({
  label,
  children,
  obrig,
  erro,
  wide = 1,
  icone,
}: {
  label: string;
  children: React.ReactNode;
  obrig?: boolean;
  erro?: string;
  /** 1 = uma coluna, 2 = duas, 3 = full row. */
  wide?: 1 | 2 | 3;
  icone?: React.ReactNode;
}) {
  return (
    <div className={`ff__campo ff__campo--w${wide}`}>
      <label>
        {icone}
        <span>
          {label}
          {obrig && <span className="ff__obrig">*</span>}
        </span>
      </label>
      {children}
      {erro && <span className="ff__erro">{erro}</span>}
    </div>
  );
}
