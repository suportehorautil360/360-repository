import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NomeOperadorDialog } from "./NomeOperadorDialog";

describe("NomeOperadorDialog", () => {
  it("botão desabilitado com nome vazio", () => {
    render(
      <NomeOperadorDialog open onConfirmar={() => {}} onCancelar={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /entrar/i })).toBeDisabled();
  });

  it("preenche nome e confirma", () => {
    const onConfirmar = vi.fn();
    render(
      <NomeOperadorDialog
        open
        onConfirmar={onConfirmar}
        onCancelar={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/joão/i), {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(onConfirmar).toHaveBeenCalledWith("Ana");
  });

  it("botão habilitado quando nome preenchido", () => {
    render(
      <NomeOperadorDialog open onConfirmar={() => {}} onCancelar={() => {}} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/joão/i), {
      target: { value: "Maria" },
    });
    expect(screen.getByRole("button", { name: /entrar/i })).not.toBeDisabled();
  });

  it("Enter no input dispara confirmar quando nome preenchido", () => {
    const onConfirmar = vi.fn();
    render(
      <NomeOperadorDialog
        open
        onConfirmar={onConfirmar}
        onCancelar={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/joão/i), {
      target: { value: "Carlos" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/joão/i), {
      key: "Enter",
    });
    expect(onConfirmar).toHaveBeenCalledWith("Carlos");
  });

  it("Enter no input NÃO dispara confirmar quando nome vazio", () => {
    const onConfirmar = vi.fn();
    render(
      <NomeOperadorDialog
        open
        onConfirmar={onConfirmar}
        onCancelar={() => {}}
      />,
    );
    fireEvent.keyDown(screen.getByPlaceholderText(/joão/i), {
      key: "Enter",
    });
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("cancela ao fechar modal", () => {
    const onCancelar = vi.fn();
    render(
      <NomeOperadorDialog
        open
        onConfirmar={() => {}}
        onCancelar={onCancelar}
      />,
    );
    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);
    expect(onCancelar).toHaveBeenCalled();
  });

  it("renderiza com nome contendo espaços em branco e faz trim", () => {
    const onConfirmar = vi.fn();
    render(
      <NomeOperadorDialog
        open
        onConfirmar={onConfirmar}
        onCancelar={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/joão/i), {
      target: { value: "  Pedro  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(onConfirmar).toHaveBeenCalledWith("Pedro");
  });
});
