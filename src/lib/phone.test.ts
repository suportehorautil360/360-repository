import { describe, expect, it } from "vitest";
import { toE164 } from "./phone";

describe("toE164", () => {
  it("mantém número já em E.164", () => {
    expect(toE164("+5567999990000")).toBe("+5567999990000");
  });

  it("converte número BR nacional (com DDD) para E.164", () => {
    expect(toE164("67 99999-0000")).toBe("+5567999990000");
  });

  it("reconhece DDI internacional pelo + (US)", () => {
    expect(toE164("+1 415 555 1234")).toBe("+14155551234");
  });

  it("vazio → undefined", () => {
    expect(toE164("")).toBe(undefined);
    expect(toE164(null)).toBe(undefined);
    expect(toE164(undefined)).toBe(undefined);
  });

  it("lixo não parseável → undefined", () => {
    expect(toE164("abc")).toBe(undefined);
  });
});
