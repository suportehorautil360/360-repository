/**
 * Autenticação do funcionário (CPF/login + senha) direto no Firestore.
 * Cobre o bypass encontrado na auditoria: senha errada devolvia ok:true.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));
vi.mock("../firebase/firebase", () => ({ db: {} }));

import { getDocs } from "firebase/firestore";
import { funcionariosApi, hashSenhaFuncionario } from "./funcionarios";

const getDocsMock = vi.mocked(getDocs);

const CPF = "39053344705"; // CPF válido qualquer (dígitos verificadores ok)

async function docFuncionario(senha: string) {
  const senhaHash = senha ? await hashSenhaFuncionario(CPF, senha) : undefined;
  const dados = {
    nome: "João Operador",
    cpf: CPF,
    prefeituraId: "pref-1",
    tipo: "operador",
    status: "ativo",
    ...(senhaHash ? { senhaHash } : {}),
  };
  return { id: "f1", data: () => dados };
}

function snapCom(docs: unknown[]) {
  return { empty: docs.length === 0, size: docs.length, docs } as never;
}

beforeEach(() => {
  getDocsMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("funcionariosApi.autenticar", () => {
  it("senha correta → ok com o funcionário", async () => {
    getDocsMock.mockResolvedValue(snapCom([await docFuncionario("segredo1")]));
    const r = await funcionariosApi.autenticar(CPF, "segredo1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.funcionario.nome).toBe("João Operador");
  });

  it("senha ERRADA → ok:false com motivo senha-invalida (não pode logar)", async () => {
    getDocsMock.mockResolvedValue(snapCom([await docFuncionario("segredo1")]));
    const r = await funcionariosApi.autenticar(CPF, "senha-errada");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("senha-invalida");
  });

  it("não vaza a senha nem documentos no console", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    getDocsMock.mockResolvedValue(snapCom([await docFuncionario("segredo1")]));
    await funcionariosApi.autenticar(CPF, "segredo1");
    expect(log).not.toHaveBeenCalled();
  });

  it("identificador inexistente → nao-encontrado", async () => {
    getDocsMock.mockResolvedValue(snapCom([]));
    const r = await funcionariosApi.autenticar("00000000000", "x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("nao-encontrado");
  });
});
