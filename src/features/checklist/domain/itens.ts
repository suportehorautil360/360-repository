import seedData from "../../../data/hu360OperadorSeed.json";

export type ItemSeed = (typeof seedData.itens_checklist)[number];

function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Itens do checklist de uma categoria: filtra pelo `Aplica A` (fallback
 * `Categoria`), remove duplicados por texto e **renumera o `Nº` de 1..N**.
 *
 * O `Nº` do seed se repete entre itens (ex.: vários "1.1"); como ele é a CHAVE
 * das respostas (`answers`), precisa ser único. Esta é a fonte ÚNICA usada
 * tanto na captura do checklist quanto na resolução do nome na auditoria.
 */
export function itensDaCategoria(cat: string): ItemSeed[] {
  const vistos = new Set<string>();
  return seedData.itens_checklist
    .filter((it) => {
      const aplicaA = (it as { "Aplica A"?: string[] })["Aplica A"];
      const aplica = Array.isArray(aplicaA)
        ? aplicaA.includes(cat)
        : (it as { Categoria?: string }).Categoria === cat;
      if (!aplica) return false;
      const t = norm((it as { "Item de Verificação"?: unknown })["Item de Verificação"]);
      if (!t || vistos.has(t)) return false;
      vistos.add(t);
      return true;
    })
    .map((it, i) => ({ ...it, "Nº": i + 1 }));
}
