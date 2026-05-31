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
  getDoc,
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

    console.log("dados enviados", { ident, senha, ehCpf });

    const snap = ehCpf
      ? await getDocs(query(collection(db, COLECAO), where("cpf", "==", limpo)))
      : await getDocs(
          query(
            collection(db, COLECAO),
            where("loginGerado", "==", ident.toLowerCase()),
          ),
        );
    console.log("snapshot recebido", {
      size: snap.size,
      docs: snap.docs.map((d) => ({ id: d.id, data: d.data() })),
    });
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
    return {
      ok: true,
      funcionario: fromDoc(snap.docs[0].id, snap.docs[0].data()),
    };
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
    // Backfill oportunístico: docs antigos não têm `loginGerado` salvo
    // (foram criados antes do campo existir). Sem isso a query por login
    // na autenticação retorna vazio. Regrava fire-and-forget — o load
    // continua rápido e a próxima tentativa de login já funciona.
    for (const d of snap.docs) {
      const data = d.data();
      if (data.loginGerado || !data.nome || !data.cpf) continue;
      const loginGerado = gerarLogin(String(data.nome), String(data.cpf));
      if (!loginGerado) continue;
      void updateDoc(doc(db, COLECAO, d.id), { loginGerado }).catch(() => {
        /* ignora falha de backfill — não bloqueia a tela */
      });
    }
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
    // Padrão enterprise: se a senha não foi escolhida, o CPF vira a senha
    // inicial (operador troca depois). Garante que todo funcionário criado
    // já pode logar.
    const senhaInicial = input.senha || cpf;
    const loginGerado = gerarLogin(input.nome, cpf);
    const payload: Record<string, unknown> = {
      prefeituraId,
      nome: input.nome.trim(),
      cpf,
      loginGerado,
      cargo: input.cargo.trim(),
      telefone: input.telefone?.trim() || null,
      tipo: input.tipo,
      status: input.status,
      matricula: input.matricula?.trim() || null,
      dataNascimento: input.dataNascimento?.trim() || null,
      rg: input.rg?.trim() || null,
      cnh: input.cnh?.replace(/\D/g, "") || null,
      cnhCategoria: input.cnhCategoria?.trim() || null,
      cnhValidade: input.cnhValidade?.trim() || null,
      cnhLocalEmissao: input.cnhLocalEmissao?.trim() || null,
      cnhEmissao: input.cnhEmissao?.trim() || null,
      cnhRestricao: input.cnhRestricao?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
      senhaHash: await hashSenhaFuncionario(cpf, senhaInicial),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await addDoc(collection(db, COLECAO), payload);
  },

  async atualizar(id: string, input: FuncionarioInput): Promise<void> {
    const cpf = limparCpf(input.cpf);
    const loginGerado = gerarLogin(input.nome, cpf);
    const payload: Record<string, unknown> = {
      nome: input.nome.trim(),
      cpf,
      loginGerado,
      cargo: input.cargo.trim(),
      telefone: input.telefone?.trim() || null,
      tipo: input.tipo,
      status: input.status,
      matricula: input.matricula?.trim() || null,
      dataNascimento: input.dataNascimento?.trim() || null,
      rg: input.rg?.trim() || null,
      cnh: input.cnh?.replace(/\D/g, "") || null,
      cnhCategoria: input.cnhCategoria?.trim() || null,
      cnhValidade: input.cnhValidade?.trim() || null,
      cnhLocalEmissao: input.cnhLocalEmissao?.trim() || null,
      cnhEmissao: input.cnhEmissao?.trim() || null,
      cnhRestricao: input.cnhRestricao?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
      updatedAt: serverTimestamp(),
    };
    if (input.senha) {
      payload.senhaHash = await hashSenhaFuncionario(cpf, input.senha);
    }
    await updateDoc(doc(db, COLECAO, id), payload);
  },

  /** Carrega um funcionário pelo id (página de edição). */
  async obter(id: string): Promise<Funcionario | null> {
    const ref = doc(db, COLECAO, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return fromDoc(snap.id, snap.data());
  },

  /**
   * Reseta a senha do funcionário para o CPF (ação do gestor).
   * Útil quando o operador esqueceu a senha OU quando o doc foi criado
   * com uma senha que ninguém lembra. Não há fluxo de troca pelo operador.
   */
  async resetarSenha(id: string): Promise<void> {
    const ref = doc(db, COLECAO, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Funcionário não encontrado.");
    const cpf = limparCpf(String(snap.data().cpf ?? ""));
    if (!cpf) throw new Error("CPF não definido — não dá pra resetar.");
    const senhaHash = await hashSenhaFuncionario(cpf, cpf);
    await updateDoc(ref, { senhaHash, updatedAt: serverTimestamp() });
  },

  /** Ativa/inativa sem mexer no resto do cadastro. */
  async definirStatus(id: string, status: FuncionarioStatus): Promise<void> {
    await updateDoc(doc(db, COLECAO, id), {
      status,
      updatedAt: serverTimestamp(),
    });
  },
};
