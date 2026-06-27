import { describe, expect, it } from "vitest";
import type { Abastecimento } from "@/lib/api/abastecimentos";
import {
  filtrarAbastecimentos,
  abastecimentosParaCSV,
} from "./abastecimentos-utils";

const base: Abastecimento = {
  id: "0",
  data: "2026-06-02",
  hora: "08:00",
  origem: "posto",
  veiculo: "",
  placa: "",
  tipoVeiculo: "Carro",
  combustivel: "Diesel S10",
  litros: 50,
  valor: 306,
  leitura: 85260,
  leituraUnidade: "km",
  local: "Posto Trevo",
  comboioId: "",
  funcionarioId: "",
  comboio: "",
  comboista: "",
  km: 85260,
  postoNome: "Posto Trevo",
  status: "",
};
const mk = (p: Partial<Abastecimento>): Abastecimento => ({ ...base, ...p });

const rows = [
  mk({ id: "1", origem: "comboio", veiculo: "Escavadeira CAT 320", placa: "ABC-1234", leituraUnidade: "h", valor: 0 }),
  mk({ id: "2", origem: "posto", veiculo: "Hilux Cabine Dupla", placa: "JKL-7B43" }),
];

describe("filtrarAbastecimentos", () => {
  it("'todas' retorna tudo", () => {
    expect(filtrarAbastecimentos(rows, "todas", "")).toHaveLength(2);
  });
  it("filtra por origem comboio", () => {
    const r = filtrarAbastecimentos(rows, "comboio", "");
    expect(r.map((x) => x.id)).toEqual(["1"]);
  });
  it("filtra por origem posto", () => {
    const r = filtrarAbastecimentos(rows, "posto", "");
    expect(r.map((x) => x.id)).toEqual(["2"]);
  });
  it("busca por veículo (case-insensitive)", () => {
    expect(filtrarAbastecimentos(rows, "todas", "hilux").map((x) => x.id)).toEqual(["2"]);
  });
  it("busca por placa (case-insensitive)", () => {
    expect(filtrarAbastecimentos(rows, "todas", "abc-1234").map((x) => x.id)).toEqual(["1"]);
  });
});

describe("abastecimentosParaCSV", () => {
  it("monta colunas e linhas; comboio sem valor", () => {
    const ds = abastecimentosParaCSV(rows);
    expect(ds.colunas[0]).toBe("Data");
    expect(ds.colunas).toHaveLength(13);
    expect(ds.linhas).toHaveLength(2);
    // linha do comboio (id 1): célula de valor vazia
    const comboio = ds.linhas[0];
    expect(comboio[5]).toBe("Comboio");
    expect(comboio[9]).toBe(""); // valor vazio p/ comboio
    // linha do posto (id 2): valor numérico
    const posto = ds.linhas[1];
    expect(posto[5]).toBe("Posto");
    expect(posto[9]).toBe(306);
  });
});
