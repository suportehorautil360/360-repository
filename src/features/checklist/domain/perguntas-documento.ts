/**
 * Perguntas extraídas do documento `checklist_frota_completa_com_carro_leve`.
 *
 * A planilha original marca as primeiras perguntas como "Geral (Chassi)",
 * aplicáveis a todos os veículos, incluindo carro leve. Mantemos esse bloco em
 * TS para preservar compatibilidade com o seed legado e evitar depender do
 * arquivo `.numbers` em runtime.
 */
export const CHECKLIST_DOCUMENTO_GERAL_CHASSI = [
  "Teste de freio de serviço e estacionamento (freio de mão)",
  "Drenagem de água dos balões de ar do freio (ou teste de hidrovácuo em leves)",
  "Pneus dianteiros e traseiros (sulco/TWI e sem cortes)",
  "Estado do estepe e aperto das porcas das rodas",
  "Folga excessiva no volante ou estalos na direção/suspensão",
  "Faróis (alto e baixo) e luzes de seta funcionando",
  "Luz de freio, luz de ré e pisca-alerta funcionando",
  "Para-brisa (sem trincas na área de visão) e palhetas do limpador",
  "Retrovisores esquerdo/direito (sem quebras e regulados)",
  "Extintor de incêndio da cabine (validade e pressão na faixa verde)",
  "Cintos de segurança (motorista e passageiro travando)",
  "Triângulo de sinalização, macaco e chave de roda",
  "Validade da CNH do condutor e documento do veículo (CRLV)",
  "Nível do óleo do motor e nível do líquido de arrefecimento",
  "Nível do fluido de freio/embreagem e óleo da direção hidráulica",
  "Luzes secundárias (luz de placa, lanternas de posição/Marias)",
  "Marcador de combustível e funcionamento do odômetro/horímetro",
  "Luzes de advertência do painel de instrumentos apagadas",
  "Funcionamento da buzina e do ar-condicionado/ventilador",
  "Limpeza e higienização geral interna da cabine",
] as const;

export const CHECKLIST_DOCUMENTO_MUNCK = [
  "Estado dos pistões das patolas (sem vazamento ou riscos)",
  "Travas mecânicas de segurança e sapatas estabilizadoras",
  "Vazamento hidráulico no bloco de comando ou mangueiras",
  "Ganchos com trava de segurança operando",
  "Estado dos cabos de aço (sem desfiados) ou cintas",
] as const;

export type ChecklistDocumentoCategoria = "Geral (Chassi)" | "Munck";

export type ChecklistDocumentoItem = {
  Categoria: ChecklistDocumentoCategoria;
  "Nº": string;
  "Item de Verificação": string;
  Tipo: "Sim/Não";
  origem: "documento";
};

function toItens(
  categoria: ChecklistDocumentoCategoria,
  prefixo: string,
  labels: readonly string[],
): ChecklistDocumentoItem[] {
  return labels.map((label, idx) => ({
    Categoria: categoria,
    "Nº": `${prefixo}.${idx + 1}`,
    "Item de Verificação": label,
    Tipo: "Sim/Não",
    origem: "documento",
  }));
}

export const CHECKLIST_DOCUMENTO_ITENS: ChecklistDocumentoItem[] = [
  ...toItens("Geral (Chassi)", "G", CHECKLIST_DOCUMENTO_GERAL_CHASSI),
  ...toItens("Munck", "MUNCK", CHECKLIST_DOCUMENTO_MUNCK),
];
