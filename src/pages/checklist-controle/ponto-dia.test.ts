import { beforeEach, describe, expect, it } from "vitest";
import { jaBateuHoje, marcarBatidaHoje } from "./ponto-dia";

const session = { idMaquina: "m1" };

beforeEach(() => {
  localStorage.clear();
});

describe("ponto-dia", () => {
  it("começa sem batida no dia", () => {
    expect(jaBateuHoje(session)).toBe(false);
  });

  it("marca a batida do dia e passa a reconhecer", () => {
    marcarBatidaHoje(session);
    expect(jaBateuHoje(session)).toBe(true);
  });

  it("é por máquina (outra sessão não herda a batida)", () => {
    marcarBatidaHoje(session);
    expect(jaBateuHoje({ idMaquina: "m2" })).toBe(false);
  });
});
