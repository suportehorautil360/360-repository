import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Combobox, type ComboboxOption } from "./combobox";

const OPCOES: ComboboxOption[] = [
  { value: "v1", label: "Civic", keywords: ["CAR-003", "Honda"] },
  { value: "v2", label: "Escavadeira", keywords: ["MQ-01", "Caterpillar"] },
  { value: "v3", label: "Golf", keywords: ["CAR-010", "VW"] },
];

function Wrapper({ onValue }: { onValue?: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <Combobox
      options={OPCOES}
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
      placeholder="Selecione um equipamento..."
      searchPlaceholder="Buscar por chassi, placa ou nome..."
    />
  );
}

describe("Combobox", () => {
  it("abre e mostra TODAS as opções (busca vazia)", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("Civic")).toBeInTheDocument();
    expect(screen.getByText("Escavadeira")).toBeInTheDocument();
    expect(screen.getByText("Golf")).toBeInTheDocument();
  });

  it("filtra por nome", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/buscar/i), "esc");
    expect(await screen.findByText("Escavadeira")).toBeInTheDocument();
    expect(screen.queryByText("Civic")).not.toBeInTheDocument();
    expect(screen.queryByText("Golf")).not.toBeInTheDocument();
  });

  it("filtra por chassi/placa (keyword), não pelo id", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/buscar/i), "CAR-010");
    expect(await screen.findByText("Golf")).toBeInTheDocument();
    expect(screen.queryByText("Civic")).not.toBeInTheDocument();
  });

  it("seleciona e fecha", async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Wrapper onValue={onValue} />);
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Golf"));
    expect(onValue).toHaveBeenCalledWith("v3");
  });
});
