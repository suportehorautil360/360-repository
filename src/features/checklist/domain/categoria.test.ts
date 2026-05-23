import { describe, expect, it } from "vitest";
import {
  checklistCategoriaFromMaquina,
  inferirCategoriaChecklist,
} from "./categoria";

describe("checklistCategoriaFromMaquina", () => {
  it("agrupa qualquer 'Caminhão...' em 'Caminhões'", () => {
    expect(checklistCategoriaFromMaquina("Caminhão Basculante")).toBe(
      "Caminhões",
    );
  });

  it("mantém a categoria quando não é caminhão", () => {
    expect(checklistCategoriaFromMaquina("Escavadeira")).toBe("Escavadeira");
  });
});

describe("inferirCategoriaChecklist", () => {
  it("reconhece tipos a partir do label/modelo", () => {
    expect(inferirCategoriaChecklist("Motoniveladora 140", "")).toBe(
      "Motoniveladora",
    );
    expect(inferirCategoriaChecklist("Escavadeira Hidráulica", "")).toBe(
      "Escavadeira",
    );
    expect(inferirCategoriaChecklist("Trator de Esteira D6", "")).toBe(
      "Trator de Esteira",
    );
    expect(inferirCategoriaChecklist("Caminhao Caçamba", "")).toBe("Caminhões");
    expect(inferirCategoriaChecklist("Pá Carregadeira 938", "")).toBe(
      "Pá Carregadeira",
    );
    expect(inferirCategoriaChecklist("Rolo Compactador CS54", "")).toBe(
      "Rolo Compactador",
    );
  });

  it("usa o modelo quando o label não denuncia o tipo", () => {
    expect(inferirCategoriaChecklist("XYZ", "Escavadeira")).toBe("Escavadeira");
  });

  it("faz fallback para o label/modelo quando não reconhece", () => {
    expect(inferirCategoriaChecklist("Equipamento Genérico", "")).toBe(
      "Equipamento Genérico",
    );
  });
});
