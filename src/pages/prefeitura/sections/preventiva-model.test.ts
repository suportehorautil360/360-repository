import { describe, expect, it } from "vitest";
import {
  FILTROS_PREVENTIVA_PADRAO,
  filtrarPreventivas,
  frentesDistintas,
  montarPreventivas,
  toPreventivaRow,
} from "./preventiva-model";
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

describe("filtrarPreventivas", () => {
  const rows = montarPreventivas([
    veic({ id: "a", placa: "MQ-01", nome: "Caterpillar 320", obra: "Obra A", medicaoAtual: 1300 }), // vencida, h
    veic({ id: "b", placa: "CAR-002", nome: "Onix", tipo: "carro", obra: "Obra B", medicaoAtual: 5000, intervaloRevisao: 10000, ultimaRevisao: 0 }), // em dia, km
    veic({ id: "c", placa: "MQ-03", nome: "Escavadeira", obra: "Obra A", medicaoAtual: 1240 }), // proxima, h
  ]);

  it("sem filtro retorna tudo", () => {
    expect(filtrarPreventivas(rows, FILTROS_PREVENTIVA_PADRAO)).toHaveLength(3);
  });

  it("filtra por status", () => {
    const r = filtrarPreventivas(rows, { ...FILTROS_PREVENTIVA_PADRAO, status: "vencida" });
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });

  it("filtra por busca (chassi/placa/nome, sem acento)", () => {
    expect(
      filtrarPreventivas(rows, { ...FILTROS_PREVENTIVA_PADRAO, busca: "car-002" }).map((x) => x.id),
    ).toEqual(["b"]);
    expect(
      filtrarPreventivas(rows, { ...FILTROS_PREVENTIVA_PADRAO, busca: "escavadeira" }).map((x) => x.id),
    ).toEqual(["c"]);
  });

  it("filtra por medidor e por frente", () => {
    expect(
      filtrarPreventivas(rows, { ...FILTROS_PREVENTIVA_PADRAO, medidor: "KM" }).map((x) => x.id),
    ).toEqual(["b"]);
    expect(
      filtrarPreventivas(rows, { ...FILTROS_PREVENTIVA_PADRAO, frente: "Obra A" }).map((x) => x.id).sort(),
    ).toEqual(["a", "c"]);
  });
});

describe("frentesDistintas", () => {
  it("lista frentes únicas ordenadas", () => {
    const rows = montarPreventivas([
      veic({ id: "a", obra: "Obra B" }),
      veic({ id: "b", obra: "Obra A" }),
      veic({ id: "c", obra: "Obra A" }),
      veic({ id: "d", obra: "" }),
    ]);
    expect(frentesDistintas(rows)).toEqual(["Disponível", "Obra A", "Obra B"]);
  });
});
