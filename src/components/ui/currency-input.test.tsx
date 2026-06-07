import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CurrencyInput } from "./currency-input";

/** Wrapper controlado: reflete o valor de volta no input, como na tela real. */
function Controlado({ onValue }: { onValue?: (v: number) => void }) {
  const [valor, setValor] = useState(0);
  return (
    <CurrencyInput
      aria-label="custo"
      value={valor}
      onValueChange={(v) => {
        setValor(v);
        onValue?.(v);
      }}
    />
  );
}

describe("CurrencyInput", () => {
  it("exibe vazio quando o valor é 0 (mostra o placeholder)", () => {
    render(<CurrencyInput aria-label="custo" value={0} onValueChange={() => {}} />);
    const input = screen.getByLabelText("custo") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("formata o valor em reais como moeda BRL", () => {
    render(
      <CurrencyInput aria-label="custo" value={1234.56} onValueChange={() => {}} />,
    );
    const input = screen.getByLabelText("custo") as HTMLInputElement;
    expect(input.value).toContain("1.234,56");
  });

  it("dispara onValueChange com o valor em reais (máscara por centavos)", () => {
    const onValue = vi.fn();
    render(<Controlado onValue={onValue} />);
    const input = screen.getByLabelText("custo") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "1234" } });
    expect(onValue).toHaveBeenLastCalledWith(12.34);
    expect(input.value).toContain("12,34");

    fireEvent.change(input, { target: { value: "123456" } });
    expect(onValue).toHaveBeenLastCalledWith(1234.56);
    expect(input.value).toContain("1.234,56");
  });

  it("usa inputMode numérico", () => {
    render(<CurrencyInput aria-label="custo" value={0} onValueChange={() => {}} />);
    expect(screen.getByLabelText("custo")).toHaveAttribute("inputmode", "numeric");
  });
});
