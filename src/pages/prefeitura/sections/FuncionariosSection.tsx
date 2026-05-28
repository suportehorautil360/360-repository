import { useCallback, useEffect, useMemo, useState } from "react";
import {
  funcionariosApi,
  TIPOS_FUNCIONARIO,
  CNH_CATEGORIAS,
  type Funcionario,
  type FuncionarioInput,
  type FuncionarioStatus,
  type FuncionarioTipo,
} from "../../../lib/funcionarios/funcionarios";
import { cpfValido, formatarCpf, limparCpf } from "../../../lib/funcionarios/cpf";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import "./funcionarios.css";

const CARGOS = [
  "Operador de Máquinas",
  "Motorista",
  "Mecânico",
  "Supervisor",
  "Outro",
];

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
  matricula: string;
  cnh: string;
  cnhCategoria: string;
  cnhValidade: string;
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
  matricula: "",
  cnh: "",
  cnhCategoria: "",
  cnhValidade: "",
};

/** Formata a validade YYYY-MM-DD como DD/MM/AAAA (sem virar UTC). */
function fmtData(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

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
      if (ehCpf) return f.cpf.includes(termo) || (f.matricula ?? "").includes(termo);
      return (
        f.nome.toLowerCase().includes(termo) ||
        (f.matricula ?? "").toLowerCase().includes(termo)
      );
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
      matricula: f.matricula ?? "",
      cnh: f.cnh ?? "",
      cnhCategoria: f.cnhCategoria ?? "",
      cnhValidade: f.cnhValidade ?? "",
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
        matricula: form.matricula || undefined,
        cnh: form.cnh || undefined,
        cnhCategoria: form.cnhCategoria || undefined,
        cnhValidade: form.cnhValidade || undefined,
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

  const semCadastro = !carregando && lista.length === 0;

  return (
    <div className="func">
      <section className="func__card">
        <header className="func__card-head">
          <h2 className="func__card-titulo">
            <span aria-hidden="true">👥</span> Funcionários cadastrados
          </h2>
          <div className="func__card-acoes">
            <div className="func__busca">
              <span aria-hidden="true">🔍</span>
              <input
                type="search"
                placeholder="Buscar funcionário…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
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
            <button
              type="button"
              className="func__btn func__btn--primary"
              onClick={abrirNovo}
            >
              + Novo funcionário
            </button>
          </div>
        </header>

        {erro && <p className="func__msg func__msg--err">{erro}</p>}

        <div className="func__tabela-wrap">
          <table className="func__tabela">
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Nome</th>
                <th>Cargo</th>
                <th>Celular</th>
                <th>CPF</th>
                <th>CNH / Cat.</th>
                <th>Validade CNH</th>
                <th>Login</th>
                <th>Status</th>
                <th className="func__col-acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={10} className="func__vazio">
                    Carregando funcionários…
                  </td>
                </tr>
              ) : semCadastro ? (
                <tr>
                  <td colSpan={10} className="func__vazio">
                    <p>Nenhum funcionário cadastrado.</p>
                    <button
                      type="button"
                      className="func__btn func__btn--primary"
                      onClick={abrirNovo}
                    >
                      + Cadastrar primeiro
                    </button>
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={10} className="func__vazio">
                    Nenhum funcionário corresponde aos filtros.
                  </td>
                </tr>
              ) : (
                filtrados.map((f) => (
                  <tr
                    key={f.id}
                    className={f.status === "inativo" ? "is-inativo" : ""}
                  >
                    <td className="func__mono">{f.matricula || "—"}</td>
                    <td>
                      <strong>{f.nome || "(sem nome)"}</strong>
                      <span className={`func__tag-tipo func__tag-tipo--${f.tipo}`}>
                        {TIPO_LABEL[f.tipo]}
                      </span>
                    </td>
                    <td>{f.cargo || "—"}</td>
                    <td className="func__mono">{f.telefone || "—"}</td>
                    <td className="func__mono">
                      {f.cpf ? formatarCpf(f.cpf) : "—"}
                    </td>
                    <td className="func__mono">
                      {f.cnh ? `${f.cnh} / ${f.cnhCategoria || "—"}` : "—"}
                    </td>
                    <td className="func__mono">{fmtData(f.cnhValidade ?? "")}</td>
                    <td className="func__mono">
                      {f.temSenha && f.cpf ? formatarCpf(f.cpf) : (
                        <span className="func__sem-login">Sem senha</span>
                      )}
                    </td>
                    <td>
                      <span className={`func__tag func__tag--st-${f.status}`}>
                        {f.status === "ativo" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div className="func__acoes">
                        <button
                          type="button"
                          className="func__icone"
                          title="Editar"
                          aria-label={`Editar ${f.nome}`}
                          onClick={() => abrirEdicao(f)}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="func__icone"
                          title={f.status === "ativo" ? "Inativar" : "Ativar"}
                          aria-label={
                            f.status === "ativo"
                              ? `Inativar ${f.nome}`
                              : `Ativar ${f.nome}`
                          }
                          disabled={ocupadoId === f.id}
                          onClick={() => void alternarStatus(f)}
                        >
                          {f.status === "ativo" ? "⏸️" : "▶️"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={!!form}
        onOpenChange={(aberto) => {
          if (!aberto) fecharForm();
        }}
      >
        <DialogContent showCloseButton={false} className="func-dialog">
          <header className="func-dialog__head">
            <button
              type="button"
              className="func-dialog__voltar"
              aria-label="Voltar"
              onClick={fecharForm}
            >
              ‹
            </button>
            <DialogTitle asChild>
              <h2>{form?.id ? "Editar funcionário" : "Novo funcionário"}</h2>
            </DialogTitle>
          </header>

          {form && (
            <div className="func-dialog__body">
              <DialogDescription className="func-dialog__lead">
                Os campos marcados com * são obrigatórios. O funcionário entra no
                sistema pelo <strong>CPF</strong>; matrícula e CNH são opcionais.
              </DialogDescription>

              <label>Nome completo *</label>
              <input
                type="text"
                value={form.nome}
                placeholder="Ex: José Ferreira"
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />

              <div className="func-dialog__row">
                <div>
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
                </div>
                <div>
                  <label>Matrícula</label>
                  <input
                    type="text"
                    value={form.matricula}
                    placeholder="Ex: 001234"
                    onChange={(e) =>
                      setForm({ ...form, matricula: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="func-dialog__row">
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
                      setForm({
                        ...form,
                        tipo: e.target.value as FuncionarioTipo,
                      })
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

              <div className="func-dialog__row">
                <div>
                  <label>Celular</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.telefone}
                    placeholder="(00) 00000-0000"
                    onChange={(e) =>
                      setForm({ ...form, telefone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label>
                    {form.id
                      ? "Nova senha (vazio = manter)"
                      : "Senha de acesso *"}
                  </label>
                  <input
                    type="password"
                    value={form.senha}
                    placeholder={form.id ? "••••••" : "Mínimo 4 caracteres"}
                    autoComplete="new-password"
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  />
                </div>
              </div>

              <div className="func-dialog__row func-dialog__row--3">
                <div>
                  <label>CNH</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.cnh}
                    placeholder="Número"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        cnh: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </div>
                <div>
                  <label>Categoria</label>
                  <select
                    value={form.cnhCategoria}
                    onChange={(e) =>
                      setForm({ ...form, cnhCategoria: e.target.value })
                    }
                  >
                    <option value="">—</option>
                    {CNH_CATEGORIAS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Validade CNH</label>
                  <input
                    type="date"
                    value={form.cnhValidade}
                    onChange={(e) =>
                      setForm({ ...form, cnhValidade: e.target.value })
                    }
                  />
                </div>
              </div>

              <label className="func-dialog__check">
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

              {formMsg && (
                <p className="func__msg func__msg--err">{formMsg}</p>
              )}

              <div className="func-dialog__acoes">
                <button
                  type="button"
                  className="func__btn"
                  onClick={fecharForm}
                >
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
