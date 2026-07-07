import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { WhatsappOverview } from "@/lib/api/whatsapp";

const overviewMock = vi.fn();
vi.mock("@/lib/api/whatsapp", () => ({
  whatsappApi: {
    overview: () => overviewMock(),
    conectar: vi.fn(),
    desconectar: vi.fn(),
    enviarTeste: vi.fn(),
  },
}));

import { WhatsappSection } from "./WhatsappSection";

function ovConectado(): WhatsappOverview {
  return {
    status: "conectado",
    integracao: "baileys",
    evolutionManagerUrl: null,
    sessao: {
      numeroConectado: "5567999999999",
      nomeSessao: "Hora Útil 360",
      conectadoDesde: "2026-06-05T09:42:00.000Z",
      ultimaAtividade: "2026-06-05T11:58:00.000Z",
      versaoSessao: "2.3000.1",
      ambiente: "prod",
    },
    kpis: {
      empresasUtilizando: 14,
      mensagensHoje: 234,
      mensagens30d: 5120,
      disponibilidade: { percentual: 99.8, desde: "2026-05-06T12:00:00.000Z", janelaCompleta: true },
    },
    eventos: [
      { id: "e1", tipo: "conectado", status: "sucesso", timestamp: "2026-06-05T09:42:00.000Z" },
    ],
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WhatsappSection", () => {
  it("renderiza KPIs e metadados quando conectado", async () => {
    overviewMock.mockResolvedValue(ovConectado());
    render(<WhatsappSection />);

    expect(await screen.findByText("14")).toBeInTheDocument(); // empresas
    expect(screen.getByText("234")).toBeInTheDocument(); // mensagens hoje
    expect(screen.getByText("99.8%")).toBeInTheDocument(); // disponibilidade
    expect(screen.getByText("WhatsApp Conectado")).toBeInTheDocument();
    expect(screen.getAllByText("5567999999999").length).toBeGreaterThan(0);
  });

  it("mostra empty-state desconectado", async () => {
    overviewMock.mockResolvedValue({
      status: "desconectado",
      integracao: "baileys",
      evolutionManagerUrl: null,
      sessao: {
        numeroConectado: null, nomeSessao: null, conectadoDesde: null,
        ultimaAtividade: null, versaoSessao: null, ambiente: "dev",
      },
      kpis: {
        empresasUtilizando: 0, mensagensHoje: 0, mensagens30d: 0,
        disponibilidade: { percentual: 0, desde: "2026-06-05T12:00:00.000Z", janelaCompleta: false },
      },
      eventos: [],
    } satisfies WhatsappOverview);

    render(<WhatsappSection />);
    expect(await screen.findByText("WhatsApp Desconectado")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Conectar WhatsApp" }),
    ).toBeInTheDocument();
  });

  it("mantém a tela em pé se o overview falhar", async () => {
    overviewMock.mockRejectedValue(new Error("rede"));
    render(<WhatsappSection />);
    await waitFor(() =>
      expect(screen.getByText("Hub Mestre WhatsApp")).toBeInTheDocument(),
    );
  });
});
