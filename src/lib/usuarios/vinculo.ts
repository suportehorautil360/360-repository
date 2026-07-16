/**
 * Predicados de vínculo da coleção `users`, compartilhados entre o hub admin
 * e o portal da prefeitura (mesmo motivo de `lib/funcionarios/cargos.ts`).
 */

/** Só o que os predicados leem — evita acoplar `lib` ao tipo do admin. */
export interface UsuarioComVinculo {
  vinculo?: string;
}

/**
 * Usuário do portal da prefeitura. Docs legados não têm `vinculo`: a ausência
 * conta como "prefeitura", senão eles somem das listagens.
 */
export function vinculoPrefeitura(u: UsuarioComVinculo): boolean {
  const v = u.vinculo || "prefeitura";
  return v !== "oficina" && v !== "posto" && v !== "locacao";
}

export function vinculoOficina(u: UsuarioComVinculo): boolean {
  return u.vinculo === "oficina";
}

export function vinculoPosto(u: UsuarioComVinculo): boolean {
  return u.vinculo === "posto";
}

export function vinculoLocacao(u: UsuarioComVinculo): boolean {
  return u.vinculo === "locacao";
}
