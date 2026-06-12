/**
 * Login offline do operador.
 *
 * Credenciais (hash com o mesmo esquema do banco) ficam no aparelho por 7 dias
 * e permitem entrar sem rede. Duas formas de popular: o login online
 * individual (salvarCredencialOffline) e o provisionamento da prefeitura
 * inteira no 1º acesso online (provisionarCredenciaisPrefeitura) — este último
 * deixa qualquer operador da prefeitura logar offline, inclusive na 1ª vez
 * dele neste aparelho (compartilhado). Limitações aceitas: um funcionário
 * desligado loga offline até a credencial expirar — daí o prazo curto e a
 * renovação/remoção a cada contato com rede.
 *
 * NOTA DE SEGURANÇA: o hash é SHA-256 sem salt (fraco). Com o provisionamento,
 * os hashes de toda a prefeitura ficam no aparelho — risco aceito por ora;
 * fortalecer o hash (bcrypt/salt no back) é dívida conhecida.
 */
import { hashSenha } from "../../utils/hashSenha";
import { limparCpf } from "../../lib/funcionarios/cpf";
import type { Funcionario } from "../../lib/funcionarios/funcionarios";

const KEY = "hu360-credenciais-offline";
const CREDENCIAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CredencialOffline = {
  /** Formas de login aceitas: CPF limpo e loginGerado em minúsculas. */
  identificadores: string[];
  /** Mesmo esquema do banco (hashSenhaFuncionario): sha256("cpf:senha"). */
  senhaHash: string;
  funcionario: Funcionario;
  empresa: string;
  expiraEm: string;
};

function ler(): CredencialOffline[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CredencialOffline[]) : [];
  } catch {
    return [];
  }
}

function gravar(lista: CredencialOffline[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lista));
  } catch {
    /* cota cheia — login offline fica indisponível, login online segue */
  }
}

function normalizar(identificador: string): string {
  const limpo = limparCpf(identificador);
  return limpo.length === 11 ? limpo : identificador.trim().toLowerCase();
}

function vigentes(lista: CredencialOffline[]): CredencialOffline[] {
  return lista.filter((c) => Date.now() < Date.parse(c.expiraEm));
}

function montarCredencial(
  funcionario: Funcionario,
  senhaHash: string,
  empresa: string,
): CredencialOffline {
  return {
    identificadores: [
      limparCpf(funcionario.cpf ?? ""),
      (funcionario.loginGerado ?? "").toLowerCase(),
    ].filter(Boolean),
    senhaHash,
    funcionario,
    empresa,
    expiraEm: new Date(Date.now() + CREDENCIAL_TTL_MS).toISOString(),
  };
}

/** Substitui/insere as credenciais por id do funcionário, mantendo as demais. */
function mesclar(novas: CredencialOffline[]): void {
  const ids = new Set(novas.map((c) => c.funcionario.id));
  gravar([
    ...vigentes(ler()).filter((c) => !ids.has(c.funcionario.id)),
    ...novas,
  ]);
}

/** Guarda/renova a credencial após um login online bem-sucedido. */
export async function salvarCredencialOffline(entrada: {
  funcionario: Funcionario;
  empresa: string;
  senha: string;
}): Promise<void> {
  const { funcionario, empresa, senha } = entrada;
  // Mesmo salt do banco (CPF) — ver hashSenhaFuncionario em funcionarios.ts.
  const senhaHash = await hashSenha(`${limparCpf(funcionario.cpf ?? "")}:${senha}`);
  mesclar([montarCredencial(funcionario, senhaHash, empresa)]);
}

/**
 * Provisiona o aparelho com as credenciais de toda a prefeitura (hashes que já
 * vêm dos docs do Firestore, não recalculados). Assim qualquer operador da
 * prefeitura loga offline — inclusive na 1ª vez dele, num aparelho
 * compartilhado. Renovado a cada bootstrap online; expira em 7 dias.
 */
export function provisionarCredenciaisPrefeitura(
  itens: { funcionario: Funcionario; senhaHash: string }[],
  empresa: string,
): void {
  mesclar(
    itens
      .filter((i) => i.senhaHash)
      .map((i) => montarCredencial(i.funcionario, i.senhaHash, empresa)),
  );
}

/** Tenta autenticar sem rede contra a credencial guardada. */
export async function autenticarOffline(
  identificador: string,
  senha: string,
): Promise<{ funcionario: Funcionario; empresa: string } | null> {
  const ident = normalizar(identificador);
  const lista = vigentes(ler());
  gravar(lista); // descarta expiradas
  const credencial = lista.find((c) => c.identificadores.includes(ident));
  if (!credencial) return null;
  const cpf = limparCpf(credencial.funcionario.cpf ?? "");
  const esperado = await hashSenha(`${cpf}:${senha}`);
  if (credencial.senhaHash !== esperado) return null;
  return { funcionario: credencial.funcionario, empresa: credencial.empresa };
}

/** Remove a credencial (ex.: o servidor disse que a senha mudou). */
export function removerCredencialOffline(identificador: string): void {
  const ident = normalizar(identificador);
  gravar(ler().filter((c) => !c.identificadores.includes(ident)));
}
