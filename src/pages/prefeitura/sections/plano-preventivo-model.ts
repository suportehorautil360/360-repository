export type AcaoMatriz =
  | "trocar"
  | "inspecionar"
  | "limpar"
  | "lubrificar"
  | "coletar"
  | "medir_trocar"
  | "se_necessario"
  | "opcional"
  | "na";

export interface CicloMatriz {
  id: string;
  horas: number;
  km: number;
  titulo: string;
}

export interface LinhaMatriz {
  id: string;
  categoria: string;
  item: string;
  especificacao: string;
  acoes: Record<string, AcaoMatriz>;
}

export interface MatrizPreventiva {
  ciclos: CicloMatriz[];
  linhas: LinhaMatriz[];
}

export const ACOES_OPCOES: {
  value: AcaoMatriz;
  label: string;
  cls: string;
}[] = [
  { value: "na", label: "—", cls: "pp-acao--na" },
  { value: "inspecionar", label: "Inspecionar", cls: "pp-acao--inspecionar" },
  { value: "trocar", label: "Trocar", cls: "pp-acao--trocar" },
  { value: "limpar", label: "Limpar", cls: "pp-acao--limpar" },
  { value: "lubrificar", label: "Lubrificar", cls: "pp-acao--lubrificar" },
  { value: "coletar", label: "Coletar", cls: "pp-acao--coletar" },
  { value: "opcional", label: "Opcional", cls: "pp-acao--opcional" },
  { value: "medir_trocar", label: "Medir / Trocar", cls: "pp-acao--medir-trocar" },
  { value: "se_necessario", label: "Se necessário", cls: "pp-acao--se-necessario" },
];

export function labelAcao(acao: AcaoMatriz): string {
  return ACOES_OPCOES.find((a) => a.value === acao)?.label ?? "—";
}

export function clsAcao(acao: AcaoMatriz): string {
  return ACOES_OPCOES.find((a) => a.value === acao)?.cls ?? "pp-acao--na";
}

export function tituloCicloPadrao(
  horas: number,
  km: number,
  idx: number,
): string {
  const h = horas.toLocaleString("pt-BR");
  const k = km.toLocaleString("pt-BR");
  return `Ciclo ${idx + 1} (${h}h / ${k}km)`;
}

/** @deprecated Use ciclo.titulo */
export function labelCiclo(c: CicloMatriz, _idx?: number): string {
  return c.titulo.trim() || tituloCicloPadrao(c.horas, c.km, 0);
}

function ciclo(
  id: string,
  horas: number,
  km: number,
  idx: number,
): CicloMatriz {
  return { id, horas, km, titulo: tituloCicloPadrao(horas, km, idx) };
}

function linha(
  id: string,
  categoria: string,
  item: string,
  especificacao: string,
  acoes: AcaoMatriz[],
): LinhaMatriz {
  const ciclosIds = ["c1", "c2", "c3", "c4"];
  const map: Record<string, AcaoMatriz> = {};
  ciclosIds.forEach((cid, i) => {
    map[cid] = acoes[i] ?? "na";
  });
  return { id, categoria, item, especificacao, acoes: map };
}

export const MATRIZ_PADRAO: MatrizPreventiva = {
  ciclos: [
    ciclo("c1", 250, 10_000, 0),
    ciclo("c2", 500, 20_000, 1),
    ciclo("c3", 1_000, 40_000, 2),
    ciclo("c4", 2_000, 80_000, 3),
  ],
  linhas: [
    linha("l1", "Fluidos", "Óleo do Motor", "SAE 15W-40 CI-4", [
      "inspecionar",
      "inspecionar",
      "trocar",
      "trocar",
    ]),
    linha("l2", "Fluidos", "Óleo da Transmissão", "Conforme fabricante", [
      "na",
      "inspecionar",
      "trocar",
      "trocar",
    ]),
    linha("l3", "Fluidos", "Óleo do Sistema Hidráulico", "ISO VG 46", [
      "inspecionar",
      "inspecionar",
      "trocar",
      "trocar",
    ]),
    linha("l4", "Fluidos", "Óleo dos Eixos / Diferencial", "80W-90 GL-5", [
      "na",
      "inspecionar",
      "trocar",
      "trocar",
    ]),
    linha("l5", "Fluidos", "Líquido de Arrefecimento", "Orgânico / Etileno", [
      "inspecionar",
      "inspecionar",
      "trocar",
      "trocar",
    ]),
    linha("l6", "Fluidos", "Fluido de Freio / Embreagem", "DOT 4", [
      "inspecionar",
      "inspecionar",
      "trocar",
      "trocar",
    ]),
    linha("l7", "Filtros", "Filtro de Óleo do Motor", "Cartucho / spin-on", [
      "trocar",
      "trocar",
      "trocar",
      "trocar",
    ]),
    linha("l8", "Filtros", "Filtro de Combustível (Principal)", "Elemento principal", [
      "inspecionar",
      "trocar",
      "trocar",
      "trocar",
    ]),
    linha("l9", "Filtros", "Filtro de Combustível (Separador/Racor)", "Separador d'água", [
      "inspecionar",
      "trocar",
      "trocar",
      "trocar",
    ]),
    linha(
      "l10",
      "Filtros",
      "Filtro de Ar do Motor (Primário)",
      "Elemento externo",
      ["inspecionar", "trocar", "trocar", "trocar"],
    ),
    linha(
      "l11",
      "Filtros",
      "Filtro de Ar do Motor (Secundário)",
      "Elemento interno",
      ["na", "inspecionar", "trocar", "trocar"],
    ),
    linha("l12", "Filtros", "Filtro do Hidráulico (Sucção/Retorno)", "Duplo elemento", [
      "inspecionar",
      "trocar",
      "trocar",
      "trocar",
    ]),
    linha("l13", "Filtros", "Filtro da Transmissão", "Conforme fabricante", [
      "na",
      "na",
      "trocar",
      "trocar",
    ]),
    linha("l14", "Filtros", "Filtro de Cabine (Ar Condicionado)", "Cabine / HVAC", [
      "na",
      "inspecionar",
      "trocar",
      "trocar",
    ]),
    linha("l15", "Consumo", "Correia de Acessórios (Alternador/Ar)", "Perfil V / Poly-V", [
      "inspecionar",
      "inspecionar",
      "trocar",
      "trocar",
    ]),
    linha("l16", "Consumo", "Correia Dentada (se houver)", "Conforme motor", [
      "inspecionar",
      "inspecionar",
      "se_necessario",
      "trocar",
    ]),
    linha("l17", "Consumo", "Pastilhas / Lonas de Freio", "Conjunto eixo", [
      "inspecionar",
      "inspecionar",
      "medir_trocar",
      "medir_trocar",
    ]),
    linha("l18", "Consumo", "Discos / Tambores de Freio", "Conforme desgaste", [
      "inspecionar",
      "inspecionar",
      "medir_trocar",
      "medir_trocar",
    ]),
    linha("l19", "Consumo", "Palhetas do Limpador", "Par dianteiro", [
      "inspecionar",
      "se_necessario",
      "trocar",
      "trocar",
    ]),
    linha(
      "l20",
      "Consumo",
      "Elementos de Desgaste (Dentes/Chapas)",
      "Caçamba / implemento",
      ["inspecionar", "inspecionar", "trocar", "trocar"],
    ),
    linha("l21", "Serviço", "Lubrificação Geral (Graxeiras)", "Pontos de graxa", [
      "lubrificar",
      "lubrificar",
      "lubrificar",
      "lubrificar",
    ]),
    linha("l22", "Serviço", "Análise de Óleo (Preditiva)", "Laboratório credenciado", [
      "na",
      "coletar",
      "coletar",
      "coletar",
    ]),
  ],
};

export function clonarMatrizPadrao(): MatrizPreventiva {
  return JSON.parse(JSON.stringify(MATRIZ_PADRAO)) as MatrizPreventiva;
}

export function novaLinhaVazia(ciclos: CicloMatriz[]): LinhaMatriz {
  const acoes: Record<string, AcaoMatriz> = {};
  for (const c of ciclos) acoes[c.id] = "na";
  return {
    id: `l${Date.now()}`,
    categoria: "Nova categoria",
    item: "Novo item",
    especificacao: "",
    acoes,
  };
}

export function novoCiclo(ordem: number, anterior?: CicloMatriz): CicloMatriz {
  const horas = anterior ? anterior.horas * 2 : 250 * ordem;
  const km = anterior ? anterior.km * 2 : 10_000 * ordem;
  return {
    id: `c${Date.now()}`,
    horas,
    km,
    titulo: tituloCicloPadrao(horas, km, ordem - 1),
  };
}

export function sincronizarAcoesLinha(
  linhaAtual: LinhaMatriz,
  ciclos: CicloMatriz[],
): LinhaMatriz {
  const acoes = { ...linhaAtual.acoes };
  for (const c of ciclos) {
    if (!acoes[c.id]) acoes[c.id] = "na";
  }
  for (const id of Object.keys(acoes)) {
    if (!ciclos.some((c) => c.id === id)) delete acoes[id];
  }
  return { ...linhaAtual, acoes };
}

export function matrizParaCsv(matriz: MatrizPreventiva): {
  colunas: string[];
  linhas: (string | number)[][];
} {
  const colunas = [
    "Categoria",
    "Item / componente",
    "Especificação / tipo",
    ...matriz.ciclos.map((c) => c.titulo.trim() || labelCiclo(c)),
  ];
  const linhas = matriz.linhas.map((r) => [
    r.categoria,
    r.item,
    r.especificacao,
    ...matriz.ciclos.map((c) => labelAcao(r.acoes[c.id] ?? "na")),
  ]);
  return { colunas, linhas };
}
