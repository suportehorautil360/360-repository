import { beforeEach, describe, expect, it, vi } from "vitest";

// Mantém o ApiError real (frentes-api usa instanceof) e troca só os métodos `api`.
const { getMock, postMock, patchMock, delMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  delMock: vi.fn(),
}));
vi.mock("../../../../lib/api/client", async (orig) => {
  const actual = await orig<typeof import("../../../../lib/api/client")>();
  return {
    ...actual,
    api: { get: getMock, post: postMock, patch: patchMock, del: delMock },
  };
});

import {
  formatCustoBR,
  formatDataBR,
  frentesApi,
  isoParaDateInput,
  mensagemErroSalvarFrente,
} from "./frentes-api";
import { ApiError } from "../../../../lib/api/client";

const frenteRaw = {
  id: "wf1",
  name: "Rodovia SP-310 — Trecho 4",
  prefeituraId: "pref1",
  address: "São Carlos, SP",
  responsible: "Carlos Mendes",
  responsibleId: "user-1",
  status: "active",
  cost: 2120,
  startDate: "2026-01-10T00:00:00.000Z",
  endDate: "2026-09-30T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  equipamentos: [
    {
      id: "al1",
      vehicleId: "v1",
      plate: "CAR-001",
      function: "Transporte",
      startDate: "10/01/2026",
    },
  ],
};

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  patchMock.mockReset();
  delMock.mockReset();
});

describe("frentesApi.listar", () => {
  it("normaliza a frente do backend para o modelo de UI", async () => {
    getMock.mockResolvedValue({ data: [frenteRaw], message: "ok" });

    const [f] = await frentesApi.listar("pref1");

    expect(getMock).toHaveBeenCalledWith("/work-front/pref1");
    expect(f.nome).toBe("Rodovia SP-310 — Trecho 4");
    expect(f.status).toBe("Ativa");
    expect(f.custo).toBe(2120);
    expect(f.responsavel).toBe("Carlos Mendes");
    expect(f.responsavelId).toBe("user-1");
    expect(f.equipamentos).toHaveLength(1);
    expect(f.equipamentos[0]).toMatchObject({
      allocationId: "al1",
      vehicleId: "v1",
      placa: "CAR-001",
      funcao: "Transporte",
      desde: "10/01/2026",
    });
  });

  it("mapeia status pausado/concluído", async () => {
    getMock.mockResolvedValue({
      data: [
        { ...frenteRaw, id: "a", status: "paused" },
        { ...frenteRaw, id: "b", name: "Z", status: "concluida" },
      ],
      message: "ok",
    });
    const lista = await frentesApi.listar("pref1");
    const byNome = Object.fromEntries(lista.map((f) => [f.id, f.status]));
    expect(byNome.a).toBe("Pausada");
    expect(byNome.b).toBe("Concluída");
  });

  it("frente legada sem responsibleId vira responsavelId vazio", async () => {
    const semResponsavel: Record<string, unknown> = { ...frenteRaw };
    delete semResponsavel.responsibleId;
    getMock.mockResolvedValue({ data: [semResponsavel], message: "ok" });
    const [f] = await frentesApi.listar("pref1");
    expect(f.responsavelId).toBe("");
    expect(f.responsavel).toBe("Carlos Mendes");
  });

  it("trata 404 como lista vazia", async () => {
    getMock.mockRejectedValue(new ApiError(404, "não encontrado"));
    await expect(frentesApi.listar("pref1")).resolves.toEqual([]);
  });

  it("propaga erros que não são 404", async () => {
    getMock.mockRejectedValue(new ApiError(500, "boom"));
    await expect(frentesApi.listar("pref1")).rejects.toThrow("boom");
  });
});

describe("frentesApi.criar", () => {
  it("envia o payload com custo e datas em ISO", async () => {
    postMock.mockResolvedValue({});
    await frentesApi.criar(
      {
        nome: "Obra X",
        endereco: "Rua 1",
        responsavel: "Maria",
        responsavelId: "user-9",
        telefone: "11988887777",
        email: "frente@x.com",
        status: "Ativa",
        custo: 2120,
        inicio: "2026-01-10",
        fim: "2026-09-30",
      },
      "pref1",
    );

    expect(postMock).toHaveBeenCalledTimes(1);
    const [path, body] = postMock.mock.calls[0];
    expect(path).toBe("/work-front");
    expect(body).toMatchObject({
      name: "Obra X",
      prefeituraId: "pref1",
      address: "Rua 1",
      responsible: "Maria",
      responsibleId: "user-9",
      // O telefone informado sem DDI é normalizado para E.164.
      telefone: "+5511988887777",
      email: "frente@x.com",
      status: "Ativa",
      cost: 2120,
      equipaments: [],
    });
    expect(body.startDate).toContain("2026-01");
    expect(body.endDate).toContain("2026-09");
  });

  it("omite endDate quando o término não é informado", async () => {
    postMock.mockResolvedValue({});
    await frentesApi.criar(
      {
        nome: "Obra X",
        endereco: "Rua 1",
        responsavel: "Maria",
        responsavelId: "user-9",
        telefone: "",
        email: "",
        status: "Ativa",
        custo: 0,
        inicio: "2026-01-10",
        fim: "",
      },
      "pref1",
    );
    const [, body] = postMock.mock.calls[0];
    expect(body).not.toHaveProperty("endDate");
  });
});

describe("frentesApi.atualizar", () => {
  it("usa PATCH com o id da frente", async () => {
    patchMock.mockResolvedValue({});
    await frentesApi.atualizar("wf1", {
      nome: "Novo nome",
      endereco: "Rua 2",
      responsavel: "João",
      responsavelId: "user-7",
      telefone: "",
      email: "",
      status: "Pausada",
      custo: 999,
      inicio: "2026-02-01",
      fim: "",
    });
    const [path, body] = patchMock.mock.calls[0];
    expect(path).toBe("/work-front/wf1");
    expect(body).toMatchObject({
      name: "Novo nome",
      status: "Pausada",
      cost: 999,
    });
  });

  // Se o PATCH do backend for replace, omitir o campo apagaria o responsável.
  it("reenvia o responsável no update", async () => {
    patchMock.mockResolvedValue({});
    await frentesApi.atualizar("wf1", {
      nome: "Novo nome",
      endereco: "Rua 2",
      responsavel: "João",
      responsavelId: "user-7",
      telefone: "",
      email: "",
      status: "Ativa",
      custo: 0,
      inicio: "2026-02-01",
      fim: "",
    });
    const [, body] = patchMock.mock.calls[0];
    expect(body).toMatchObject({
      responsible: "João",
      responsibleId: "user-7",
    });
  });
});

describe("frentesApi.alocar / desalocar", () => {
  it("alocar envia o vínculo do equipamento na frente", async () => {
    postMock.mockResolvedValue({});
    await frentesApi.alocar({
      frente: {
        id: "wf1",
        nome: "Obra X",
        endereco: "",
        responsavel: "",
        responsavelId: "",
        telefone: "",
        email: "",
        status: "Ativa",
        custo: 0,
        inicio: "",
        fim: "",
        criadoEm: "",
        equipamentos: [],
      },
      vehicleId: "v1",
      placa: "CAR-001",
      funcao: "Transporte",
      prefeituraId: "pref1",
    });
    const [path, body] = postMock.mock.calls[0];
    expect(path).toBe("/allocation");
    expect(body).toMatchObject({
      vehicleId: "v1",
      workFrontId: "wf1",
      workFrontName: "Obra X",
      plate: "CAR-001",
      function: "Transporte",
      prefeituraId: "pref1",
      currentWorkFront: { id: "wf1", name: "Obra X" },
    });
    expect(body.startDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("alocar converte a data informada (yyyy-mm-dd) para DD/MM/YYYY", async () => {
    postMock.mockResolvedValue({});
    await frentesApi.alocar({
      frente: {
        id: "wf1",
        nome: "Obra X",
        endereco: "",
        responsavel: "",
        responsavelId: "",
        telefone: "",
        email: "",
        status: "Ativa",
        custo: 0,
        inicio: "",
        fim: "",
        criadoEm: "",
        equipamentos: [],
      },
      vehicleId: "v1",
      placa: "CAR-001",
      funcao: "Transporte",
      prefeituraId: "pref1",
      dataAlocacao: "2026-06-02",
    });
    const [, body] = postMock.mock.calls[0];
    expect(body.startDate).toBe("02/06/2026");
  });

  it("desalocar chama DELETE com o id da alocação", async () => {
    delMock.mockResolvedValue(undefined);
    await frentesApi.desalocar("al1");
    expect(delMock).toHaveBeenCalledWith("/allocation/al1");
  });
});

describe("mensagemErroSalvarFrente", () => {
  it("mostra o motivo que o backend deu no 400", () => {
    const err = new ApiError(
      400,
      "O responsável precisa ser um usuário desta prefeitura.",
    );
    expect(mensagemErroSalvarFrente(err, false)).toBe(
      "O responsável precisa ser um usuário desta prefeitura.",
    );
  });

  it("cai na genérica quando não é 400", () => {
    expect(mensagemErroSalvarFrente(new ApiError(500, "boom"), false)).toBe(
      "Não foi possível criar a frente de trabalho.",
    );
  });

  it("distingue criar de editar na genérica", () => {
    const err = new ApiError(500, "boom");
    expect(mensagemErroSalvarFrente(err, true)).toContain("atualizar");
    expect(mensagemErroSalvarFrente(err, false)).toContain("criar");
  });

  it("erro de rede (não ApiError) cai na genérica", () => {
    expect(mensagemErroSalvarFrente(new TypeError("offline"), true)).toBe(
      "Não foi possível atualizar a frente de trabalho.",
    );
  });
});

describe("helpers de formatação", () => {
  it("isoParaDateInput devolve yyyy-mm-dd", () => {
    expect(isoParaDateInput("2026-09-30T00:00:00.000Z")).toBe("2026-09-30");
    expect(isoParaDateInput("")).toBe("");
    expect(isoParaDateInput("xpto")).toBe("");
  });

  it("formatDataBR trata vazio/ inválido como travessão", () => {
    expect(formatDataBR("")).toBe("—");
    expect(formatDataBR("xpto")).toBe("—");
  });

  it("formatCustoBR formata como moeda", () => {
    expect(formatCustoBR(2120)).toContain("2.120,00");
  });
});
