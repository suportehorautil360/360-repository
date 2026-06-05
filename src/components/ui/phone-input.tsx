import "react-phone-number-input/style.css";
import "./phone-input.css";
import PhoneInputLib, { type Value } from "react-phone-number-input";
import { cn } from "@/lib/utils";

export interface PhoneInputProps {
  /** Número em E.164 (`+55…`) ou `undefined` quando vazio. */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Campo de telefone com seletor de país (DDI), no tema dark do projeto.
 * O valor é sempre E.164 (`+55…`). País padrão: Brasil.
 */
export function PhoneInput({
  value,
  onChange,
  id,
  placeholder,
  disabled,
  className,
}: PhoneInputProps) {
  return (
    <PhoneInputLib
      international
      defaultCountry="BR"
      value={value as Value | undefined}
      onChange={(v) => onChange(v || undefined)}
      id={id}
      placeholder={placeholder}
      disabled={disabled}
      className={cn("hu-phone", className)}
    />
  );
}
