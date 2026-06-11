/**
 * Fila offline do workflow de checklist (runs/answers no NestJS). Itens "Não"
 * eram best-effort: backend fora do ar = respostas perdidas para sempre.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./checklists-api", () => ({
  checklistsApi: { iniciar: vi.fn(), responder: vi.fn() },
}));

import { ApiError } from "../../../lib/api/client";
import { checklistsApi } from "./checklists-api";
import {
  enviarWorkflowComFila,
  pendentesWorkflow,
  sincronizarWorkflows,
} from "./workflow-fila";

const iniciar = vi.mocked(checklistsApi.iniciar);
const responder = vi.mocked(checklistsApi.responder);

const item = {
  checklistId: "chk-1",
  run: {
    prefeituraId: "p1",
    definitionId: "def-1",
    definitionVersion: 1,
    equipamentoId: "eq-1",
    chassis: "ABC123",
    operadorNome: "João",
    categoria: "Escavadeira",
  },
  respostas: [
    {
      questionId: "7",
      questionLabel: "Freios",
      value: { v: "nao", foto: "", problema: "sem freio" },
      problemDescription: "sem freio",
      photoUrls: [],
    },
  ],
};

const run = { id: "run-1" } as Awaited<ReturnType<typeof checklistsApi.iniciar>>;

function setOnline(v: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(v);
}

beforeEach(() => {
  localStorage.clear();
  iniciar.mockReset();
  responder.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("enviarWorkflowComFila", () => {
  it("online: cria o run, envia as respostas e não enfileira", async () => {
    setOnline(true);
    iniciar.mockResolvedValue(run);
    responder.mockResolvedValue({});
    expect(await enviarWorkflowComFila(item)).toBe(true);
    expect(iniciar).toHaveBeenCalledWith(item.run);
    expect(responder).toHaveBeenCalledWith("run-1", item.respostas[0]);
    expect(pendentesWorkflow()).toBe(0);
  });

  it("offline: enfileira sem chamar a API", async () => {
    setOnline(false);
    expect(await enviarWorkflowComFila(item)).toBe(false);
    expect(iniciar).not.toHaveBeenCalled();
    expect(pendentesWorkflow()).toBe(1);
  });

  it("erro de rede no meio: enfileira para retry", async () => {
    setOnline(true);
    iniciar.mockRejectedValue(new TypeError("failed to fetch"));
    expect(await enviarWorkflowComFila(item)).toBe(false);
    expect(pendentesWorkflow()).toBe(1);
  });

  it("rejeição do backend (ApiError): descarta sem enfileirar nem lançar", async () => {
    setOnline(true);
    iniciar.mockRejectedValue(new ApiError(400, "definição inválida"));
    expect(await enviarWorkflowComFila(item)).toBe(false);
    expect(pendentesWorkflow()).toBe(0);
  });

  it("mesmo checklistId substitui o item na fila (sem duplicar)", async () => {
    setOnline(false);
    await enviarWorkflowComFila(item);
    await enviarWorkflowComFila(item);
    expect(pendentesWorkflow()).toBe(1);
  });
});

describe("sincronizarWorkflows", () => {
  it("reenvia a fila quando a rede volta e limpa o que foi", async () => {
    setOnline(false);
    await enviarWorkflowComFila(item);
    setOnline(true);
    iniciar.mockResolvedValue(run);
    responder.mockResolvedValue({});
    expect(await sincronizarWorkflows()).toBe(1);
    expect(pendentesWorkflow()).toBe(0);
  });

  it("falha de rede mantém o item para a próxima tentativa", async () => {
    setOnline(false);
    await enviarWorkflowComFila(item);
    setOnline(true);
    iniciar.mockRejectedValue(new TypeError("failed to fetch"));
    expect(await sincronizarWorkflows()).toBe(0);
    expect(pendentesWorkflow()).toBe(1);
  });
});
