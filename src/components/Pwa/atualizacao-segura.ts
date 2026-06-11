/**
 * Coordena o auto-update do PWA com o que o usuário está fazendo. Telas que
 * têm trabalho não salvo (checklist/emergência em preenchimento) se marcam
 * aqui; o PwaUpdatePrompt só recarrega sozinho quando não há nada a perder.
 */
const origens = new Set<string>();

export function marcarTrabalhoEmAndamento(origem: string, emAndamento: boolean) {
  if (emAndamento) origens.add(origem);
  else origens.delete(origem);
}

export function podeAtualizarComSeguranca(): boolean {
  return origens.size === 0;
}

/** Somente para testes. */
export function __resetTrabalhos() {
  origens.clear();
}
