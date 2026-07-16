/**
 * Quem enxerga cada frente de trabalho.
 *
 * ATENÇÃO: isto é organização de tela, NÃO controle de acesso. O client HTTP
 * (`lib/api/client.ts`) não envia identidade, então `GET /work-front/:id`
 * devolve todas as frentes da prefeitura para qualquer chamador. A regra só
 * passa a valer de verdade quando o backend filtrar — ver
 * `docs/backend-frentes-responsavel.md`.
 */

/** Só o que a regra lê da sessão (`useLogin().user`). */
export interface AcessoFrente {
  id?: string;
  perfil?: string;
}

/** Só o que a regra lê da frente — mantém a função testável sem montar `Frente`. */
export interface FrenteComResponsavel {
  responsavelId: string;
}

export function podeVerFrente(
  frente: FrenteComResponsavel,
  acesso: AcessoFrente | undefined,
): boolean {
  if ((acesso?.perfil ?? "").trim().toLowerCase() === "admin") return true;

  // Frente legada (criada antes do campo): sem responsável definido, ficaria
  // invisível para todos. Mesmo fallback do `podeAcessarGrupo` com cargo vazio.
  if (!frente.responsavelId) return true;

  return !!acesso?.id && frente.responsavelId === acesso.id;
}
