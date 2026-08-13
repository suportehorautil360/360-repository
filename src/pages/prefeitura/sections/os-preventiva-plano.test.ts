import { describe, expect, it, vi } from "vitest";

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
}));

vi.mock("../../../lib/api/client", async (orig) => {
  const actual = await orig<typeof import("../../../lib/api/client")>();
  return {
    ...actual,
    api: { ...actual.api, post: postMock },
  };
});

import { criarSolicitacaoOs } from "./criar-solicitacao-os";
import { formatarObservacaoAuditoria } from "./auditoria-devolucao-model";
import {
  adicionarCategoria,
  clonarPlanoPadrao,
  montarRelatoPreventivo,
  normalizarPlano,
} from "./plano-preventivo-model";
import type { EquipRow } from "./equipamentos/equipamentos-api";

const equip: EquipRow = {
  id: "eq-1",
  descricao: "Escavadeira Sany",
  marca: "Sany",
  modelo: "SY215",
  chassis: "CH-1",
  placa: "ABC1D23",
  linha: "Amarela",
  tipo: "Máquina",
  ano: "2024",
  obra: "Obra 1",
  status: "ativo",
  medicaoAtual: 1200,
  intervaloRevisao: 500,
  ultimaRevisao: 1000,
  unidadeRevisao: "h",
};

/**
 * Espelha o fluxo do AbrirOsFormulario para OS tipo V (preventiva):
 * plano → categoria → ciclo → relato → criar solicitação.
 */
describe("OS preventiva com plano por categoria→matriz", () => {
  it("monta relato a partir da matriz da categoria e cria OS com cicloId", async () => {
    const plano = clonarPlanoPadrao();
    const categoria = plano.categorias.find((c) => c.nome === "Fluidos");
    expect(categoria).toBeTruthy();
    expect(categoria!.ciclos.some((c) => c.id === "c1")).toBe(true);

    const relato = montarRelatoPreventivo(categoria!, "c1");
    expect(relato).toContain("Manutenção preventiva — Fluidos");
    expect(relato).toContain("Óleo do Motor");
    expect(relato.length).toBeGreaterThan(40);

    // Auditoria ainda consegue formatar o relato novo
    const fmt = formatarObservacaoAuditoria(relato);
    expect(fmt.ehLista).toBe(true);
    expect(fmt.titulo).toContain("Manutenção preventiva");
    expect(fmt.itens.length).toBeGreaterThan(0);

    postMock.mockResolvedValue({
      data: {
        id: "os-prev-1",
        protocol: "OS-2026-100",
        serviceType: "preventive",
        serviceTypeLabel: "Preventiva",
        invitedWorkshops: [{ id: "o1", name: "Oficina A" }],
        status: "aguardando_orcamento",
      },
    });

    const resultado = await criarSolicitacaoOs({
      prefeituraId: "pref-1",
      equipamento: equip,
      operador: "João Silva",
      relato,
      tipoOs: "V",
      cicloId: "c1",
      dataAgendamento: "2026-08-10",
    });

    expect(postMock).toHaveBeenCalledWith(
      "/os/solicitacoes",
      expect.objectContaining({
        prefeituraId: "pref-1",
        equipmentId: "eq-1",
        serviceType: "preventive",
        cicloId: "c1",
        report: relato,
        operator: "João Silva",
      }),
    );
    expect(resultado.protocolo).toBe("OS-2026-100");
  });

  it("categoria nova (matriz vazia) ainda permite criar OS com relato de vazio do ciclo", async () => {
    let plano = clonarPlanoPadrao();
    plano = adicionarCategoria(plano, "Especial")!;
    const especial = plano.categorias.find((c) => c.nome === "Especial")!;
    expect(especial.linhas).toHaveLength(0);
    expect(especial.ciclos.length).toBeGreaterThan(0);

    const cicloId = especial.ciclos[0]!.id;
    const relato = montarRelatoPreventivo(especial, cicloId);
    expect(relato).toContain("Especial");
    expect(relato).toContain("Nenhum item configurado");

    postMock.mockResolvedValue({
      data: {
        id: "os-prev-2",
        protocol: "OS-2026-101",
        serviceType: "preventive",
        invitedWorkshops: [],
        status: "aguardando_orcamento",
      },
    });

    await criarSolicitacaoOs({
      prefeituraId: "pref-1",
      equipamento: equip,
      operador: "Maria",
      relato,
      tipoOs: "V",
      cicloId,
    });

    expect(postMock).toHaveBeenCalledWith(
      "/os/solicitacoes",
      expect.objectContaining({
        serviceType: "preventive",
        cicloId,
        report: relato,
      }),
    );
  });

  it("plano legado flat migrado continua gerando relato e payload de OS", async () => {
    const legado = {
      ciclos: [
        { id: "c1", horas: 250, km: 10000, titulo: "Ciclo 1 (250h / 10.000km)" },
      ],
      linhas: [
        {
          id: "l1",
          categoria: "Fluidos",
          item: "Óleo do Motor",
          especificacao: "SAE",
          acoes: { c1: "inspecionar" },
        },
      ],
    };
    const plano = normalizarPlano(legado);
    const cat = plano.categorias.find((c) => c.nome === "Fluidos")!;
    const relato = montarRelatoPreventivo(cat, "c1");
    expect(relato).toContain("Óleo do Motor");

    postMock.mockResolvedValue({
      data: {
        id: "os-prev-3",
        protocol: "OS-2026-102",
        serviceType: "preventive",
        invitedWorkshops: [{ id: "o1", name: "A" }],
        status: "aguardando_orcamento",
      },
    });

    await criarSolicitacaoOs({
      prefeituraId: "pref-1",
      equipamento: equip,
      operador: "Pedro",
      relato,
      tipoOs: "V",
      cicloId: "c1",
    });

    expect(postMock).toHaveBeenCalledWith(
      "/os/solicitacoes",
      expect.objectContaining({ cicloId: "c1", serviceType: "preventive" }),
    );
  });

  it("OS corretiva (sem plano) continua independente do plano preventivo", async () => {
    postMock.mockResolvedValue({
      data: {
        id: "os-c-1",
        protocol: "OS-2026-103",
        serviceType: "corrective",
        invitedWorkshops: [{ id: "o1", name: "A" }],
        status: "aguardando_orcamento",
      },
    });

    await criarSolicitacaoOs({
      prefeituraId: "pref-1",
      equipamento: equip,
      operador: "Ana",
      relato: "Vazamento hidráulico",
      tipoOs: "C",
    });

    expect(postMock).toHaveBeenCalledWith(
      "/os/solicitacoes",
      expect.objectContaining({
        serviceType: "corrective",
        report: "Vazamento hidráulico",
      }),
    );
    const body = postMock.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(body.cicloId).toBeUndefined();
  });
});
