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

  it("mapeia subtipos de caminhão para as categorias do seed", () => {
    // O seed usa o prefixo 'Caminhão ' nos subtipos — a inferência precisa
    // bater exatamente, senão o filtro de itens vira vazio.
    expect(inferirCategoriaChecklist("Caminhão Pipa Volvo", "")).toBe(
      "Caminhão Pipa",
    );
    expect(inferirCategoriaChecklist("Pipa 8000L", "")).toBe("Caminhão Pipa");
    expect(inferirCategoriaChecklist("Caminhão Basculante", "")).toBe(
      "Caminhão Basculante",
    );
    expect(inferirCategoriaChecklist("Basculante 6x4", "")).toBe(
      "Caminhão Basculante",
    );
    expect(inferirCategoriaChecklist("Caminhão Munck", "")).toBe(
      "Caminhão Munck",
    );
    // Aceita também a grafia sem 'c' que aparecia no seed antigo.
    expect(inferirCategoriaChecklist("Munk 12T", "")).toBe("Caminhão Munck");
  });

  it("reconhece os demais tipos da tabela oficial", () => {
    expect(inferirCategoriaChecklist("Oficina Móvel", "")).toBe("Oficina");
    expect(inferirCategoriaChecklist("Baú Refrigerado", "")).toBe("Baú");
    expect(inferirCategoriaChecklist("Betoneira 8m³", "")).toBe("Betoneira");
    expect(inferirCategoriaChecklist("Comboio de Lubrificação", "")).toBe(
      "Comboio",
    );
    expect(inferirCategoriaChecklist("Ambulância UTI", "")).toBe("Ambulância");
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
