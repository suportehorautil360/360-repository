import { describe, expect, it } from "vitest";
import { formatarDuracao, tempoRelativo, formatarDataHora } from "./format";

const agora = new Date("2026-06-05T12:00:00.000Z");

describe("formatarDuracao", () => {
  it("dias e horas", () => {
    expect(formatarDuracao("2026-06-02T08:00:00.000Z", agora)).toBe("3d 4h");
  });
  it("horas e minutos", () => {
    expect(formatarDuracao("2026-06-05T09:47:00.000Z", agora)).toBe("2h 13min");
  });
  it("só minutos", () => {
    expect(formatarDuracao("2026-06-05T11:55:00.000Z", agora)).toBe("5min");
  });
  it("nulo → traço", () => {
    expect(formatarDuracao(null, agora)).toBe("—");
  });
});

describe("tempoRelativo", () => {
  it("segundos", () => {
    expect(tempoRelativo("2026-06-05T11:59:48.000Z", agora)).toBe("há 12s");
  });
  it("minutos", () => {
    expect(tempoRelativo("2026-06-05T11:57:00.000Z", agora)).toBe("há 3min");
  });
  it("nulo → traço", () => {
    expect(tempoRelativo(null, agora)).toBe("—");
  });
});

describe("formatarDataHora", () => {
  it("nulo → traço", () => {
    expect(formatarDataHora(null)).toBe("—");
  });
  it("formata data válida", () => {
    expect(formatarDataHora("2026-06-05T09:42:00.000Z")).toMatch(/2026/);
  });
});
