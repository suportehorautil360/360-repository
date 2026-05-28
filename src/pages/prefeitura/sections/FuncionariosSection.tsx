import { useCallback, useEffect, useMemo, useState } from "react";
import {
  funcionariosApi,
  TIPOS_FUNCIONARIO,
  type Funcionario,
  type FuncionarioInput,
  type FuncionarioStatus,
  type FuncionarioTipo,
} from "../../../lib/funcionarios/funcionarios";
import { cpfValido, formatarCpf, limparCpf } from "../../../lib/funcionarios/cpf";
import "./funcionarios.css";

const CARGOS = ["Operador de Máquinas", "Motorista", "Mecânico", "Supervisor", "Outro"];

const TIPO_LABEL: Record<FuncionarioTipo, string> = {
  operador: "Operador",
  supervisor: "Supervisor",
  admin: "Administrador",
};

interface FormState {
  id: string | null;
  nome: string;
  cpf: string;
  cargo: string;
  telefone: string;
  tipo: FuncionarioTipo;
  status: FuncionarioStatus;
  senha: string;
}

const FORM_VAZIO: FormState = {
  id: null,
  nome: "",
  cpf: "",
  cargo: CARGOS[0],
  telefone: "",
  tipo: "operador",
  status: "ativo",
  senha: "",
};

export function FuncionariosSection({ prefeituraId }: { prefeituraId: string }) {
  const [lista, setLista] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | FuncionarioStatus>(
    "todos",
  );
  const [filtroTipo, setFiltroTipo] = useState<"todos" | FuncionarioTipo>("todos");

  const [form, setForm] = useState<FormState | null>(null);
  const [formMsg, setFormMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setCarregando(true);
    setErro("");
    try {
      setLista(await funcionariosApi.listar(prefeituraId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = limparCpf(busca) || busca.trim().toLowerCase();
    const ehCpf = /\d/.test(busca);
    return lista.filter((f) => {
      if (filtroStatus !== "todos" && f.status !== filtroStatus) return false;
      if (filtroTipo !== "todos" && f.tipo !== filtroTipo) return false;
      if (!busca.trim()) return true;
      if (ehCpf) return f.cpf.includes(termo);
      return f.nome.toLowerCase().includes(termo);
    });
  }, [lista, busca, filtroStatus, filtroTipo]);

  function abrirNovo() {
    setFormMsg("");
    setForm({ ...FORM_VAZIO });
  }

  function abrirEdicao(f: Funcionario) {
    setFormMsg("");
    setForm({
      id: f.id,
      nome: f.nome,
      cpf: f.cpf,
      cargo: f.cargo || CARGOS[0],
      telefone: f.telefone ?? "",
      tipo: f.tipo,
      status: f.status,
      senha: "",
    });
  }

  function fecharForm() {
    setForm(null);
    setFormMsg("");
  }

  async function salvar() {
    if (!form) return;
    setFormMsg("");

    if (!form.nome.trim()) return setFormMsg("Informe o nome completo.");
    if (!cpfValido(form.cpf)) return setFormMsg("CPF inválido.");
    // Senha obrigatória no cadastro novo; na edição só se for trocar.
    if (!form.id && form.senha.length < 4)
      return setFormMsg("Defina uma senha de pelo menos 4 caracteres.");
    if (form.id && form.senha && form.senha.length < 4)
      return setFormMsg("A nova senha precisa ter pelo menos 4 caracteres.");

    setSalvando(true);
    try {
      const emUso = await funcionariosApi.cpfEmUso(
        prefeituraId,
        form.cpf,
        form.id ?? undefined,
      );
      if (emUso) {
        setFormMsg("Já existe um funcionário com esse CPF.");
        return;
      }
      const input: FuncionarioInput = {
        nome: form.nome,
        cpf: form.cpf,
        cargo: form.cargo,
        telefone: form.telefone,
        tipo: form.tipo,
        status: form.status,
        senha: form.senha || undefined,
      };
      if (form.id) await funcionariosApi.atualizar(form.id, input);
      else await funcionariosApi.criar(prefeituraId, input);
      fecharForm();
      await carregar();
    } catch (e) {
      setFormMsg(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarStatus(f: Funcionario) {
    setOcupadoId(f.id);
    try {
      await funcionariosApi.definirStatus(
        f.id,
        f.status === "ativo" ? "inativo" : "ativo",
      );
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao mudar status.");
    } finally {
      setOcupadoId(null);
    }
  }

  return (
    <div className="func">
      <header className="func__head">
        <div>
          <h1>Funcionários</h1>
          <p className="func__lead">
            Cadastre quem usa o sistema em campo. O funcionário acessa o
            checklist com <strong>CPF e senha</strong> e gera ponto
            automaticamente — disponível nas próximas fases.
          </p>
        </div>
        <button type="button" className="func__btn func__btn--primary" onClick={abrirNovo}>
          + Novo funcionário
        </button>
      </header>

      <div className="func__filtros">
        <input
          type="search"
          className="func__busca"
          placeholder="Buscar por nome ou CPF…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          value={filtroStatus}
          onChange={(e) =>
            setFiltroStatus(e.target.value as "todos" | FuncionarioStatus)
          }
        >
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
        </select>
        <select
          value={filtroTipo}
          onChange={(e) =>
            setFiltroTipo(e.target.value as "todos" | FuncionarioTipo)
          }
        >
          <option value="todos">Todos os tipos</option>
          {TIPOS_FUNCIONARIO.map((t) => (
            <option key={t.tipo} value={t.tipo}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {erro && <p className="func__msg func__msg--err">{erro}</p>}

      {carregando ? (
        <p className="func__msg">Carregando funcionários…</p>
      ) : filtrados.length === 0 ? (
        <p className="func__msg">
          {lista.length === 0
            ? "Nenhum funcionário cadastrado ainda."
            : "Nenhum funcionário corresponde aos filtros."}
        </p>
      ) : (
        <ul className="func__lista">
          {filtrados.map((f) => (
            <li key={f.id} className={`func__card func__card--${f.status}`}>
              <div className="func__info">
                <strong className="func__nome">{f.nome || "(sem nome)"}</strong>
                <span className="func__sub">
                  {f.cpf ? formatarCpf(f.cpf) : "CPF não informado"}
                  {f.cargo ? ` · ${f.cargo}` : ""}
                </span>
                <div className="func__tags">
                  <span className={`func__tag func__tag--${f.tipo}`}>
                    {TIPO_LABEL[f.tipo]}
                  </span>
                  <span className={`func__tag func__tag--st-${f.status}`}>
                    {f.status === "ativo" ? "Ativo" : "Inativo"}
                  </span>
                  {!f.temSenha && (
                    <span className="func__tag func__tag--alerta">Sem senha</span>
                  )}
                </div>
              </div>
              <div className="func__acoes">
                <button
                  type="button"
                  className="func__btn"
                  onClick={() => abrirEdicao(f)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={`func__btn ${f.status === "ativo" ? "func__btn--warn" : "func__btn--ok"}`}
                  disabled={ocupadoId === f.id}
                  onClick={() => void alternarStatus(f)}
                >
                  {f.status === "ativo" ? "Inativar" : "Ativar"}
                </button>
                <button
                  type="button"
                  className="func__btn func__btn--ghost"
                  disabled
                  title="Disponível na Fase 3 (jornada automática)"
                >
                  Histórico de ponto
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <div className="func__modal" role="presentation" onClick={fecharForm}>
          <div
            className="func__dialog"
            role="dialog"
            aria-modal="true"
            aria-label={form.id ? "Editar funcionário" : "Novo funcionário"}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{form.id ? "Editar funcionário" : "Novo funcionário"}</h2>

            <label>Nome completo *</label>
            <input
              type="text"
              value={form.nome}
              placeholder="Ex: José Ferreira"
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />

            <label>CPF *</label>
            <input
              type="text"
              inputMode="numeric"
              value={formatarCpf(form.cpf)}
              placeholder="000.000.000-00"
              onChange={(e) =>
                setForm({ ...form, cpf: limparCpf(e.target.value) })
              }
            />

            <div className="func__row">
              <div>
                <label>Cargo / Função</label>
                <select
                  value={form.cargo}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                >
                  {CARGOS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Tipo de usuário</label>
                <select
                  value={form.tipo}
                  onChange={(e) =>
                    setForm({ ...form, tipo: e.target.value as FuncionarioTipo })
                  }
                >
                  {TIPOS_FUNCIONARIO.map((t) => (
                    <option key={t.tipo} value={t.tipo}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label>Telefone</label>
            <input
              type="tel"
              inputMode="tel"
              value={form.telefone}
              placeholder="(00) 00000-0000"
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />

            <label>
              {form.id ? "Nova senha (deixe em branco p/ manter)" : "Senha de acesso *"}
            </label>
            <input
              type="password"
              value={form.senha}
              placeholder={form.id ? "••••••" : "Mínimo 4 caracteres"}
              autoComplete="new-password"
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
            />

            <label className="func__check">
              <input
                type="checkbox"
                checked={form.status === "ativo"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.checked ? "ativo" : "inativo",
                  })
                }
              />
              Funcionário ativo (pode acessar o sistema)
            </label>

            {formMsg && <p className="func__msg func__msg--err">{formMsg}</p>}

            <div className="func__dialog-acoes">
              <button type="button" className="func__btn" onClick={fecharForm}>
                Cancelar
              </button>
              <button
                type="button"
                className="func__btn func__btn--primary"
                disabled={salvando}
                onClick={() => void salvar()}
              >
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
