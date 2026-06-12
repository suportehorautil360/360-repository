/**
 * Prefetch do escopo do operador: aquece o cache offline do Firestore com a
 * frota da prefeitura e o nome do cliente enquanto há rede. Sem isso, o
 * `persistentLocalCache` só serve offline o que já foi lido — e a busca de
 * chassi/emergência falhavam offline (cache nunca aquecido).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ _col: name })),
  doc: vi.fn((_db: unknown, name: string, id: string) => ({ _doc: [name, id] })),
  query: vi.fn((...a: unknown[]) => ({ _query: a })),
  where: vi.fn((...a: unknown[]) => ({ _where: a })),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
}));
vi.mock("../../lib/firebase/firebase", () => ({ db: {} }));
vi.mock("../../lib/funcionarios/funcionarios", () => ({
  funcionariosApi: { listarCredenciaisOffline: vi.fn() },
}));
vi.mock("./credenciais-offline", () => ({
  provisionarCredenciaisPrefeitura: vi.fn(),
}));

import {
  collection,
  doc,
  getDoc,
  getDocs,
  where,
} from "firebase/firestore";
import { funcionariosApi } from "../../lib/funcionarios/funcionarios";
import { provisionarCredenciaisPrefeitura } from "./credenciais-offline";
import { prefetchEscopoOperador } from "./prefetch-escopo";

const listarCredsMock = vi.mocked(funcionariosApi.listarCredenciaisOffline);
const provisionarMock = vi.mocked(provisionarCredenciaisPrefeitura);

const getDocsMock = vi.mocked(getDocs);
const getDocMock = vi.mocked(getDoc);
const whereMock = vi.mocked(where);
const collectionMock = vi.mocked(collection);
const docMock = vi.mocked(doc);

function setOnline(v: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(v);
}

beforeEach(() => {
  getDocsMock.mockReset().mockResolvedValue({
    docs: [{ id: "e1", data: () => ({}) }],
  } as never);
  getDocMock.mockReset().mockResolvedValue({
    exists: () => true,
    data: () => ({ nome: "X" }),
  } as never);
  listarCredsMock.mockReset().mockResolvedValue([]);
  provisionarMock.mockReset();
  whereMock.mockClear();
  collectionMock.mockClear();
  docMock.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("prefetchEscopoOperador", () => {
  it("online: aquece a frota por prefeituraId e o doc do cliente", async () => {
    setOnline(true);
    await prefetchEscopoOperador("pref-1");
    expect(collectionMock).toHaveBeenCalledWith(
      expect.anything(),
      "equipamentos",
    );
    expect(whereMock).toHaveBeenCalledWith("prefeituraId", "==", "pref-1");
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(docMock).toHaveBeenCalledWith(expect.anything(), "clientes", "pref-1");
    expect(getDocMock).toHaveBeenCalledTimes(1);
  });

  it("online: baixa as credenciais da prefeitura e provisiona o aparelho", async () => {
    setOnline(true);
    const creds = [{ funcionario: { id: "f1" }, senhaHash: "h" }];
    listarCredsMock.mockResolvedValue(creds as never);
    await prefetchEscopoOperador("pref-1", "Prefeitura X");
    expect(listarCredsMock).toHaveBeenCalledWith("pref-1");
    expect(provisionarMock).toHaveBeenCalledWith(creds, "Prefeitura X");
  });

  it("offline: não baixa nem provisiona credenciais", async () => {
    setOnline(false);
    await prefetchEscopoOperador("pref-1", "Prefeitura X");
    expect(listarCredsMock).not.toHaveBeenCalled();
    expect(provisionarMock).not.toHaveBeenCalled();
  });

  it("offline: não dispara consulta (não adianta aquecer sem rede)", async () => {
    setOnline(false);
    await prefetchEscopoOperador("pref-1");
    expect(getDocsMock).not.toHaveBeenCalled();
    expect(getDocMock).not.toHaveBeenCalled();
  });

  it("sem prefeituraId: não faz nada", async () => {
    setOnline(true);
    await prefetchEscopoOperador("");
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it("erro de rede é best-effort: não lança", async () => {
    setOnline(true);
    getDocsMock.mockRejectedValue(new Error("unavailable"));
    await expect(prefetchEscopoOperador("pref-1")).resolves.toBeUndefined();
  });
});
