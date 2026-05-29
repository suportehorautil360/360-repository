/**
 * Utilidades de CPF. Puro (sem Firestore) para ser facilmente testável.
 * Armazenamos sempre o CPF "limpo" (só dígitos); a formatação é só para exibir.
 */

/** Remove tudo que não for dígito. */
export function limparCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

/** Formata 11 dígitos como 000.000.000-00 (deixa parciais legíveis ao digitar). */
export function formatarCpf(cpf: string): string {
  const d = limparCpf(cpf).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Valida CPF pelos dígitos verificadores (rejeita repetidos como 111.111.111-11). */
export function cpfValido(cpf: string): boolean {
  const d = limparCpf(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const dv = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const dig1 = dv(d.slice(0, 9), 10);
  const dig2 = dv(d.slice(0, 10), 11);
  return dig1 === Number(d[9]) && dig2 === Number(d[10]);
}
