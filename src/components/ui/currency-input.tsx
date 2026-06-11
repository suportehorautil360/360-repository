import * as React from "react";

import { cn } from "@/lib/utils";
import { digitosParaCentavos, formatBRL } from "@/utils/moeda";

export interface CurrencyInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "value" | "onChange" | "type" | "inputMode"
  > {
  /** Valor em reais (ex.: 1234.56). */
  value: number;
  /** Disparado com o novo valor em reais a cada digitação. */
  onValueChange: (value: number) => void;
}

/**
 * Input de moeda (BRL) com máscara por centavos: o usuário digita apenas
 * números e eles preenchem da direita para a esquerda (R$ 0,00 → R$ 1,00 → ...).
 * O valor exposto é sempre em reais (number). Estilização via `className`.
 */
export function CurrencyInput({
  value,
  onValueChange,
  className,
  placeholder = "R$ 0,00",
  ...props
}: CurrencyInputProps) {
  const display = value ? formatBRL(value) : "";

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      data-slot="currency-input"
      className={cn(className)}
      value={display}
      placeholder={placeholder}
      onChange={(e) => onValueChange(digitosParaCentavos(e.target.value) / 100)}
    />
  );
}
