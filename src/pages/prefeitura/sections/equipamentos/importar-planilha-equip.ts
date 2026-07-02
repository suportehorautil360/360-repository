import {
  inferLinhaFromTipo,
  LINHA_OPTIONS,
  type LinhaEquipamento,
  type NovoEquip,
  type StatusEquipamento,
} from "./equipamentos-api";

export interface EquipParsado {
  input: NovoEquip;
  problema: string | null;
}

type Campo = keyof NovoEquip;

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalizaCabecalho(h: string): string {
  return semAcento(String(h)).toLowerCase().trim().replace(/\s+/g, " ");
}

const ALIASES: Record<string, Campo> = {
  placa: "placa",
  "numero placa": "placa",
  chassis: "chassis",
  chassi: "chassis",
  vin: "chassis",
  marca: "marca",
  fabricante: "marca",
  modelo: "modelo",
  tipo: "tipo",
  categoria: "tipo",
  "tipo veiculo": "tipo",
  "ano fabricacao": "anoFabricacao",
  "ano fab": "anoFabricacao",
  ano: "anoFabricacao",
  "ano modelo": "anoModelo",
  combustivel: "combustivel",
  "tipo combustivel": "combustivel",
  linha: "linha",
  "linha equipamento": "linha",
  "linha operacional": "linha",
  "centro custo": "centroCusto",
  obra: "centroCusto",
  "medicao atual": "medicaoAtual",
  "km atual": "medicaoAtual",
  horimetro: "medicaoAtual",
  hodometro: "medicaoAtual",
  "intervalo revisao": "intervaloRevisao",
  "intervalo km": "intervaloRevisao",
  "intervalo h": "intervaloRevisao",
  intervalo: "intervaloRevisao",
  status: "status",
};

function normalizaStatus(v: string): StatusEquipamento {
  const s = semAcento(v).toLowerCase().trim();
  if (s.startsWith("inat")) return "inativo";
  if (s.startsWith("bloq")) return "bloqueado";
  return "ativo";
}

function linhaPlanilhaValida(valor: string): valor is LinhaEquipamento {
  return LINHA_OPTIONS.includes(valor as LinhaEquipamento);
}

function emptyNovoEquip(): NovoEquip {
  return {
    placa: "",
    chassis: "",
    renavam: "",
    numeroSerie: "",
    patrimonioBase: "",
    marca: "",
    modelo: "",
    cor: "",
    linha: "",
    combustivel: "",
    tipo: "",
    tipoFrota: "",
    motorizacao: "",
    anoFabricacao: "",
    anoModelo: "",
    capacidadeTanque: 0,
    capacidadeTanqueCaminhao: 0,
    valorVeiculo: 0,
    status: "ativo",
    medicaoAtual: 0,
    intervaloRevisao: 0,
    condutorResponsavel: "",
    condutoresResponsaveis: [],
    gestorResponsavel: "",
    centroCusto: "",
    cidade: "",
    estado: "",
    regiao: "",
    ipva: "",
    seguro: "",
    licenciamento: "",
    vigenciaInicio: "",
    vigenciaFim: "",
    inativarAposVigencia: false,
  };
}

export async function parsePlanilhaEquip(file: File): Promise<EquipParsado[]> {
  const XLSX = await import("xlsx");
  const ehCsv = file.name.toLowerCase().endsWith(".csv");
  const wb = ehCsv
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });

  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const matriz: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  if (matriz.length < 2) return [];

  const cabecalhos = (matriz[0] as unknown[]).map((c) =>
    normalizaCabecalho(String(c)),
  );
  const idx: Partial<Record<Campo, number>> = {};
  cabecalhos.forEach((h, i) => {
    const campo = ALIASES[h];
    if (campo && idx[campo] === undefined) idx[campo] = i;
  });

  const getString = (linha: unknown[], campo: Campo): string => {
    const i = idx[campo];
    return i === undefined ? "" : String(linha[i] ?? "").trim();
  };

  const getNum = (linha: unknown[], campo: Campo): number => {
    const raw = getString(linha, campo).replace(/\./g, "").replace(",", ".");
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };

  const out: EquipParsado[] = [];
  for (let i = 1; i < matriz.length; i++) {
    const linha = matriz[i] as unknown[];
    if (!linha || linha.every((c) => !String(c ?? "").trim())) continue;

    const tipo = getString(linha, "tipo");
    const linhaRaw = getString(linha, "linha");
    const centroCustoRaw = getString(linha, "centroCusto");

    // Planilhas antigas usavam a coluna "Linha" para centro de custo (ex.: "Obras").
    let linhaEquip = linhaRaw;
    let centroCusto = centroCustoRaw;
    if (linhaRaw && !linhaPlanilhaValida(linhaRaw) && !centroCustoRaw) {
      centroCusto = linhaRaw;
      linhaEquip = "";
    }
    if (!linhaEquip) {
      linhaEquip = inferLinhaFromTipo(tipo) || "";
    }

    const input: NovoEquip = {
      ...emptyNovoEquip(),
      placa: getString(linha, "placa"),
      chassis: getString(linha, "chassis"),
      marca: getString(linha, "marca"),
      modelo: getString(linha, "modelo"),
      tipo,
      linha: linhaEquip,
      anoFabricacao: getString(linha, "anoFabricacao"),
      anoModelo: getString(linha, "anoModelo"),
      combustivel: getString(linha, "combustivel"),
      centroCusto,
      medicaoAtual: getNum(linha, "medicaoAtual"),
      intervaloRevisao: getNum(linha, "intervaloRevisao"),
      status: normalizaStatus(getString(linha, "status") || "ativo"),
    };

    let problema: string | null = null;
    if (!input.placa && !input.chassis) {
      problema = "Placa ou chassi obrigatório";
    } else if (!input.marca) {
      problema = "Marca obrigatória";
    } else if (!input.modelo) {
      problema = "Modelo obrigatório";
    }

    out.push({ input, problema });
  }
  return out;
}

export const TEMPLATE_COLUNAS_EQUIP = [
  "Placa",
  "Chassis",
  "Marca",
  "Modelo",
  "Tipo",
  "Ano Fabricação",
  "Ano Modelo",
  "Combustível",
  "Linha Equipamento",
  "Centro Custo",
  "Medição Atual",
  "Intervalo Revisão",
  "Status",
];

export function baixarModeloCsvEquip(): void {
  const exemplo = [
    "ABC-1234",
    "9BWZZZ377VT004251",
    "Volkswagen",
    "Delivery",
    "Caminhões",
    "2020",
    "2021",
    "Diesel",
    "Linha Branca",
    "Obras",
    "50000",
    "15000",
    "ativo",
  ];
  const linhas = [TEMPLATE_COLUNAS_EQUIP.join(","), exemplo.join(",")];
  const blob = new Blob(["﻿" + linhas.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-equipamentos.csv";
  a.click();
  URL.revokeObjectURL(url);
}
