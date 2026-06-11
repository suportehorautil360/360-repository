import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const updateServiceWorker = vi.fn();
let needRefresh = true;

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    offlineReady: [false, vi.fn()],
    needRefresh: [needRefresh, vi.fn()],
    updateServiceWorker,
  }),
}));

import { PwaUpdatePrompt } from "./PwaUpdatePrompt";
import {
  __resetTrabalhos,
  marcarTrabalhoEmAndamento,
} from "./atualizacao-segura";

beforeEach(() => {
  vi.useFakeTimers();
  updateServiceWorker.mockReset();
  __resetTrabalhos();
  needRefresh = true;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PwaUpdatePrompt — auto-update pós-deploy", () => {
  it("sem trabalho em andamento, aplica a nova versão sozinho", () => {
    render(<PwaUpdatePrompt />);
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it("com checklist em preenchimento, mostra o aviso e NÃO recarrega", () => {
    marcarTrabalhoEmAndamento("checklist", true);
    render(<PwaUpdatePrompt />);
    expect(updateServiceWorker).not.toHaveBeenCalled();
    expect(screen.getByText("Nova versão disponível.")).toBeTruthy();
  });

  it("quando o trabalho termina, aplica na checagem seguinte", () => {
    marcarTrabalhoEmAndamento("checklist", true);
    render(<PwaUpdatePrompt />);
    expect(updateServiceWorker).not.toHaveBeenCalled();
    marcarTrabalhoEmAndamento("checklist", false);
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it("sem nova versão, não renderiza nada nem agenda update", () => {
    needRefresh = false;
    const { container } = render(<PwaUpdatePrompt />);
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(container.firstChild).toBeNull();
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });
});
