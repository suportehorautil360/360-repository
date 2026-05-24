import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

function mockStandaloneMode(value: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: value && query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function createBeforeInstallPromptEvent() {
  const event = new Event("beforeinstallprompt") as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: "accepted"; platform: string }>;
  };

  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({
    outcome: "accepted",
    platform: "web",
  });
  vi.spyOn(event, "preventDefault");

  return event;
}

async function renderInstallHarness() {
  const { usePwaInstallPrompt } = await import("./usePwaInstallPrompt");

  function InstallHarness() {
    const { canInstall, installApp } = usePwaInstallPrompt();

    return canInstall ? (
      <button type="button" onClick={installApp}>
        Instalar app
      </button>
    ) : (
      <span>Nada para instalar</span>
    );
  }

  return render(<InstallHarness />);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePwaInstallPrompt", () => {
  it("guarda o prompt de instalação e expõe o botão quando o app é instalável", async () => {
    mockStandaloneMode(false);
    await renderInstallHarness();

    expect(screen.getByText("Nada para instalar")).toBeInTheDocument();

    const event = createBeforeInstallPromptEvent();
    await act(async () => {
      window.dispatchEvent(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /instalar app/i })).toBeVisible();
  });

  it("chama o prompt nativo e esconde o botão após usar a escolha do usuário", async () => {
    mockStandaloneMode(false);
    await renderInstallHarness();

    const event = createBeforeInstallPromptEvent();
    await act(async () => {
      window.dispatchEvent(event);
    });

    await userEvent.click(screen.getByRole("button", { name: /instalar app/i }));

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Nada para instalar")).toBeInTheDocument();
  });

  it("não expõe instalação quando o app já está em modo standalone", async () => {
    mockStandaloneMode(true);
    await renderInstallHarness();

    const event = createBeforeInstallPromptEvent();
    await act(async () => {
      window.dispatchEvent(event);
    });

    expect(screen.queryByRole("button", { name: /instalar app/i })).toBeNull();
  });
});
