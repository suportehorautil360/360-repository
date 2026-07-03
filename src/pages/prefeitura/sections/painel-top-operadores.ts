export type TopOperadorPainel = {
  nome: string;
  total: number;
};

function truncarNome(nome: string, max = 20): string {
  const limpo = nome.trim();
  if (limpo.length <= max) return limpo;
  return `${limpo.slice(0, max - 1)}…`;
}

export function topOperadoresParaGrafico(operadores: TopOperadorPainel[]) {
  return operadores.map((op) => ({
    label: truncarNome(op.nome),
    valor: op.total,
  }));
}
