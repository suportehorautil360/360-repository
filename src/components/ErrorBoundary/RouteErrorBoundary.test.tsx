import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

function Boom(): never {
  throw new Error("falha de chunk");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RouteErrorBoundary", () => {
  it("renderiza os filhos quando não há erro", () => {
    render(
      <RouteErrorBoundary>
        <p>conteúdo ok</p>
      </RouteErrorBoundary>,
    );
    expect(screen.getByText("conteúdo ok")).toBeInTheDocument();
  });

  it("mostra o fallback amigável quando um filho lança erro", () => {
    // Silencia o console.error esperado do React ao capturar o erro.
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <RouteErrorBoundary>
        <Boom />
      </RouteErrorBoundary>,
    );

    expect(
      screen.getByText(/Não foi possível carregar esta tela/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Tentar novamente/i }),
    ).toBeInTheDocument();
  });
});
