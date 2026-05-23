import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { OfflineIndicator } from "./OfflineIndicator";

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OfflineIndicator", () => {
  it("não mostra nada quando online", () => {
    setOnline(true);
    render(<OfflineIndicator />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("mostra o aviso quando inicia offline", () => {
    setOnline(false);
    render(<OfflineIndicator />);
    expect(screen.getByRole("status")).toHaveTextContent(/Offline/i);
  });

  it("aparece ao perder conexão e some ao reconectar", () => {
    setOnline(true);
    render(<OfflineIndicator />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
