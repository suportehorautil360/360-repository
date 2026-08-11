import { describe, expect, it } from "vitest";
import {
  adicionarCategoria,
  clonarPlanoPadrao,
  montarRelatoPreventivo,
  normalizarPlano,
  removerCategoria,
  renomearCategoria,
} from "./plano-preventivo-model";

describe("montarRelatoPreventivo", () => {
  it("lista itens com ação diferente de na no ciclo da categoria", () => {
    const plano = clonarPlanoPadrao();
    const fluidos = plano.categorias.find((c) => c.nome === "Fluidos")!;
    const relato = montarRelatoPreventivo(fluidos, "c1");

    expect(relato).toMatch(/^Manutenção preventiva — Fluidos — Ciclo 1/);
    expect(relato).toContain("• Óleo do Motor:");
    expect(relato).not.toContain("Óleo da Transmissão");
  });

  it("retorna vazio se ciclo inexistente", () => {
    const fluidos = clonarPlanoPadrao().categorias[0]!;
    expect(montarRelatoPreventivo(fluidos, "c99")).toBe("");
  });
});

describe("plano por categoria→matriz", () => {
  it("seed tem 4 categorias com matrizes próprias", () => {
    const p = clonarPlanoPadrao();
    expect(p.categorias.map((c) => c.nome)).toEqual([
      "Fluidos",
      "Filtros",
      "Consumo",
      "Serviço",
    ]);
    for (const c of p.categorias) {
      expect(c.ciclos.length).toBeGreaterThan(0);
      expect(c.linhas.length).toBeGreaterThan(0);
    }
  });

  it("nova categoria nasce com matriz vazia (ciclos padrão)", () => {
    const next = adicionarCategoria(clonarPlanoPadrao(), "Nova cat")!;
    const nova = next.categorias.find((c) => c.nome === "Nova cat")!;
    expect(nova.ciclos.length).toBe(4);
    expect(nova.linhas).toEqual([]);
  });

  it("excluir remove categoria e matriz", () => {
    let p = clonarPlanoPadrao();
    p = adicionarCategoria(p, "Temp")!;
    const temp = p.categorias.find((c) => c.nome === "Temp")!;
    const next = removerCategoria(p, temp.id)!;
    expect(next.categorias.some((c) => c.id === temp.id)).toBe(false);
  });

  it("renomear não apaga a matriz", () => {
    const p = clonarPlanoPadrao();
    const fluidos = p.categorias.find((c) => c.nome === "Fluidos")!;
    const nLinhas = fluidos.linhas.length;
    const next = renomearCategoria(p, fluidos.id, "Líquidos");
    const cat = next.categorias.find((c) => c.id === fluidos.id)!;
    expect(cat.nome).toBe("Líquidos");
    expect(cat.linhas.length).toBe(nLinhas);
  });

  it("normalizarPlano migra legado flat para categorias→matriz", () => {
    const legado = {
      ciclos: [{ id: "c1", horas: 250, km: 10000, titulo: "C1" }],
      linhas: [
        {
          id: "l1",
          categoria: "Alpha",
          item: "Item A",
          especificacao: "",
          acoes: { c1: "trocar" },
        },
        {
          id: "l2",
          categoria: "Beta",
          item: "Item B",
          especificacao: "",
          acoes: { c1: "inspecionar" },
        },
      ],
    };
    const p = normalizarPlano(legado);
    expect(p.categorias).toHaveLength(2);
    expect(p.categorias.map((c) => c.nome).sort()).toEqual(["Alpha", "Beta"]);
    expect(p.categorias.find((c) => c.nome === "Alpha")!.linhas[0].item).toBe(
      "Item A",
    );
  });
});
