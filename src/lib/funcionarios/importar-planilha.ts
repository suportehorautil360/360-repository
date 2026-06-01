/**
 * Parser de planilha (.xlsx/.csv) para importação de funcionários.
 * O SheetJS é carregado sob demanda (lazy) — só pesa o bundle na importação.
 */
import type {
  FuncionarioInput,
  FuncionarioStatus,
  FuncionarioTipo,
} from "./funcionarios";

type Campo = keyof FuncionarioInput;

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizaCabecalho(h: string): string {
  return semAcento(String(h)).toLowerCase().trim().replace(/\s+/g, " ");
}

/** Cabeçalho normalizado → campo do funcionário. */
const ALIASES: Record<string, Campo> = {
  nome: "nome",
  "nome completo": "nome",
  cpf: "cpf",
  cargo: "cargo",
  funcao: "cargo",
  perfil: "tipo",
  tipo: "tipo",
  "perfil de acesso": "tipo",
  "perfil acesso": "tipo",
  status: "status",
  situacao: "status",
  matricula: "matricula",
  "data nascimento": "dataNascimento",
  "data de nascimento": "dataNascimento",
  nascimento: "dataNascimento",
  rg: "rg",
  telefone: "telefone",
  celular: "telefone",
  fone: "telefone",
  cnh: "cnh",
  "categoria cnh": "cnhCategoria",
  "cat cnh": "cnhCategoria",
  "categoria da cnh": "cnhCategoria",
  categoria: "cnhCategoria",
  "validade cnh": "cnhValidade",
  "validade da cnh": "cnhValidade",
  validade: "cnhValidade",
  observacoes: "observacoes",
  observacao: "observacoes",
  obs: "observacoes",
};

function normalizaTipo(v: string): FuncionarioTipo {
  const s = semAcento(v).toLowerCase().trim();
  if (s.startsWith("super")) return "supervisor";
  if (s.startsWith("admin")) return "admin";
  return "operador";
}

function normalizaStatus(v: string): FuncionarioStatus {
  return semAcento(v).toLowerCase().trim().startsWith("inat")
    ? "inativo"
    : "ativo";
}

/** Aceita DD/MM/AAAA ou AAAA-MM-DD; devolve AAAA-MM-DD (ou o original). */
function normalizaData(v: string): string {
  const s = String(v).trim();
  if (!s) return "";
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}

/** Lê o arquivo e mapeia cada linha para FuncionarioInput. */
export async function parsePlanilha(file: File): Promise<FuncionarioInput[]> {
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

  const get = (linha: unknown[], campo: Campo): string => {
    const i = idx[campo];
    return i === undefined ? "" : String(linha[i] ?? "").trim();
  };

  const out: FuncionarioInput[] = [];
  for (let i = 1; i < matriz.length; i++) {
    const linha = matriz[i] as unknown[];
    if (!linha || linha.every((c) => !String(c ?? "").trim())) continue;
    out.push({
      nome: get(linha, "nome"),
      cpf: get(linha, "cpf"),
      cargo: get(linha, "cargo") || "Operador",
      telefone: get(linha, "telefone"),
      tipo: normalizaTipo(get(linha, "tipo")),
      status: normalizaStatus(get(linha, "status") || "ativo"),
      matricula: get(linha, "matricula"),
      dataNascimento: normalizaData(get(linha, "dataNascimento")),
      rg: get(linha, "rg"),
      cnh: get(linha, "cnh"),
      cnhCategoria: get(linha, "cnhCategoria"),
      cnhValidade: normalizaData(get(linha, "cnhValidade")),
      observacoes: get(linha, "observacoes"),
    });
  }
  return out;
}

/** Cabeçalhos do modelo, na ordem. */
export const TEMPLATE_COLUNAS = [
  "Nome",
  "CPF",
  "Cargo",
  "Perfil",
  "Status",
  "Matrícula",
  "Data Nascimento",
  "RG",
  "Telefone",
  "CNH",
  "Categoria CNH",
  "Validade CNH",
  "Observações",
];

/** Gera e baixa um modelo CSV com cabeçalhos + 1 linha de exemplo. */
export function baixarModeloCsv(): void {
  const exemplo = [
    "João da Silva",
    "123.456.789-09",
    "Operador",
    "operador",
    "ativo",
    "0001",
    "20/05/1990",
    "12.345.678-9",
    "(67) 99999-0000",
    "12345678900",
    "AB",
    "01/01/2030",
    "",
  ];
  const linhas = [TEMPLATE_COLUNAS.join(","), exemplo.join(",")];
  const blob = new Blob(["﻿" + linhas.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-funcionarios.csv";
  a.click();
  URL.revokeObjectURL(url);
}
