/**
 * Adapter: mantém o mesmo shape (`AutenticacaoResultado`, `Funcionario`) que o
 * `funcionariosApi.autenticar` do legado usava, mas por trás chama a Edge
 * Function `login-operador` (v4) do Supabase. Aceita CPF OU loginGerado.
 *
 * Cache offline, navegação e save de credencial continuam iguais.
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
 * side-channel pra evitar um segundo round-trip.
 *
 * `identificador` pode ser CPF (11 dígitos) ou `loginGerado` (ex: "vinicius814").
 * A Edge Function v4 resolve os dois formatos.
 *
 * `companyId` opcional: quando o mesmo CPF/login está cadastrado em >1 empresa,
 * o primeiro login retorna `motivo: "multi-empresa"` + `opcoes`; o segundo
 * envio deve passar o `companyId` escolhido pra concluir a autenticação.
 */
export async function autenticarViaSupabase(
  identificador: string,
  senha: string,
  companyId?: string,
): Promise<AutenticacaoResultado & { companyName?: string | null }> {
  const raw = (identificador || "").trim();
  if (!raw) return { ok: false, motivo: "nao-encontrado" };

  const r = await loginOperadorSupabase({
    identificador: raw,
    senha,
    companyId,
  });

  if (r.ok) {
    return {
      ok: true,
      funcionario: toFuncionario(r.operador),
      companyName: r.operador.companyName,
    };
  }

  // 409 — CPF/login cadastrado em mais de uma empresa. Devolve `opcoes` pra UI
  // renderizar o seletor de empresa; ao escolher, chama de novo passando companyId.
  if (r.status === 409 && r.opcoes) {
    return { ok: false, motivo: "multi-empresa", opcoes: r.opcoes };
  }

  if (r.status === 401) return { ok: false, motivo: "senha-invalida" };
  if (r.status === 429) {
    // Sem motivo próprio no legado — a UI mostra a mensagem que a Edge Function
    // retornou via throw. `senha-invalida` é a aproximação mais próxima.
    return { ok: false, motivo: "senha-invalida" };
  }
  return { ok: false, motivo: "nao-encontrado" };
}
