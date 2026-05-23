import { describe, expect, it } from "vitest";
import { dataLongaPtBr, isSameLocalDay, startOfLocalDayIso } from "./datas";

describe("startOfLocalDayIso", () => {
  it("formata como YYYY-MM-DD com zero à esquerda", () => {
    expect(startOfLocalDayIso(new Date(2026, 4, 3))).toBe("2026-05-03");
    expect(startOfLocalDayIso(new Date(2026, 11, 25))).toBe("2026-12-25");
  });
});

describe("isSameLocalDay", () => {
  it("true quando o ISO cai no mesmo dia local", () => {
    const iso = new Date(2026, 4, 23, 10, 30).toISOString();
    expect(isSameLocalDay(iso, "2026-05-23")).toBe(true);
  });

  it("false para outro dia, ISO vazio ou inválido", () => {
    const iso = new Date(2026, 4, 23).toISOString();
    expect(isSameLocalDay(iso, "2026-05-24")).toBe(false);
    expect(isSameLocalDay("", "2026-05-23")).toBe(false);
    expect(isSameLocalDay("não-é-data", "2026-05-23")).toBe(false);
  });
});

describe("dataLongaPtBr", () => {
  it("retorna data por extenso com a 1ª letra maiúscula", () => {
    const out = dataLongaPtBr(new Date(2026, 4, 23));
    expect(out[0]).toBe(out[0].toUpperCase());
    expect(out).toMatch(/2026/);
  });
});
