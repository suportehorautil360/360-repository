import { describe, expect, it } from "vitest";
import { montarPreventivas, toPreventivaRow } from "./preventiva-model";
import type { VeiculoFrota } from "./frota/types";

function veic(p: Partial<VeiculoFrota>): VeiculoFrota {
  return {
    id: "v1",
    placa: "MQ-01",
    nome: "Caterpillar 320",
    marca: "Caterpillar",
    tipo: "maquina",
    ano: 2017,
    medicaoAtual: 1200,
    intervaloRevisao: 250,
    ultimaRevisao: 1000,
    obra: "",
    status: "ativo",
    ...p,
  };
}

describe("toPreventivaRow", () => {
  it("deriva as colunas da preventiva a partir do equipamento (horímetro)", () => {
    const row = toPreventivaRow(veic({}));
    expect(row).toMatchObject({
      id: "v1",
      idChassiPlaca: "MQ-01",
      nomeEquipamento: "Caterpillar 320",
      tipoMedidor: "Horímetro",
      planoIntervalo: "250 h",
      ultimaPreventiva: "1.000 h",
      proximaPreventivaMeta: "1.250 h", // 1000 + 250
      leituraAtual: "1.200 h",
      restanteParaVencer: "50 h", // 1250 - 1200
      status: "proxima", // restante 50 <= max(100, 250*0.2=50)
    });
  });

  it("marca vencida e mostra o excesso", () => {
    const row = toPreventivaRow(veic({ medicaoAtual: 1300 })); // passou de 1250
    expect(row.status).toBe("vencida");
    expect(row.restanteParaVencer).toBe("vencido 50 h");
  });

  it("tipo KM quando não é horímetro", () => {
    const row = toPreventivaRow(
      veic({ tipo: "carro", medicaoAtual: 12000, intervaloRevisao: 10000, ultimaRevisao: 5000 }),
    );
    expect(row.tipoMedidor).toBe("KM");
    expect(row.status).toBe("em-dia"); // restante 3000 > 2000
  });
});

describe("montarPreventivas", () => {
  it("ordena vencidas → próximas → em dia", () => {
    const emDia = veic({ id: "ok", medicaoAtual: 1000 }); // restante 250
    const proxima = veic({ id: "prox", medicaoAtual: 1230 }); // restante 20
    const vencida = veic({ id: "venc", medicaoAtual: 1400 }); // < 0
    const rows = montarPreventivas([emDia, proxima, vencida]);
    expect(rows.map((r) => r.id)).toEqual(["venc", "prox", "ok"]);
  });
});
