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

describe("autenticarPorChassi", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("online → 200 → ok com dados", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          empresaId: "e1",
          empresaNome: "E1",
          idMaquina: "m1",
          chassi: "ABC",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          chassis: ["ABC"],
          expiraEm: new Date(Date.now() + 3600_000).toISOString(),
        }),
      } as Response);
    const r = await funcionariosApi.autenticarPorChassi("abc");
    if (!r.ok) throw new Error("esperava ok");
    expect(r.empresaId).toBe("e1");
    // Verifica que o cache foi populado corretamente
    const cacheRaw = localStorage.getItem("hu360-chassis-offline");
    if (!cacheRaw) throw new Error("cache não foi provisionado");
    const cacheArray = JSON.parse(cacheRaw);
    expect(Array.isArray(cacheArray)).toBe(true);
    const empresa = cacheArray.find((e: { empresaId: string }) => e.empresaId === "e1");
    expect(empresa).toBeDefined();
    if (empresa) {
      expect(empresa.chassis).toContain("ABC");
    }
  });

  it("online → 404 → nao-encontrado", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);
    const r = await funcionariosApi.autenticarPorChassi("XYZ");
    expect(r).toEqual({ ok: false, motivo: "nao-encontrado" });
  });

  it("online → 409 → conflito", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({}),
    } as Response);
    const r = await funcionariosApi.autenticarPorChassi("DUP");
    expect(r).toEqual({ ok: false, motivo: "conflito" });
  });

  it("offline + cache hit → ok", async () => {
    const { provisionarChassisEmpresa: prov } = await import(
      "../../pages/checklist-controle/chassis-offline"
    );
    prov({
      empresaId: "e2",
      empresaNome: "E2",
      chassis: ["CACHED"],
      expiraEm: new Date(Date.now() + 1000).toISOString(),
    });
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const r = await funcionariosApi.autenticarPorChassi("CACHED");
    if (!r.ok) throw new Error("esperava ok offline");
    expect(r.empresaId).toBe("e2");
    expect(r.idMaquina).toBe(""); // offline não sabe idMaquina
  });

  it("offline + cache miss → sem-conexao", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const r = await funcionariosApi.autenticarPorChassi("NADA");
    expect(r).toEqual({ ok: false, motivo: "sem-conexao" });
  });
});

describe("funcionariosApi.listarCredenciaisOffline", () => {
  it("traz funcionario + senhaHash dos ativos com senha; ignora sem hash e inativos", async () => {
    getDocsMock.mockResolvedValue(
      snapCom([
        {
          id: "f1",
          data: () => ({
            nome: "Ativo Com Senha",
            cpf: CPF,
            prefeituraId: "pref-1",
            status: "ativo",
            senhaHash: "hash-1",
          }),
        },
        {
          id: "f2",
          data: () => ({
            nome: "Sem Senha",
            cpf: "11144477735",
            prefeituraId: "pref-1",
            status: "ativo",
          }),
        },
        {
          id: "f3",
          data: () => ({
            nome: "Inativo",
            cpf: "52998224725",
            prefeituraId: "pref-1",
            status: "inativo",
            senhaHash: "hash-3",
          }),
        },
      ]),
    );
    const r = await funcionariosApi.listarCredenciaisOffline("pref-1");
    expect(r).toHaveLength(1);
    expect(r[0].senhaHash).toBe("hash-1");
    expect(r[0].funcionario.id).toBe("f1");
  });

  it("sem prefeituraId → lista vazia, sem consultar", async () => {
    const r = await funcionariosApi.listarCredenciaisOffline("");
    expect(r).toEqual([]);
    expect(getDocsMock).not.toHaveBeenCalled();
  });
});
