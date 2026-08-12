/**
 * Cache offline de chassis por empresa.
 *
 * Chassis (identificadores de veículos/equipamentos) de cada empresa ficam no
 * aparelho por 7 dias e permitem resolução offline: dado um chassi, retorna
 * qual empresa o possui. Populado pelo servidor durante login ou provisão.
 *
 * NOTA: Os chassis aqui armazenados já vêm normalizados do servidor (ou são
 * normalizados no ato da provisão). A busca também normaliza o input para
 * garantir match case-insensitive e com espaços.
 */

const KEY = 'hu360-chassis-offline';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type EmpresaChassis = {
  empresaId: string;
  empresaNome: string;
  chassis: string[];       // já normalizados
  expiraEm: string;        // ISO
};

function normalizar(c: string): string {
  return (c ?? '').toString().toUpperCase().replace(/\s+/g, '');
}

function ler(): EmpresaChassis[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

function gravar(lista: EmpresaChassis[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lista));
  } catch {
    /* cota cheia — cache offline fica indisponível, resolução online segue */
  }
}

function vigentes(lista: EmpresaChassis[]): EmpresaChassis[] {
  const now = Date.now();
  return lista.filter((e) => Date.parse(e.expiraEm) > now);
}

export function provisionarChassisEmpresa(entrada: EmpresaChassis): void {
  const norm: EmpresaChassis = {
    ...entrada,
    chassis: [...new Set(entrada.chassis.map(normalizar).filter(Boolean))],
  };
  const outras = vigentes(ler()).filter((e) => e.empresaId !== entrada.empresaId);
  gravar([...outras, norm]);
}

export function resolverChassiOffline(input: string): { empresaId: string; empresaNome: string } | null {
  const alvo = normalizar(input);
  if (!alvo) return null;
  for (const emp of vigentes(ler())) {
    if (emp.chassis.includes(alvo)) return { empresaId: emp.empresaId, empresaNome: emp.empresaNome };
  }
  return null;
}

export function removerChassisEmpresa(empresaId: string): void {
  gravar(vigentes(ler()).filter((e) => e.empresaId !== empresaId));
}

export function limparExpirados(): void {
  gravar(vigentes(ler()));
}
