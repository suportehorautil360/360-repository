import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Pause, Play, Plus, Search, History } from "lucide-react";
import {
  funcionariosApi,
  TIPOS_FUNCIONARIO,
  gerarLogin,
  type Funcionario,
  type FuncionarioStatus,
  type FuncionarioTipo,
} from "../../../lib/funcionarios/funcionarios";
import { formatarCpf, limparCpf } from "../../../lib/funcionarios/cpf";
import "./funcionarios.css";

const TIPO_LABEL: Record<FuncionarioTipo, string> = {
  operador: "Operador",
  supervisor: "Supervisor",
  admin: "Administrador",
};

/** Formata a validade YYYY-MM-DD como DD/MM/AAAA (sem virar UTC). */
function fmtData(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function FuncionariosSection({ prefeituraId }: { prefeituraId: string }) {
  const navigate = useNavigate();

  const [lista, setLista] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | FuncionarioStatus>(
    "todos",
  );
  const [filtroTipo, setFiltroTipo] = useState<"todos" | FuncionarioTipo>("todos");
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
    const ehNum = /\d/.test(busca);
    return lista.filter((f) => {
      if (filtroStatus !== "todos" && f.status !== filtroStatus) return false;
      if (filtroTipo !== "todos" && f.tipo !== filtroTipo) return false;
      if (!busca.trim()) return true;
      if (ehNum)
        return f.cpf.includes(termo) || (f.matricula ?? "").includes(termo);
      return (
        f.nome.toLowerCase().includes(termo) ||
        (f.matricula ?? "").toLowerCase().includes(termo)
      );
    });
  }, [lista, busca, filtroStatus, filtroTipo]);

  function irParaNovo() {
    navigate(`/prefeitura/${prefeituraId}/funcionarios/novo`);
  }
  function irParaEditar(id: string) {
    navigate(`/prefeitura/${prefeituraId}/funcionarios/${id}/editar`);
  }
  function irParaHistorico(id: string) {
    navigate(`/prefeitura/${prefeituraId}/funcionarios/${id}/historico`);
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
      <h1 className="func__page-titulo">Funcionários</h1>

      <section className="func__card">
        <header className="func__card-head">
          <h2 className="func__card-titulo">
            <span aria-hidden="true">👥</span> Funcionários cadastrados
          </h2>
          <div className="func__card-acoes">
            <div className="func__busca">
              <span aria-hidden="true">
                <Search size={14} />
              </span>
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
              onClick={irParaNovo}
            >
              <Plus size={14} aria-hidden="true" />
              Novo funcionário
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
                      onClick={irParaNovo}
                    >
                      <Plus size={14} aria-hidden="true" />
                      Cadastrar primeiro
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
                filtrados.map((f) => {
                  const login = f.temSenha ? gerarLogin(f.nome, f.cpf) : "";
                  return (
                    <tr
                      key={f.id}
                      className={f.status === "inativo" ? "is-inativo" : ""}
                    >
                      <td className="func__mono">{f.matricula || "—"}</td>
                      <td>
                        <strong>{f.nome || "(sem nome)"}</strong>
                        <span
                          className={`func__tag-tipo func__tag-tipo--${f.tipo}`}
                        >
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
                      <td className="func__mono">
                        {fmtData(f.cnhValidade ?? "")}
                      </td>
                      <td className="func__mono">
                        {login ? (
                          login
                        ) : (
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
                            title="Histórico de ponto"
                            aria-label={`Ver histórico de ponto de ${f.nome}`}
                            onClick={() => irParaHistorico(f.id)}
                          >
                            <History size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="func__icone"
                            title="Editar"
                            aria-label={`Editar ${f.nome}`}
                            onClick={() => irParaEditar(f.id)}
                          >
                            <Pencil size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="func__icone"
                            title={
                              f.status === "ativo" ? "Inativar" : "Ativar"
                            }
                            aria-label={
                              f.status === "ativo"
                                ? `Inativar ${f.nome}`
                                : `Ativar ${f.nome}`
                            }
                            disabled={ocupadoId === f.id}
                            onClick={() => void alternarStatus(f)}
                          >
                            {f.status === "ativo" ? (
                              <Pause size={13} aria-hidden="true" />
                            ) : (
                              <Play size={13} aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
