import { describe, expect, it } from "vitest";
import { parseRespostaChecklistItemUi } from "./ChecklistHistoricoLista";

describe("parseRespostaChecklistItemUi", () => {
  it("interpreta resposta legada sim", () => {
    expect(parseRespostaChecklistItemUi("sim")).toMatchObject({
      ok: true,
      na: false,
      label: "Sim",
      tone: "sim",
    });
  });

  it("interpreta resposta legada nao", () => {
    expect(parseRespostaChecklistItemUi("nao")).toMatchObject({
      ok: false,
      na: false,
      label: "Não",
      tone: "nao",
    });
  });

  it("interpreta resposta N/A como estado próprio", () => {
    expect(parseRespostaChecklistItemUi({ v: "na" })).toMatchObject({
      ok: false,
      na: true,
      label: "N/A",
      tone: "na",
    });
  });

  it("mantém legado desconhecido como não conforme", () => {
    expect(parseRespostaChecklistItemUi("valor-antigo")).toMatchObject({
      ok: false,
      na: false,
      label: "Não",
      tone: "nao",
    });
  });
});
