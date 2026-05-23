/** Inferência da categoria do checklist a partir do equipamento (funções puras). */

export function checklistCategoriaFromMaquina(catMaquina: string): string {
  if (catMaquina.startsWith("Caminhão")) return "Caminhões";
  return catMaquina;
}

/**
 * Infere a categoria do checklist a partir do label/modelo do equipamento do
 * Firestore, pois o campo `linha` guarda a linha de produto (ex: "Linha
 * Amarela"), não o tipo de máquina.
 */
export function inferirCategoriaChecklist(label: string, modelo: string): string {
  const s = `${label} ${modelo}`.toLowerCase();
  if (s.includes("motoniveladora")) return "Motoniveladora";
  if (s.includes("escavadeira")) return "Escavadeira";
  if (
    s.includes("trator de esteira") ||
    (s.includes("trator") && s.includes("esteira"))
  )
    return "Trator de Esteira";
  if (s.includes("caminhão") || s.includes("caminhao")) return "Caminhões";
  if (s.includes("retroescavadeira") || s.includes("retroescavadeira"))
    return "Retroescavadeira";
  if (
    s.includes("pa carregadeira") ||
    s.includes("pá carregadeira") ||
    s.includes("carregadeira")
  )
    return "Pá Carregadeira";
  if (s.includes("rolo compactador") || s.includes("compactador"))
    return "Rolo Compactador";
  if (s.includes("trator")) return "Trator";
  // fallback: tenta pelo campo linha (caso seja o próprio nome da categoria)
  return label || modelo;
}
