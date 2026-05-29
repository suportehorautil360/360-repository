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
/**
 * Categorias canônicas usadas no seed (campo `Aplica A` dos itens).
 * Manter sincronizado com o seed — qualquer mismatch faz o checklist
 * abrir vazio para o tipo de equipamento correspondente.
 */
export const CATEGORIAS_CHECKLIST = [
  "Caminhões",
  "Caminhão Munck",
  "Caminhão Pipa",
  "Caminhão Basculante",
  "Oficina",
  "Baú",
  "Betoneira",
  "Comboio",
  "Ambulância",
  "Carro Leve",
  "Motoniveladora",
  "Escavadeira",
  "Pá Carregadeira",
  "Retroescavadeira",
  "Trator de Esteira",
  "Rolo Compactador",
  "Trator",
] as const;

export function inferirCategoriaChecklist(
  label: string,
  modelo: string,
  contexto = "",
): string {
  const s = `${contexto} ${label} ${modelo}`.toLowerCase();
  if (
    s.includes("carro leve") ||
    s.includes("linha leve") ||
    s.includes("veiculo leve") ||
    s.includes("veículo leve") ||
    s.includes("automovel") ||
    s.includes("automóvel")
  )
    return "Carro Leve";
  // Subtipos de caminhão precisam casar com as categorias do seed
  // (`Caminhão Munck`, `Caminhão Pipa`, `Caminhão Basculante`).
  if (s.includes("munck") || s.includes("munk")) return "Caminhão Munck";
  if (s.includes("pipa")) return "Caminhão Pipa";
  if (s.includes("basculante")) return "Caminhão Basculante";
  if (s.includes("betoneira")) return "Betoneira";
  if (s.includes("comboio")) return "Comboio";
  if (s.includes("ambulancia") || s.includes("ambulância"))
    return "Ambulância";
  if (s.includes("oficina")) return "Oficina";
  if (s.includes("baú") || s.includes("bau")) return "Baú";
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
