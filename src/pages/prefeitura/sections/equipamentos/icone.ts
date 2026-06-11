/** Emoji representativo do tipo de equipamento (para chips/tabelas). */
export function iconeTipo(tipo: string): string {
  const t = tipo.toLowerCase();
  if (/escav|retro|trator|carregadeira|motonivel|rolo|m[aá]quina/.test(t))
    return "🚜";
  if (/caminh|truck|basculante|pipa|munck|comboio|betoneira|ba[uú]/.test(t))
    return "🚚";
  if (/van|sprinter|furg/.test(t)) return "🚐";
  if (/ambul/.test(t)) return "🚑";
  return "🚗";
}
