/**
 * Adapter: mantém o mesmo shape (`AutenticacaoResultado`, `Funcionario`) que o
 * `funcionariosApi.autenticar` do legado usava, mas por trás chama a Edge
 * Function `login-operador` do Supabase. O restante do fluxo (cache offline,
 * navegação, salvar credencial) continua idêntico.
 */
import type {
  AutenticacaoResultado,
  Funcionario,
  FuncionarioTipo,
} from "../funcionarios/funcionarios";
import { loginOperadorSupabase, type OperadorSessao } from "./session";

function toFuncionario(op: OperadorSessao): Funcionario {
  return {
    id: op.id,
    // `prefeituraId` no PWA legado = docId Firestore. Preservamos o legacyId
    // aqui pra endpoints REST NestJS remanescentes continuarem casando.
    prefeituraId: op.companyLegacyId ?? op.companyId,
    nome: op.nome,
    cpf: op.cpf,
    cargo: op.cargo ?? "",
    telefone: undefined,
    tipo: (op.tipo ?? "operador") as FuncionarioTipo,
    status: "ativo", // server só devolve ativos
    temSenha: true, // login sucesso implica senha configurada
  };
}

/**
 * Wrapper com a mesma assinatura de `funcionariosApi.autenticar`. Devolve o
 * `AutenticacaoResultado` já mapeado. Também exporta o `companyName` via
 * side-channel pra evitar um segundo round-trip pra buscar o nome da empresa.
 */
export async function autenticarViaSupabase(
  identificador: string,
  senha: string,
): Promise<AutenticacaoResultado & { companyName?: string | null }> {
  // A Edge Function só aceita CPF (11 dígitos). Se o identificador vier como
  // loginGerado (nome+3 últimos), rejeita — o PWA sempre pode ter os dois
  // fluxos, mas o operador sempre tem o CPF disponível. Deixamos claro pra UI.
  const cpfLimpo = (identificador || "").replace(/\D+/g, "");
  if (cpfLimpo.length !== 11) {
    return { ok: false, motivo: "nao-encontrado" };
  }

  const r = await loginOperadorSupabase({ cpf: cpfLimpo, senha });
  if (r.ok) {
    return {
      ok: true,
      funcionario: toFuncionario(r.operador),
      companyName: r.operador.companyName,
    };
  }

  // Mapeia status HTTP → motivo do legado.
  if (r.status === 401) return { ok: false, motivo: "senha-invalida" };
  if (r.status === 429) {
    // Não temos motivo específico no legado — cai em "senha-invalida" pra UI
    // exibir a mensagem que a própria Edge Function retorna no throw.
    return { ok: false, motivo: "senha-invalida" };
  }
  return { ok: false, motivo: "nao-encontrado" };
}
