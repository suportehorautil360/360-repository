import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../pages/prefeitura/sections/equipamentos/equipamentos-api", () => ({
  equipamentosApi: {
    sincronizarMedicaoChecklist: vi.fn(),
  },
  parseMedicaoTexto: (value: unknown) => {
    if (typeof value !== "string") return null;
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  },
}));

import { equipamentosApi } from "../../../pages/prefeitura/sections/equipamentos/equipamentos-api";
import {
  enviarMedicaoComFila,
  sincronizarMedicoes,
} from "./medicao-fila";

const sincronizarMedicaoChecklistMock = vi.mocked(
  equipamentosApi.sincronizarMedicaoChecklist,
);

beforeEach(() => {
  localStorage.clear();
  sincronizarMedicaoChecklistMock.mockReset();
  sincronizarMedicaoChecklistMock.mockResolvedValue(true);
  vi.stubGlobal("navigator", { onLine: true });
});

describe("medicao-fila", () => {
  it("envia medição online", async () => {
    const ok = await enviarMedicaoComFila("eq-1", "6890,5");
    expect(ok).toBe(true);
    expect(sincronizarMedicaoChecklistMock).toHaveBeenCalledWith(
      "eq-1",
      "6890,5",
    );
  });

  it("offline enfileira para depois", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const ok = await enviarMedicaoComFila("eq-1", "7000");
    expect(ok).toBe(false);
    expect(sincronizarMedicaoChecklistMock).not.toHaveBeenCalled();

    vi.stubGlobal("navigator", { onLine: true });
    const enviados = await sincronizarMedicoes();
    expect(enviados).toBe(1);
    expect(sincronizarMedicaoChecklistMock).toHaveBeenCalledWith(
      "eq-1",
      "7000",
    );
  });
});
