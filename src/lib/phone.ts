import { parsePhoneNumber, type Country } from "react-phone-number-input";

/**
 * Normaliza um número para E.164 (`+55…`). Se já vier com `+`, o DDI é
 * respeitado; caso contrário, assume `defaultCountry` (Brasil por padrão).
 * Retorna `undefined` para vazio ou número não parseável — usado para migrar
 * números legados (sem DDI) na carga do formulário.
 */
export function toE164(
  raw: string | null | undefined,
  defaultCountry: Country = "BR",
): string | undefined {
  const v = (raw ?? "").trim();
  if (!v) return undefined;
  try {
    const parsed = parsePhoneNumber(
      v,
      v.startsWith("+") ? undefined : defaultCountry,
    );
    return parsed?.number;
  } catch {
    return undefined;
  }
}
