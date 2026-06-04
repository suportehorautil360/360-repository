/**
 * Utilidades de CNPJ. Puro (sem Firestore) para ser facilmente testável.
 * Guardamos o CNPJ "limpo" (só dígitos); a formatação é só para exibir.
 */

/** Remove tudo que não for dígito. */
export function limparCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

/** Formata 14 dígitos como 00.000.000/0000-00 (parciais legíveis ao digitar). */
export function formatarCnpj(cnpj: string): string {
  const d = limparCnpj(cnpj).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(
    8,
    12,
  )}-${d.slice(12)}`;
}

/** Valida CNPJ pelos dígitos verificadores (rejeita repetidos como 11.111...). */
export function cnpjValido(cnpj: string): boolean {
  const d = limparCnpj(cnpj);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const dv = (base: string): number => {
    // Pesos do módulo 11 (começam em 5 ou 6 conforme o tamanho da base).
    let peso = base.length - 7;
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const dig1 = dv(d.slice(0, 12));
  const dig2 = dv(d.slice(0, 13));
  return dig1 === Number(d[12]) && dig2 === Number(d[13]);
}
