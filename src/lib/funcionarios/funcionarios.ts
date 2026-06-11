/**
 * Camada de dados de Funcionários — evolução da coleção `operadores`.
 *
 * A coleção já existia com `{ prefeituraId, nome, cargo, createdAt }` (cadastro
 * antigo na CadastrosSection). Aqui ampliamos o modelo com cpf/telefone/senha/
 * tipo/status, tolerando docs legados (sem esses campos) nas leituras.
 *
 * Tudo via Firestore (offline-first, persistentLocalCache). Sem backend.
 */
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { api, ApiError } from "../api/client";
import { hashSenha } from "../../utils/hashSenha";
import { limparCpf } from "./cpf";

const COLECAO = "operadores";

export type FuncionarioTipo = "operador" | "supervisor" | "admin";
export type FuncionarioStatus = "ativo" | "inativo";

export const TIPOS_FUNCIONARIO: { tipo: FuncionarioTipo; label: string }[] = [
  { tipo: "operador", label: "Operador" },
  { tipo: "supervisor", label: "Supervisor" },
  { tipo: "admin", label: "Administrador" },
];

/** Categorias de CNH brasileiras. */
export const CNH_CATEGORIAS = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"];

export interface Funcionario {
  id: string;
  prefeituraId: string;
  nome: string;
  cpf: string; // só dígitos
  cargo: string;
  telefone?: string;
  tipo: FuncionarioTipo;
  status: FuncionarioStatus;
  /** true quando o funcionário tem senha definida (pode logar). */
  temSenha: boolean;
  /** Matrícula interna da prefeitura (opcional). */
  matricula?: string;
  /** Data de nascimento (YYYY-MM-DD). */
  dataNascimento?: string;
  /** RG (livre, ex.: "12.345.678-9"). */
  rg?: string;
  /** Número da CNH (só dígitos). */
  cnh?: string;
  /** Categoria da CNH ("A", "B", "AB"…). */
  cnhCategoria?: string;
  /** Validade da CNH no formato ISO (YYYY-MM-DD). */
  cnhValidade?: string;
  /** Local de emissão da CNH (UF). */
  cnhLocalEmissao?: string;
  /** Data de emissão da CNH (YYYY-MM-DD). */
  cnhEmissao?: string;
  /** Restrição médica (ex.: "Usa óculos"). */
  cnhRestricao?: string;
  /** Observações livres do gestor. */
  observacoes?: string;
  /** Login gerado (primeiroNome+3 últimos do CPF), denormalizado p/ busca. */
  loginGerado?: string;
}

/**
 * Login gerado a partir do nome + 3 últimos dígitos do CPF.
 * Apenas para exibir nas credenciais; o login real continua sendo por CPF.
 */
export function gerarLogin(nome: string, cpf: string): string {
  const primeiro = (nome || "").trim().split(/\s+/)[0] ?? "";
  const cpfLimpo = (cpf || "").replace(/\D/g, "");
  if (!primeiro || cpfLimpo.length < 3) return "";
  return `${primeiro.toLowerCase()}${cpfLimpo.slice(-3)}`;
}

/** Dados de escrita (cadastro/edição). `senha` é opcional na edição. */
export interface FuncionarioInput {
  nome: string;
  cpf: string;
  cargo: string;
  telefone?: string;
  tipo: FuncionarioTipo;
  status: FuncionarioStatus;
  /** Senha em texto puro; quando ausente no cadastro, vira o CPF (senha inicial). */
  senha?: string;
  matricula?: string;
  dataNascimento?: string;
  rg?: string;
  cnh?: string;
  cnhCategoria?: string;
  cnhValidade?: string;
  cnhLocalEmissao?: string;
  cnhEmissao?: string;
  cnhRestricao?: string;
  observacoes?: string;
}

/**
 * Hash da senha do funcionário, salgado com o CPF. Melhoria barata sobre o
 * SHA-256 puro do login admin — sem salt, dois funcionários com a mesma senha
 * teriam o mesmo hash. Não substitui bcrypt (exigiria backend).
 */
export async function hashSenhaFuncionario(
  cpf: string,
  senha: string,
): Promise<string> {
  return hashSenha(`${limparCpf(cpf)}:${senha}`);
}

/** Normaliza um doc bruto do Firestore tolerando o formato legado. */
function fromDoc(id: string, data: Record<string, unknown>): Funcionario {
  const status = data.status === "inativo" ? "inativo" : "ativo";
  const tipoRaw = data.tipo;
  const tipo: FuncionarioTipo =
    tipoRaw === "supervisor" || tipoRaw === "admin" ? tipoRaw : "operador";
  return {
    id,
    prefeituraId: String(data.prefeituraId ?? ""),
    nome: String(data.nome ?? ""),
    cpf: limparCpf(String(data.cpf ?? "")),
    cargo: String(data.cargo ?? ""),
    telefone: data.telefone ? String(data.telefone) : undefined,
    tipo,
    status,
    temSenha: Boolean(data.senhaHash),
    matricula: data.matricula ? String(data.matricula) : undefined,
    dataNascimento: data.dataNascimento
      ? String(data.dataNascimento)
      : undefined,
    rg: data.rg ? String(data.rg) : undefined,
    cnh: data.cnh ? String(data.cnh) : undefined,
    cnhCategoria: data.cnhCategoria ? String(data.cnhCategoria) : undefined,
    cnhValidade: data.cnhValidade ? String(data.cnhValidade) : undefined,
    cnhLocalEmissao: data.cnhLocalEmissao
      ? String(data.cnhLocalEmissao)
      : undefined,
    cnhEmissao: data.cnhEmissao ? String(data.cnhEmissao) : undefined,
    cnhRestricao: data.cnhRestricao ? String(data.cnhRestricao) : undefined,
    observacoes: data.observacoes ? String(data.observacoes) : undefined,
    // Backfill: docs antigos não têm `loginGerado`; computa na hora.
    loginGerado: data.loginGerado
      ? String(data.loginGerado)
      : gerarLogin(String(data.nome ?? ""), String(data.cpf ?? "")),
  };
}

/** Resultado da autenticação por CPF + senha. */
export type AutenticacaoResultado =
  | { ok: true; funcionario: Funcionario }
  | {
      ok: false;
      motivo: "nao-encontrado" | "sem-senha" | "senha-invalida" | "inativo";
    };

/** Resultado da importação em massa. */
export interface ImportResultado {
  criados: number;
  ignorados: number;
  erros: { linha: number; nome: string; cpf: string; motivo: string }[];
}

interface DocResponse {
  data: (Record<string, unknown> & { id?: string }) | null;
}

export const funcionariosApi = {
  /**
   * Autentica um funcionário por CPF **ou** login gerado + senha.
   * O `identificador` é detectado por heurística: 11 dígitos → CPF; caso
   * contrário, busca por `loginGerado` (campo denormalizado no doc).
   * A senha continua sendo salgada com o CPF da pessoa.
   */
  async autenticar(
    identificador: string,
    senha: string,
  ): Promise<AutenticacaoResultado> {
    const ident = (identificador || "").trim();
    const limpo = limparCpf(ident);
    const ehCpf = limpo.length === 11;

    const snap = ehCpf
      ? await getDocs(query(collection(db, COLECAO), where("cpf", "==", limpo)))
      : await getDocs(
          query(
            collection(db, COLECAO),
            where("loginGerado", "==", ident.toLowerCase()),
          ),
        );
    if (snap.empty) return { ok: false, motivo: "nao-encontrado" };

    // Pode haver mais de um doc com o mesmo identificador (unicidade é
    // best-effort); pega o primeiro com senha que confere.
    let temAlgumComSenha = false;
    for (const d of snap.docs) {
      const data = d.data();
      if (!data.senhaHash) continue;
      temAlgumComSenha = true;
      // O salt do hash é sempre o CPF da pessoa (não o identificador).
      const cpfDoDoc = limparCpf(String(data.cpf ?? ""));
      const esperado = await hashSenhaFuncionario(cpfDoDoc, senha);
      if (data.senhaHash !== esperado) continue;
      const funcionario = fromDoc(d.id, data);
      if (funcionario.status !== "ativo")
        return { ok: false, motivo: "inativo" };
      return { ok: true, funcionario };
    }
    if (!temAlgumComSenha) return { ok: false, motivo: "sem-senha" };
    // Tem senha cadastrada e nenhuma conferiu: NUNCA autenticar.
    return { ok: false, motivo: "senha-invalida" };
  },

  /** Lista os funcionários de uma prefeitura (inclui inativos). Via NestJS. */
  async listar(prefeituraId: string): Promise<Funcionario[]> {
    if (!prefeituraId) return [];
    const r = await api.get<{
      data: (Record<string, unknown> & { id?: string })[];
    }>(`/funcionarios/${prefeituraId}`);
    return (r.data ?? []).map((d) => fromDoc(String(d.id ?? ""), d));
  },

  /**
   * Verifica se já existe outro funcionário com o mesmo CPF na prefeitura.
   * Best-effort (sem backend, o Firestore Rules não garante unicidade).
   */
  async cpfEmUso(
    prefeituraId: string,
    cpf: string,
    ignorarId?: string,
  ): Promise<boolean> {
    const limpo = limparCpf(cpf);
    if (!limpo) return false;
    const q = ignorarId ? `?ignorarId=${encodeURIComponent(ignorarId)}` : "";
    const r = await api.get<{ data: { emUso: boolean } }>(
      `/funcionarios/cpf-em-uso/${prefeituraId}/${limpo}${q}`,
    );
    return r.data?.emUso ?? false;
  },

  async criar(prefeituraId: string, input: FuncionarioInput): Promise<void> {
    await api.post(`/funcionarios/${prefeituraId}`, input);
  },

  async atualizar(id: string, input: FuncionarioInput): Promise<void> {
    await api.post(`/funcionarios/update/${id}`, input);
  },

  /** Carrega um funcionário pelo id (página de edição). Via NestJS. */
  async obter(id: string): Promise<Funcionario | null> {
    try {
      const r = await api.get<DocResponse>(`/funcionarios/item/${id}`);
      return r.data ? fromDoc(String(r.data.id ?? id), r.data) : null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  /** Reseta a senha do funcionário para o CPF (ação do gestor). */
  async resetarSenha(id: string): Promise<void> {
    await api.post(`/funcionarios/reset-senha/${id}`);
  },

  /** Ativa/inativa sem mexer no resto do cadastro. */
  async definirStatus(id: string, status: FuncionarioStatus): Promise<void> {
    await api.post(`/funcionarios/status/${id}`, { status });
  },

  /** Importa vários funcionários de uma planilha (via NestJS). */
  async importar(
    prefeituraId: string,
    funcionarios: FuncionarioInput[],
  ): Promise<ImportResultado> {
    const r = await api.post<{ data: ImportResultado }>(`/funcionarios/import`, {
      prefeituraId,
      funcionarios,
    });
    return r.data;
  },
};
