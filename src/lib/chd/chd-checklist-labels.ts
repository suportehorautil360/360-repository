/** Rótulos dos itens CHD (espelha configs do postoapp). */

const GENERAL_STATE_LABELS: Record<string, string> = {
  limpezaInterna: "Limpeza interna",
  limpezaExterna: "Limpeza externa / lavagem",
  avariasFunilaria: "Avarias funilaria / pintura",
  vidrosRetrovisores: "Vidros e retrovisores",
  pneusRodas: "Pneus e rodas",
  iluminacaoGeral: "Iluminação geral",
  niveisFluidos: "Níveis de fluidos completados",
  ausenciaVazamentos: "Ausência de vazamentos",
  motor: "Motor — partida e funcionamento",
  freios: "Freios testados",
  hidraulico: "Sistema hidráulico",
  transmissao: "Transmissão / câmbio",
  parteEletrica: "Parte elétrica e painel",
  arCondicionado: "Ar-condicionado",
  testeCarga: "Teste sob carga / operação",
};

const MODULE_SECTION_TITLES: Record<string, string> = {
  "linha-amarela": "Bloco A — Linha Amarela",
  rodoviario: "Bloco B — Rodoviário",
  agricola: "Bloco C — Agrícola",
};

const MODULE_ITEM_LABELS: Record<string, string> = {
  hidraulico: "Sistema hidráulico (mangueiras/cilindros)",
  laminaConcha: "Lâmina / concha / caçamba",
  esteiras: "Esteiras / material rodante",
  bracoLanca: "Braço / lança e articulações",
  pinosBuchas: "Pinos, buchas e graxa",
  motorFluidos: "Motor e nível de fluidos",
  ropsFops: "Estrutura ROPS/FOPS (proteção)",
  tacografo: "Tacógrafo",
  freiosAr: "Freios e sistema de ar",
  suspensao: "Suspensão e feixe de molas",
  quintaRoda: "Quinta roda / engate",
  cardan: "Cardan e diferencial",
  escapamentoArla: "Escapamento e ARLA",
  iluminacaoCarreta: "Iluminação de carreta/baú",
  tdp: "Tomada de potência (TDP)",
  hidraulicoEngate: "Hidráulico e engate de 3 pontos",
  pneusLastro: "Pneus agrícolas / lastro",
  tracao4x4: "Tração 4x4 / bloqueio diferencial",
  acoplamento: "Acoplamento de implemento",
  filtroAr: "Filtro de ar e arrefecimento",
};

const FUEL_LABELS: Record<string, string> = {
  vazio: "Vazio",
  um_quarto: "1/4",
  meio: "1/2",
  tres_quartos: "3/4",
  cheio: "Cheio",
};

export function labelItemChd(itemId: string): string {
  return (
    GENERAL_STATE_LABELS[itemId] ??
    MODULE_ITEM_LABELS[itemId] ??
    itemId.replace(/([A-Z])/g, " $1").replace(/_/g, " ")
  );
}

export function labelModuloSecao(sectionId: string): string {
  return MODULE_SECTION_TITLES[sectionId] ?? sectionId;
}

export function labelCombustivelChd(value?: string): string {
  if (!value?.trim()) return "—";
  return FUEL_LABELS[value] ?? value;
}

const MODULE_ITEM_SECTION: Record<string, string> = {
  hidraulico: "linha-amarela",
  laminaConcha: "linha-amarela",
  esteiras: "linha-amarela",
  bracoLanca: "linha-amarela",
  pinosBuchas: "linha-amarela",
  motorFluidos: "linha-amarela",
  ropsFops: "linha-amarela",
  tacografo: "rodoviario",
  freiosAr: "rodoviario",
  suspensao: "rodoviario",
  quintaRoda: "rodoviario",
  cardan: "rodoviario",
  escapamentoArla: "rodoviario",
  iluminacaoCarreta: "rodoviario",
  tdp: "agricola",
  hidraulicoEngate: "agricola",
  pneusLastro: "agricola",
  tracao4x4: "agricola",
  acoplamento: "agricola",
  filtroAr: "agricola",
};

export function secaoModuloChd(itemId: string): string {
  return MODULE_ITEM_SECTION[itemId] ?? "modulos";
}

export function labelStatusItemChd(status?: string): string {
  switch (status) {
    case "ok":
      return "OK";
    case "anomaly":
      return "Anomalia";
    case "na":
      return "N/A";
    default:
      return status?.trim() ? status : "—";
  }
}

export function labelStatusChdExport(status: string): string {
  const map: Record<string, string> = {
    enviado: "Enviado",
    em_conferencia: "Em conferência",
    aceito: "Aceito",
    contestado: "Contestado",
  };
  return map[status] ?? status.replace(/_/g, " ");
}
