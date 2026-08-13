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
  item: string;
  especificacao: string;
  acoes: Record<string, AcaoMatriz>;
}

/** Categoria do plano = dona de uma matriz (ciclos × linhas). */
export interface CategoriaPlano {
  id: string;
  nome: string;
  ciclos: CicloMatriz[];
  linhas: LinhaMatriz[];
}

export interface PlanoPreventivo {
  categorias: CategoriaPlano[];
}

/** @deprecated Alias — preferir PlanoPreventivo */
export type MatrizPreventiva = PlanoPreventivo;

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

function ciclosPadrao(): CicloMatriz[] {
  return [
    ciclo("c1", 250, 10_000, 0),
    ciclo("c2", 500, 20_000, 1),
    ciclo("c3", 1_000, 40_000, 2),
    ciclo("c4", 2_000, 80_000, 3),
  ];
}

function linha(
  id: string,
  item: string,
  especificacao: string,
  acoes: AcaoMatriz[],
): LinhaMatriz {
  const ciclosIds = ["c1", "c2", "c3", "c4"];
  const map: Record<string, AcaoMatriz> = {};
  ciclosIds.forEach((cid, i) => {
    map[cid] = acoes[i] ?? "na";
  });
  return { id, item, especificacao, acoes: map };
}

function categoriaComMatriz(
  id: string,
  nome: string,
  linhas: LinhaMatriz[],
): CategoriaPlano {
  return {
    id,
    nome,
    ciclos: ciclosPadrao(),
    linhas,
  };
}

export const PLANO_PADRAO: PlanoPreventivo = {
  categorias: [
    categoriaComMatriz("cat-fluidos", "Fluidos", [
      linha("l1", "Óleo do Motor", "SAE 15W-40 CI-4", [
        "inspecionar",
        "inspecionar",
        "trocar",
        "trocar",
      ]),
      linha("l2", "Óleo da Transmissão", "Conforme fabricante", [
        "na",
        "inspecionar",
        "trocar",
        "trocar",
      ]),
      linha("l3", "Óleo do Sistema Hidráulico", "ISO VG 46", [
        "inspecionar",
        "inspecionar",
        "trocar",
        "trocar",
      ]),
      linha("l4", "Óleo dos Eixos / Diferencial", "80W-90 GL-5", [
        "na",
        "inspecionar",
        "trocar",
        "trocar",
      ]),
      linha("l5", "Líquido de Arrefecimento", "Orgânico / Etileno", [
        "inspecionar",
        "inspecionar",
        "trocar",
        "trocar",
      ]),
      linha("l6", "Fluido de Freio / Embreagem", "DOT 4", [
        "inspecionar",
        "inspecionar",
        "trocar",
        "trocar",
      ]),
    ]),
    categoriaComMatriz("cat-filtros", "Filtros", [
      linha("l7", "Filtro de Óleo do Motor", "Cartucho / spin-on", [
        "trocar",
        "trocar",
        "trocar",
        "trocar",
      ]),
      linha("l8", "Filtro de Combustível (Principal)", "Elemento principal", [
        "inspecionar",
        "trocar",
        "trocar",
        "trocar",
      ]),
      linha("l9", "Filtro de Combustível (Separador/Racor)", "Separador d'água", [
        "inspecionar",
        "trocar",
        "trocar",
        "trocar",
      ]),
      linha("l10", "Filtro de Ar do Motor (Primário)", "Elemento externo", [
        "inspecionar",
        "trocar",
        "trocar",
        "trocar",
      ]),
      linha("l11", "Filtro de Ar do Motor (Secundário)", "Elemento interno", [
        "na",
        "inspecionar",
        "trocar",
        "trocar",
      ]),
      linha("l12", "Filtro do Hidráulico (Sucção/Retorno)", "Duplo elemento", [
        "inspecionar",
        "trocar",
        "trocar",
        "trocar",
      ]),
      linha("l13", "Filtro da Transmissão", "Conforme fabricante", [
        "na",
        "na",
        "trocar",
        "trocar",
      ]),
      linha("l14", "Filtro de Cabine (Ar Condicionado)", "Cabine / HVAC", [
        "na",
        "inspecionar",
        "trocar",
        "trocar",
      ]),
    ]),
    categoriaComMatriz("cat-consumo", "Consumo", [
      linha("l15", "Correia de Acessórios (Alternador/Ar)", "Perfil V / Poly-V", [
        "inspecionar",
        "inspecionar",
        "trocar",
        "trocar",
      ]),
      linha("l16", "Correia Dentada (se houver)", "Conforme motor", [
        "inspecionar",
        "inspecionar",
        "se_necessario",
        "trocar",
      ]),
      linha("l17", "Pastilhas / Lonas de Freio", "Conjunto eixo", [
        "inspecionar",
        "inspecionar",
        "medir_trocar",
        "medir_trocar",
      ]),
      linha("l18", "Discos / Tambores de Freio", "Conforme desgaste", [
        "inspecionar",
        "inspecionar",
        "medir_trocar",
        "medir_trocar",
      ]),
      linha("l19", "Palhetas do Limpador", "Par dianteiro", [
        "inspecionar",
        "se_necessario",
        "trocar",
        "trocar",
      ]),
      linha("l20", "Elementos de Desgaste (Dentes/Chapas)", "Caçamba / implemento", [
        "inspecionar",
        "inspecionar",
        "trocar",
        "trocar",
      ]),
    ]),
    categoriaComMatriz("cat-servico", "Serviço", [
      linha("l21", "Lubrificação Geral (Graxeiras)", "Pontos de graxa", [
        "lubrificar",
        "lubrificar",
        "lubrificar",
        "lubrificar",
      ]),
      linha("l22", "Análise de Óleo (Preditiva)", "Laboratório credenciado", [
        "na",
        "coletar",
        "coletar",
        "coletar",
      ]),
    ]),
  ],
};

/** @deprecated Use PLANO_PADRAO */
export const MATRIZ_PADRAO = PLANO_PADRAO;

export function clonarPlanoPadrao(): PlanoPreventivo {
  return JSON.parse(JSON.stringify(PLANO_PADRAO)) as PlanoPreventivo;
}

/** @deprecated Use clonarPlanoPadrao */
export function clonarMatrizPadrao(): PlanoPreventivo {
  return clonarPlanoPadrao();
}

function clonarCiclosPadrao(): CicloMatriz[] {
  return JSON.parse(JSON.stringify(ciclosPadrao())) as CicloMatriz[];
}

function temMatrizPropria(c: unknown): c is CategoriaPlano {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  return Array.isArray(o.ciclos) && Array.isArray(o.linhas);
}

/**
 * Normaliza qualquer formato legado para PlanoPreventivo
 * (categoria → matriz própria).
 */
export function normalizarPlano(raw: unknown): PlanoPreventivo {
  if (!raw || typeof raw !== "object") return clonarPlanoPadrao();
  const doc = raw as Record<string, unknown>;

  if (Array.isArray(doc.categorias) && doc.categorias.length > 0) {
    const primeira = doc.categorias[0];
    if (temMatrizPropria(primeira)) {
      const cats: CategoriaPlano[] = [];
      for (const item of doc.categorias) {
        if (!temMatrizPropria(item)) continue;
        const id = typeof item.id === "string" ? item.id.trim() : "";
        const nome = typeof item.nome === "string" ? item.nome.trim() : "";
        if (!id || !nome) continue;
        cats.push({
          id,
          nome,
          ciclos: item.ciclos.length > 0 ? item.ciclos : clonarCiclosPadrao(),
          linhas: (item.linhas as LinhaMatriz[]).map((l) => ({
            id: l.id,
            item: l.item ?? "",
            especificacao: l.especificacao ?? "",
            acoes: l.acoes ?? {},
          })),
        });
      }
      if (cats.length > 0) return { categorias: cats };
    }

    // Legado: categorias só {id,nome} + ciclos/linhas no root
    const ciclosRoot = Array.isArray(doc.ciclos)
      ? (doc.ciclos as CicloMatriz[])
      : clonarCiclosPadrao();
    const linhasRoot = Array.isArray(doc.linhas)
      ? (doc.linhas as Array<LinhaMatriz & { categoria?: string }>)
      : [];

    const meta = (doc.categorias as Array<{ id?: string; nome?: string }>)
      .map((c) => ({
        id: typeof c.id === "string" ? c.id.trim() : "",
        nome: typeof c.nome === "string" ? c.nome.trim() : "",
      }))
      .filter((c) => c.id && c.nome);

    if (meta.length > 0) {
      return {
        categorias: meta.map((m) => {
          const key = m.nome.toLocaleLowerCase("pt-BR");
          const linhas = linhasRoot
            .filter(
              (l) =>
                (l.categoria ?? "").trim().toLocaleLowerCase("pt-BR") === key,
            )
            .map((l) => ({
              id: l.id,
              item: l.item ?? "",
              especificacao: l.especificacao ?? "",
              acoes: l.acoes ?? {},
            }));
          return {
            id: m.id,
            nome: m.nome,
            ciclos: JSON.parse(JSON.stringify(ciclosRoot)) as CicloMatriz[],
            linhas,
          };
        }),
      };
    }
  }

  // Legado puro: só ciclos + linhas com campo categoria
  if (Array.isArray(doc.linhas) && doc.linhas.length > 0) {
    const ciclosRoot = Array.isArray(doc.ciclos)
      ? (doc.ciclos as CicloMatriz[])
      : clonarCiclosPadrao();
    const linhasRoot = doc.linhas as Array<
      LinhaMatriz & { categoria?: string }
    >;
    const ordem: string[] = [];
    const grupos = new Map<string, typeof linhasRoot>();
    for (const l of linhasRoot) {
      const nome = (l.categoria ?? "Geral").trim() || "Geral";
      const key = nome.toLocaleLowerCase("pt-BR");
      if (!grupos.has(key)) {
        grupos.set(key, []);
        ordem.push(nome);
      }
      grupos.get(key)!.push(l);
    }
    return {
      categorias: ordem.map((nome, i) => {
        const key = nome.toLocaleLowerCase("pt-BR");
        const linhas = (grupos.get(key) ?? []).map((l) => ({
          id: l.id,
          item: l.item ?? "",
          especificacao: l.especificacao ?? "",
          acoes: l.acoes ?? {},
        }));
        return {
          id: `cat-${key.replace(/\s+/g, "-").slice(0, 40)}-${i + 1}`,
          nome,
          ciclos: JSON.parse(JSON.stringify(ciclosRoot)) as CicloMatriz[],
          linhas,
        };
      }),
    };
  }

  return clonarPlanoPadrao();
}

export function matrizVaziaCategoria(): Pick<
  CategoriaPlano,
  "ciclos" | "linhas"
> {
  return { ciclos: clonarCiclosPadrao(), linhas: [] };
}

export function adicionarCategoria(
  plano: PlanoPreventivo,
  nome: string,
): PlanoPreventivo | null {
  const n = nome.trim();
  if (!n) return null;
  const key = n.toLocaleLowerCase("pt-BR");
  if (plano.categorias.some((c) => c.nome.toLocaleLowerCase("pt-BR") === key)) {
    return null;
  }
  const vazia = matrizVaziaCategoria();
  return {
    categorias: [
      ...plano.categorias,
      {
        id: `cat-${Date.now()}`,
        nome: n,
        ciclos: vazia.ciclos,
        linhas: vazia.linhas,
      },
    ],
  };
}

export function renomearCategoria(
  plano: PlanoPreventivo,
  categoriaId: string,
  novoNome: string,
): PlanoPreventivo {
  const nome = novoNome.trim();
  if (!nome) return plano;
  const nomeKey = nome.toLocaleLowerCase("pt-BR");
  if (
    plano.categorias.some(
      (c) =>
        c.id !== categoriaId &&
        c.nome.toLocaleLowerCase("pt-BR") === nomeKey,
    )
  ) {
    return plano;
  }
  return {
    categorias: plano.categorias.map((c) =>
      c.id === categoriaId ? { ...c, nome } : c,
    ),
  };
}

/** Exclusão remove a categoria e a matriz dela. Exige ao menos 1 restante. */
export function removerCategoria(
  plano: PlanoPreventivo,
  categoriaId: string,
): PlanoPreventivo | null {
  if (plano.categorias.length <= 1) return null;
  if (!plano.categorias.some((c) => c.id === categoriaId)) return null;
  return {
    categorias: plano.categorias.filter((c) => c.id !== categoriaId),
  };
}

export function atualizarCategoriaMatriz(
  plano: PlanoPreventivo,
  categoriaId: string,
  patch: Partial<Pick<CategoriaPlano, "ciclos" | "linhas">>,
): PlanoPreventivo {
  return {
    categorias: plano.categorias.map((c) =>
      c.id === categoriaId ? { ...c, ...patch } : c,
    ),
  };
}

export function novaLinhaVazia(ciclos: CicloMatriz[]): LinhaMatriz {
  const acoes: Record<string, AcaoMatriz> = {};
  for (const c of ciclos) acoes[c.id] = "na";
  return {
    id: `l${Date.now()}`,
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

export function matrizParaCsv(categoria: CategoriaPlano): {
  colunas: string[];
  linhas: (string | number)[][];
} {
  const colunas = [
    "Categoria",
    "Item / componente",
    "Especificação / tipo",
    ...categoria.ciclos.map((c) => c.titulo.trim() || labelCiclo(c)),
  ];
  const linhas = categoria.linhas.map((r) => [
    categoria.nome,
    r.item,
    r.especificacao,
    ...categoria.ciclos.map((c) => labelAcao(r.acoes[c.id] ?? "na")),
  ]);
  return { colunas, linhas };
}

export function planoParaCsv(plano: PlanoPreventivo): {
  colunas: string[];
  linhas: (string | number)[][];
} {
  const colunas = [
    "Categoria",
    "Item / componente",
    "Especificação / tipo",
    "Ciclo",
    "Ação",
  ];
  const linhas: (string | number)[][] = [];
  for (const cat of plano.categorias) {
    for (const r of cat.linhas) {
      for (const c of cat.ciclos) {
        linhas.push([
          cat.nome,
          r.item,
          r.especificacao,
          c.titulo.trim() || labelCiclo(c),
          labelAcao(r.acoes[c.id] ?? "na"),
        ]);
      }
    }
  }
  return { colunas, linhas };
}

/** Monta o relato da O.S. preventiva a partir da matriz da categoria. */
export function montarRelatoPreventivo(
  categoria: CategoriaPlano,
  cicloId: string,
): string {
  const idx = categoria.ciclos.findIndex((c) => c.id === cicloId);
  const ciclo = idx >= 0 ? categoria.ciclos[idx] : undefined;
  if (!ciclo) return "";

  const titulo = labelCiclo(ciclo, idx);
  const itens: string[] = [];

  for (const linha of categoria.linhas) {
    const acao = linha.acoes[cicloId] ?? "na";
    if (acao === "na") continue;

    const item = linha.item.trim();
    const detalhe = linha.especificacao.trim();
    let texto = `• ${item}: ${labelAcao(acao)}`;
    if (detalhe) texto += ` (${detalhe})`;
    itens.push(texto);
  }

  const cabecalho = `Manutenção preventiva — ${categoria.nome} — ${titulo}`;
  if (itens.length === 0) {
    return `${cabecalho}\n\n(Nenhum item configurado para este ciclo.)`;
  }

  return `${cabecalho}\n\n${itens.join("\n")}`;
}
