/**
 * Login offline do operador.
 *
 * Após um login online bem-sucedido, a credencial fica no aparelho por
 * 7 dias e permite entrar sem rede (campo sem sinal). Limitações aceitas:
 * só entra offline quem já logou neste aparelho, e um funcionário desligado
 * consegue logar offline até a credencial expirar — por isso o prazo curto
 * e a renovação/remoção a cada tentativa online.
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

/** Guarda/renova a credencial após um login online bem-sucedido. */
export async function salvarCredencialOffline(entrada: {
  funcionario: Funcionario;
  empresa: string;
  senha: string;
}): Promise<void> {
  const { funcionario, empresa, senha } = entrada;
  const identificadores = [
    limparCpf(funcionario.cpf ?? ""),
    (funcionario.loginGerado ?? "").toLowerCase(),
  ].filter(Boolean);
  const credencial: CredencialOffline = {
    identificadores,
    // Mesmo salt do banco (CPF) — ver hashSenhaFuncionario em funcionarios.ts.
    senhaHash: await hashSenha(`${limparCpf(funcionario.cpf ?? "")}:${senha}`),
    funcionario,
    empresa,
    expiraEm: new Date(Date.now() + CREDENCIAL_TTL_MS).toISOString(),
  };
  gravar([
    ...vigentes(ler()).filter((c) => c.funcionario.id !== funcionario.id),
    credencial,
  ]);
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
