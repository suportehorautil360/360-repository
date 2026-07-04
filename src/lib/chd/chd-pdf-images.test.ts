import { describe, expect, it } from "vitest";
import type { ChdDocCompleto } from "../api/checklist-devolucao";
import { coletarUrlsFotosChd } from "./chd-pdf-images";

describe("coletarUrlsFotosChd", () => {
  it("reúne fotos de anomalias e peças sem duplicar", () => {
    const chd = {
      id: "1",
      number: "CHD-1",
      oficinaId: "of-1",
      identification: {},
      status: "enviado",
      createdAt: "2026-01-01",
      generalState: {
        pneu: { status: "anomaly", photo: "https://cdn/a.jpg" },
      },
      parts: {
        items: [
          {
            description: "Filtro",
            newPhoto: "https://cdn/b.jpg",
            replacedPhoto: "https://cdn/a.jpg",
          },
        ],
      },
    } satisfies ChdDocCompleto;

    expect(coletarUrlsFotosChd(chd)).toEqual([
      "https://cdn/a.jpg",
      "https://cdn/b.jpg",
    ]);
  });
});
