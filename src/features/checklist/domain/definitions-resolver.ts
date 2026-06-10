/**
 * Resolver data-driven do checklist do operador.
 *
 * Substitui os helpers hardcoded (`inferirCategoriaChecklist` + `itensDaCategoria`)
 * por equivalentes alimentados pelas definições vindas do backend (catálogo
 * global). Mantém o seed embutido (`hu360OperadorSeed.json`) como fonte do
 * fallback offline — ver `buildSeedDefinitions`.
 */
import type {
  ChecklistDefinition,
  ChecklistDefinitionItem,
} from "../api/checklist-definitions-api";
import { inferirCategoriaChecklist } from "./categoria";
import { itensDaCategoria } from "./itens";

/** Mesma normalização de `itens.ts` — fonte ÚNICA do dedup por texto. */
function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Item no shape legado que a UI do operador já consome. */
export interface ItemOperador {
  "Nº": number;
  "Item de Verificação": string;
  Severidade: string;
  "Aplica A": string[];
  "Categoria Origem"?: string;
}

/**
 * Itens de uma definição no shape legado da UI: ordena por `ordem`, **deduplica
 * por texto e renumera `Nº` de 1..N** (mesmo invariante de `itensDaCategoria` —
 * o `Nº` é a CHAVE das respostas e precisa ser único).
 */
export function itensDaDefinition(def: ChecklistDefinition): ItemOperador[] {
  const vistos = new Set<string>();
  return [...(def.itens ?? [])]
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .filter((it) => {
      const t = norm(it.texto);
      if (!t || vistos.has(t)) return false;
      vistos.add(t);
      return true;
    })
    .map((it, i) => ({
      "Nº": i + 1,
      "Item de Verificação": it.texto,
      Severidade: it.severidade,
      "Aplica A": [def.categoria],
      "Categoria Origem": def.categoria,
    }));
}

/** A definição genérica de caminhão só vale quando nenhuma específica casar. */
function isGenericoCaminhao(def: ChecklistDefinition): boolean {
  return def.categoria === "Caminhões";
}

/**
 * Infere a definição de checklist a partir do equipamento, por palavra-chave.
 * Substitui `inferirCategoriaChecklist`: casa pela primeira definição ATIVA cujo
 * keyword aparece no texto, preferindo o match mais específico (keyword mais
 * longa) e deixando a genérica "Caminhões" por último. Cai no inferidor legado
 * quando nada casa.
 */
export function inferirDefinition(
  definitions: ChecklistDefinition[],
  label: string,
  modelo: string,
  contexto = "",
): ChecklistDefinition | null {
  const text = norm(`${contexto} ${label} ${modelo}`);
  const scored: { def: ChecklistDefinition; len: number; generic: boolean }[] =
    [];

  for (const def of definitions) {
    if (def.ativo === false) continue;
    let best = 0;
    for (const kw of def.keywords ?? []) {
      const k = norm(kw);
      if (k && text.includes(k)) best = Math.max(best, k.length);
    }
    if (best > 0)
      scored.push({ def, len: best, generic: isGenericoCaminhao(def) });
  }

  if (scored.length > 0) {
    scored.sort(
      (a, b) =>
        Number(a.generic) - Number(b.generic) || // específicas antes da genérica
        b.len - a.len, // depois, keyword mais longa (mais específica)
    );
    return scored[0].def;
  }

  // Fallback: inferidor legado por categoria + lookup no catálogo.
  const cat = inferirCategoriaChecklist(label, modelo, contexto);
  return (
    definitions.find((d) => d.categoria === cat && d.ativo !== false) ?? null
  );
}

/** Palavras-chave por categoria, na precedência da inferência legada. */
const SEED_KEYWORDS: { categoria: string; keywords: string[] }[] = [
  { categoria: "Carro Leve", keywords: ["carro leve", "linha leve", "veiculo leve", "veículo leve", "automovel", "automóvel"] },
  { categoria: "Caminhão Munck", keywords: ["munck", "munk"] },
  { categoria: "Caminhão Pipa", keywords: ["pipa"] },
  { categoria: "Caminhão Basculante", keywords: ["basculante"] },
  { categoria: "Betoneira", keywords: ["betoneira"] },
  { categoria: "Comboio", keywords: ["comboio"] },
  { categoria: "Ambulância", keywords: ["ambulancia", "ambulância"] },
  { categoria: "Oficina", keywords: ["oficina"] },
  { categoria: "Baú", keywords: ["baú", "bau"] },
  { categoria: "Motoniveladora", keywords: ["motoniveladora"] },
  { categoria: "Escavadeira", keywords: ["escavadeira"] },
  { categoria: "Trator de Esteira", keywords: ["trator de esteira"] },
  { categoria: "Caminhões", keywords: ["caminhão", "caminhao"] },
  { categoria: "Retroescavadeira", keywords: ["retroescavadeira"] },
  { categoria: "Pá Carregadeira", keywords: ["pa carregadeira", "pá carregadeira", "carregadeira"] },
];

let seedDefinitionsCache: ChecklistDefinition[] | null = null;

/**
 * Constrói o catálogo a partir do seed embutido — fallback offline idêntico ao
 * que o backend serve. Reaproveita `itensDaCategoria` (dedup+renumeração) e
 * deriva as keywords da inferência legada. Memoizado.
 */
export function buildSeedDefinitions(): ChecklistDefinition[] {
  if (seedDefinitionsCache) return seedDefinitionsCache;

  const defs: ChecklistDefinition[] = [];
  for (const { categoria, keywords } of SEED_KEYWORDS) {
    const itens: ChecklistDefinitionItem[] = itensDaCategoria(categoria).map(
      (it) => ({
        ordem: Number(it["Nº"]),
        texto: String(it["Item de Verificação"]),
        severidade:
          (it as { Severidade?: string }).Severidade === "impeditivo"
            ? "impeditivo"
            : "normal",
      }),
    );
    defs.push({
      id: `seed:${categoria}`,
      nome: categoria,
      categoria,
      keywords,
      ativo: true,
      version: 1,
      itens,
    });
  }
  seedDefinitionsCache = defs;
  return defs;
}
