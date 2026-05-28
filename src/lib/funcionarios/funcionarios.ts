/**
 * Camada de dados de Funcionários — evolução da coleção `operadores`.
 *
 * A coleção já existia com `{ prefeituraId, nome, cargo, createdAt }` (cadastro
 * antigo na CadastrosSection). Aqui ampliamos o modelo com cpf/telefone/senha/
 * tipo/status, tolerando docs legados (sem esses campos) nas leituras.
 *
 * Tudo via Firestore (offline-first, persistentLocalCache). Sem backend.
 */
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
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
}

/** Dados de escrita (cadastro/edição). `senha` é opcional na edição. */
export interface FuncionarioInput {
  nome: string;
  cpf: string;
  cargo: string;
  telefone?: string;
  tipo: FuncionarioTipo;
  status: FuncionarioStatus;
  /** Senha em texto puro; só presente quando vai ser (re)definida. */
  senha?: string;
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
  };
}

/** Resultado da autenticação por CPF + senha. */
export type AutenticacaoResultado =
  | { ok: true; funcionario: Funcionario }
  | {
      ok: false;
      motivo: "nao-encontrado" | "sem-senha" | "senha-invalida" | "inativo";
    };

export const funcionariosApi = {
  /**
   * Autentica um funcionário por CPF + senha (login do operador em campo).
   * Busca global por CPF (o operador só conhece o próprio CPF); o
   * prefeituraId sai do próprio doc. Verifica o hash salgado e o status.
   */
  async autenticar(
    cpf: string,
    senha: string,
  ): Promise<AutenticacaoResultado> {
    const limpo = limparCpf(cpf);
    const snap = await getDocs(
      query(collection(db, COLECAO), where("cpf", "==", limpo)),
    );
    if (snap.empty) return { ok: false, motivo: "nao-encontrado" };

    // Pode haver mais de um doc com o mesmo CPF (unicidade é best-effort);
    // pega o primeiro com senha que confere.
    const esperado = await hashSenhaFuncionario(limpo, senha);
    let temAlgumComSenha = false;
    for (const d of snap.docs) {
      const data = d.data();
      if (!data.senhaHash) continue;
      temAlgumComSenha = true;
      if (data.senhaHash !== esperado) continue;
      const funcionario = fromDoc(d.id, data);
      if (funcionario.status !== "ativo") return { ok: false, motivo: "inativo" };
      return { ok: true, funcionario };
    }
    if (!temAlgumComSenha) return { ok: false, motivo: "sem-senha" };
    return { ok: false, motivo: "senha-invalida" };
  },

  /** Lista os funcionários de uma prefeitura (inclui inativos). */
  async listar(prefeituraId: string): Promise<Funcionario[]> {
    if (!prefeituraId) return [];
    const snap = await getDocs(
      query(
        collection(db, COLECAO),
        where("prefeituraId", "==", prefeituraId),
        orderBy("createdAt", "desc"),
      ),
    );
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
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
    const snap = await getDocs(
      query(
        collection(db, COLECAO),
        where("prefeituraId", "==", prefeituraId),
        where("cpf", "==", limpo),
      ),
    );
    return snap.docs.some((d) => d.id !== ignorarId);
  },

  async criar(prefeituraId: string, input: FuncionarioInput): Promise<void> {
    const cpf = limparCpf(input.cpf);
    const payload: Record<string, unknown> = {
      prefeituraId,
      nome: input.nome.trim(),
      cpf,
      cargo: input.cargo.trim(),
      telefone: input.telefone?.trim() || null,
      tipo: input.tipo,
      status: input.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.senha) {
      payload.senhaHash = await hashSenhaFuncionario(cpf, input.senha);
    }
    await addDoc(collection(db, COLECAO), payload);
  },

  async atualizar(id: string, input: FuncionarioInput): Promise<void> {
    const cpf = limparCpf(input.cpf);
    const payload: Record<string, unknown> = {
      nome: input.nome.trim(),
      cpf,
      cargo: input.cargo.trim(),
      telefone: input.telefone?.trim() || null,
      tipo: input.tipo,
      status: input.status,
      updatedAt: serverTimestamp(),
    };
    if (input.senha) {
      payload.senhaHash = await hashSenhaFuncionario(cpf, input.senha);
    }
    await updateDoc(doc(db, COLECAO, id), payload);
  },

  /** Ativa/inativa sem mexer no resto do cadastro. */
  async definirStatus(id: string, status: FuncionarioStatus): Promise<void> {
    await updateDoc(doc(db, COLECAO, id), {
      status,
      updatedAt: serverTimestamp(),
    });
  },
};
