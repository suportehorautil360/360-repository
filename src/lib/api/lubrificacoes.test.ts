import { describe, expect, it } from "vitest";

import {
  lubrificacaoListaParaTela,
  rotuloPontoEngraxe,
} from "./lubrificacoes";

describe("rotuloPontoEngraxe", () => {
  it("traduz a chave conhecida para o rótulo PT", () => {
    expect(rotuloPontoEngraxe("boomPins")).toBe("Pinos da lança");
    expect(rotuloPontoEngraxe("bucket")).toBe("Caçamba / concha");
    expect(rotuloPontoEngraxe("articulation")).toBe("Articulação");
    expect(rotuloPontoEngraxe("driveshaft")).toBe("Cardã");
  });

  it("chave desconhecida: humaniza (nunca o nome cru da variável)", () => {
    // camelCase vira palavras; não mostra "newGreasePoint".
    expect(rotuloPontoEngraxe("newGreasePoint")).toBe("New grease point");
    expect(rotuloPontoEngraxe("front_axle")).toBe("Front axle");
  });
});

describe("lubrificacaoListaParaTela (pontos traduzidos)", () => {
  it("converte as chaves do back em rótulos amigáveis", () => {
    const tela = lubrificacaoListaParaTela({
      id: "l1",
      dateTime: "10/06, 16:58",
      equipment: { name: "Golf", plate: "ABC-1234" },
      reading: "80.000 km",
      greasedPoints: ["boomPins", "bucket", "articulation"],
    });
    expect(tela.pontos).toEqual([
      "Pinos da lança",
      "Caçamba / concha",
      "Articulação",
    ]);
  });

  it("lista vazia/ausente vira []", () => {
    const tela = lubrificacaoListaParaTela({
      id: "l2",
      dateTime: "04/06, 15:14",
      reading: "1.840 h",
    });
    expect(tela.pontos).toEqual([]);
  });
});
