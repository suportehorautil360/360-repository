import { describe, it, expect } from "vitest";
import {
  configPadrao,
  mesclarEmpresaCliente,
  type ClienteParaEmpresa,
} from "./configuracoes";

const cliente: ClienteParaEmpresa = {
  nome: "Prefeitura de Campo Grande",
  uf: "MS",
  cnpj: "12.345.678/0001-90",
  caepf: "",
  cidade: "Campo Grande",
  whatsapp: "+5567999999999",
  contrato: { emailContratante: "gestor@cg.gov.br" },
};

describe("mesclarEmpresaCliente", () => {
  it("semeia os campos vazios a partir do cliente", () => {
    const empresa = configPadrao("p1").empresa; // tudo vazio
    const r = mesclarEmpresaCliente(empresa, cliente);
    expect(r).toMatchObject({
      razaoSocial: "Prefeitura de Campo Grande",
      cnpj: "12.345.678/0001-90",
      cidade: "Campo Grande",
      estado: "MS",
      emailAlertas: "gestor@cg.gov.br",
      whatsappNumero: "+5567999999999",
    });
  });

  it("NÃO sobrescreve o que já está preenchido na config", () => {
    const empresa = {
      ...configPadrao("p1").empresa,
      razaoSocial: "Nome já salvo",
      cnpj: "99.999.999/9999-99",
    };
    const r = mesclarEmpresaCliente(empresa, cliente);
    expect(r.razaoSocial).toBe("Nome já salvo");
    expect(r.cnpj).toBe("99.999.999/9999-99");
    // mas ainda semeia os que estavam vazios
    expect(r.cidade).toBe("Campo Grande");
    expect(r.estado).toBe("MS");
  });

  it("retorna a empresa intacta quando não há cliente", () => {
    const empresa = configPadrao("p1").empresa;
    expect(mesclarEmpresaCliente(empresa, null)).toBe(empresa);
  });
});
