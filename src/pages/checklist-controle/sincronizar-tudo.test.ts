import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api/pontos-fila", () => ({
  sincronizar: vi.fn(),
  pendentes: vi.fn(() => 0),
}));
vi.mock("../../features/checklist/api/workflow-fila", () => ({
  sincronizarWorkflows: vi.fn(),
  pendentesWorkflow: vi.fn(() => 0),
}));

import { sincronizar } from "../../lib/api/pontos-fila";
import { sincronizarWorkflows } from "../../features/checklist/api/workflow-fila";
import { sincronizarTudo } from "./sincronizar-tudo";

const sincMock = vi.mocked(sincronizar);
const wfMock = vi.mocked(sincronizarWorkflows);

afterEach(() => vi.restoreAllMocks());

describe("sincronizarTudo", () => {
  it("dispara as filas e soma o que foi enviado", async () => {
    sincMock.mockResolvedValue(2);
    wfMock.mockResolvedValue(1);
    const r = await sincronizarTudo();
    expect(sincMock).toHaveBeenCalled();
    expect(wfMock).toHaveBeenCalled();
    expect(r).toEqual({ pontos: 2, workflows: 1, total: 3 });
  });

  it("uma fila falhar não derruba a outra", async () => {
    sincMock.mockRejectedValue(new Error("x"));
    wfMock.mockResolvedValue(1);
    const r = await sincronizarTudo();
    expect(r.workflows).toBe(1);
    expect(r.pontos).toBe(0);
  });
});
