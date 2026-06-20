/**
 * Prefetch do escopo do operador: com rede, carrega a frota da prefeitura pelo
 * NestJS (gravando o cache local p/ offline) e aquece o doc do cliente no
 * Firestore. Sem isso, a busca de chassi falhava offline (cache nunca aquecido).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db: unknown, name: string, id: string) => ({ _doc: [name, id] })),
  getDoc: vi.fn(),
}));
vi.mock("../../lib/firebase/firebase", () => ({ db: {} }));
vi.mock("../../lib/funcionarios/funcionarios", () => ({
  funcionariosApi: { listarCredenciaisOffline: vi.fn() },
}));
vi.mock("./credenciais-offline", () => ({
  provisionarCredenciaisPrefeitura: vi.fn(),
}));
vi.mock("./frota-operador", () => ({
  carregarFrotaOperador: vi.fn(),
}));

import { doc, getDoc } from "firebase/firestore";
import { funcionariosApi } from "../../lib/funcionarios/funcionarios";
import { provisionarCredenciaisPrefeitura } from "./credenciais-offline";
import { carregarFrotaOperador } from "./frota-operador";
import { prefetchEscopoOperador } from "./prefetch-escopo";

const listarCredsMock = vi.mocked(funcionariosApi.listarCredenciaisOffline);
const provisionarMock = vi.mocked(provisionarCredenciaisPrefeitura);
const getDocMock = vi.mocked(getDoc);
const docMock = vi.mocked(doc);
const carregarFrotaMock = vi.mocked(carregarFrotaOperador);

function setOnline(v: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(v);
}

beforeEach(() => {
  carregarFrotaMock.mockReset().mockResolvedValue([]);
  getDocMock.mockReset().mockResolvedValue({
    exists: () => true,
    data: () => ({ nome: "X" }),
  } as never);
  listarCredsMock.mockReset().mockResolvedValue([]);
  provisionarMock.mockReset();
  docMock.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("prefetchEscopoOperador", () => {
  it("online: carrega a frota da prefeitura (NestJS) e aquece o doc do cliente", async () => {
    setOnline(true);
    await prefetchEscopoOperador("pref-1");
    expect(carregarFrotaMock).toHaveBeenCalledWith("pref-1");
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
    expect(carregarFrotaMock).not.toHaveBeenCalled();
    expect(getDocMock).not.toHaveBeenCalled();
  });

  it("sem prefeituraId: não faz nada", async () => {
    setOnline(true);
    await prefetchEscopoOperador("");
    expect(carregarFrotaMock).not.toHaveBeenCalled();
  });

  it("erro de rede é best-effort: não lança", async () => {
    setOnline(true);
    getDocMock.mockRejectedValue(new Error("unavailable"));
    await expect(prefetchEscopoOperador("pref-1")).resolves.toBeUndefined();
  });
});
