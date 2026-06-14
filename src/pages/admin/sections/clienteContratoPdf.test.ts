import { describe, expect, it } from "vitest";
import type { ClienteApi } from "../../../lib/api/clientes";
import {
  baixarContratoClientePdf,
  gerarPDFContratoCliente,
} from "./clienteContratoPdf";

const cliente: ClienteApi = {
  id: "c1",
  nome: "São Paulo",
  uf: "SP",
  tipoCliente: "prefeitura",
  contrato: {
    numero: "001/2026",
    vigenciaInicio: "2026-01-01",
    objeto: "Gestão de frota",
    modalidade: "pregao_eletronico",
    status: "ativo",
  },
};

describe("baixarContratoClientePdf", () => {
  it("rejeita cliente sem dados mínimos de contrato", () => {
    expect(() =>
      baixarContratoClientePdf({ id: "x", nome: "X", uf: "SP", contrato: {} }),
    ).toThrow(/não possui dados de contrato/);
  });

  it("monta PDF não vazio com contrato válido", () => {
    const doc = gerarPDFContratoCliente(cliente);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    expect(bytes.byteLength).toBeGreaterThan(2000);
  });
});
