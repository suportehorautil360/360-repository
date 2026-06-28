import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getDocsMock, addDocMock, updateDocMock, whereMock, docMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  addDocMock: vi.fn(),
  updateDocMock: vi.fn(),
  whereMock: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  docMock: vi.fn((_db: unknown, col: string, id: string) => ({ col, id })),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn((_ref: unknown, ...cs: unknown[]) => ({ cs })),
  where: whereMock,
  getDocs: getDocsMock,
  addDoc: addDocMock,
  updateDoc: updateDocMock,
  deleteDoc: vi.fn(),
  doc: docMock,
}));
vi.mock("../../../../lib/firebase/firebase", () => ({ db: {} }));
vi.mock("../../../../utils/hashSenha", () => ({
  hashSenha: vi.fn(async (s: string) => `hash:${s}`),
}));

import { useAccess } from "./use-access";

beforeEach(() => {
  getDocsMock.mockReset();
  addDocMock.mockReset();
  updateDocMock.mockReset();
  whereMock.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("useAccess.listarUsuarios", () => {
  it("filtra por postoId", async () => {
    getDocsMock.mockResolvedValue({ docs: [{ id: "u1", data: () => ({ usuario: "p01" }) }] });
    const r = await useAccess.getState().listarUsuarios({ postoId: "posto-1" });
    expect(whereMock).toHaveBeenCalledWith("postoId", "==", "posto-1");
    expect(r[0]).toMatchObject({ id: "u1", usuario: "p01" });
  });
  it("filtra por officinaId", async () => {
    getDocsMock.mockResolvedValue({ docs: [{ id: "u2", data: () => ({ usuario: "ofi01" }) }] });
    const r = await useAccess.getState().listarUsuarios({ officinaId: "of-1" });
    expect(whereMock).toHaveBeenCalledWith("officinaId", "==", "of-1");
    expect(r[0]).toMatchObject({ id: "u2", usuario: "ofi01" });
  });
  it("usa o doc id do Firestore, não o campo id legado salvo no doc", async () => {
    getDocsMock.mockResolvedValue({
      docs: [{ id: "DOCID", data: () => ({ id: "uuid-legado", usuario: "p01" }) }],
    });
    const r = await useAccess.getState().listarUsuarios({ postoId: "posto-1" });
    expect(r[0].id).toBe("DOCID");
  });
});

describe("useAccess.resetarSenha", () => {
  it("rejeita senha curta", async () => {
    const r = await useAccess.getState().resetarSenha("u1", "12");
    expect(r.ok).toBe(false);
    expect(updateDocMock).not.toHaveBeenCalled();
  });
  it("grava o hash da nova senha", async () => {
    const r = await useAccess.getState().resetarSenha("u1", "novaSenha");
    expect(r.ok).toBe(true);
    expect(updateDocMock).toHaveBeenCalledWith(
      { col: "users", id: "u1" },
      { senha: "hash:novaSenha", mustChangePassword: true },
    );
  });
});
