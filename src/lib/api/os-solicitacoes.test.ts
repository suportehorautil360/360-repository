import { describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("./client", async (orig) => {
  const actual = await orig<typeof import("./client")>();
  return {
    ...actual,
    api: { ...actual.api, get: getMock, post: postMock },
  };
});

import {
  mensagemErroCriarOs,
  osSolicitacoesApi,
  solicitacaoApiParaTela,
  tipoOsParaServiceType,
} from "./os-solicitacoes";
import { ApiError } from "./client";

describe("solicitacaoApiParaTela", () => {
  it("usa campos PT de compatibilidade", () => {
    expect(
      solicitacaoApiParaTela({
        id: "x1",
        protocolo: "OS-2026-048",
        equipamento: "Sany",
        linha: "Amarela",
        operador: "João",
        relato: "defeito",
        status: "aguardando_orcamento",
        criadoEm: { seconds: 1747319400 },
      }),
    ).toMatchObject({
      protocolo: "OS-2026-048",
      equipamento: "Sany",
      linha: "Amarela",
    });
  });

  it("cai para campos EN quando PT ausente", () => {
    expect(
      solicitacaoApiParaTela({
        id: "x2",
        protocol: "OS-2026-049",
        equipment: "Scania",
        line: "Pesada",
        operator: "Maria",
        report: "freio",
        status: "aprovado",
        createdAt: "2026-05-15T14:30:00.000Z",
      }),
    ).toMatchObject({
      protocolo: "OS-2026-049",
      equipamento: "Scania",
      relato: "freio",
    });
  });
});

describe("mensagemErroCriarOs", () => {
  it("mapeia status HTTP", () => {
    expect(mensagemErroCriarOs(new ApiError(422, "x"))).toContain("oficina");
    expect(mensagemErroCriarOs(new ApiError(404, "x"))).toContain("encontrado");
  });
});

describe("tipoOsParaServiceType", () => {
  it("mapeia C/P/V para serviceType da API", () => {
    expect(tipoOsParaServiceType("C")).toBe("corrective");
    expect(tipoOsParaServiceType("P")).toBe("predictive");
    expect(tipoOsParaServiceType("V")).toBe("preventive");
    expect(tipoOsParaServiceType()).toBe("corrective");
  });
});

describe("osSolicitacoesApi", () => {
  it("criar envia serviceType (não type legado)", async () => {
    postMock.mockResolvedValue({
      data: {
        id: "id1",
        protocol: "OS-2026-050",
        serviceType: "corrective",
        serviceTypeLabel: "Corretiva",
        invitedWorkshops: [{ id: "o1", name: "Avantec" }],
        status: "aguardando_orcamento",
      },
    });
    const r = await osSolicitacoesApi.criar({
      prefeituraId: "pref-1",
      equipmentId: "eq-1",
      operator: "João",
      report: "vazamento",
      serviceType: "corrective",
      scheduledDate: "2026-06-14",
    });
    expect(postMock).toHaveBeenCalledWith("/os/solicitacoes", {
      prefeituraId: "pref-1",
      equipmentId: "eq-1",
      operator: "João",
      report: "vazamento",
      serviceType: "corrective",
      scheduledDate: "2026-06-14",
    });
    expect(r.protocol).toBe("OS-2026-050");
  });

  it("listar monta query de filtros", async () => {
    getMock.mockResolvedValue({ data: [] });
    await osSolicitacoesApi.listar("pref-1", {
      status: "aprovado",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    expect(getMock).toHaveBeenCalledWith(
      "/os/solicitacoes/pref-1?status=aprovado&startDate=2026-06-01&endDate=2026-06-30",
    );
  });
});
