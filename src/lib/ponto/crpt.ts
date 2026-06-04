/**
 * CRPT — Comprovante de Registro de Ponto do Trabalhador (Portaria MTE 671/2021,
 * §3.2). A cada marcação com sucesso o trabalhador deve receber um comprovante
 * com: dados do empregador, do trabalhador, data, horário e o **hash** de
 * segurança. O NSR (Número Sequencial de Registro) também é incluído.
 *
 * O comprovante é montado a partir da batida já **selada pelo servidor** (com
 * `nsr`/`hash`) + os dados da empresa (`configuracoes/{prefeituraId}`).
 */
import { TIPOS_PONTO, type PontoRegistro } from "../api/pontos";
import type { Configuracao } from "../api/configuracoes";
import { formatarCpf, limparCpf } from "../funcionarios/cpf";
import { baixarPDFRecibo } from "../export/pdf-tabela";

/** Identificação do programa registrador (REP-P). */
export const REP_P = { nome: "Hora Útil 360", modelo: "REP-P", versao: "1.0" };

const NAO_INFORMADO = "Não informado";

const TIPO_LABEL: Record<string, string> = Object.fromEntries(
  TIPOS_PONTO.map((t) => [t.tipo, t.label]),
);

export interface CRPT {
  empregador: { razaoSocial: string; cnpj: string; municipio: string };
  trabalhador: { nome: string; cpf: string };
  marcacao: { tipo: string; data: string; hora: string };
  nsr: string;
  hash: string;
  repP: string;
}

function dataLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** A batida pode emitir CRPT? (precisa estar selada: ter NSR e hash). */
export function podeEmitirCRPT(registro: Pick<PontoRegistro, "nsr" | "hash">): boolean {
  return registro.nsr != null && !!registro.hash;
}

/** Monta o modelo do comprovante a partir da batida + dados da empresa. */
export function montarCRPT(
  registro: PontoRegistro,
  empresa?: Configuracao["empresa"] | null,
): CRPT {
  const municipio = [empresa?.cidade, empresa?.estado]
    .filter(Boolean)
    .join(" / ");
  const cpf = limparCpf(registro.cpf ?? "");
  return {
    empregador: {
      razaoSocial: empresa?.razaoSocial?.trim() || NAO_INFORMADO,
      cnpj: empresa?.cnpj?.trim() || NAO_INFORMADO,
      municipio: municipio || NAO_INFORMADO,
    },
    trabalhador: {
      nome: registro.name?.trim() || NAO_INFORMADO,
      cpf: cpf ? formatarCpf(cpf) : NAO_INFORMADO,
    },
    marcacao: {
      tipo: TIPO_LABEL[registro.tipo] ?? registro.tipo,
      data: dataLocal(registro.timestampOriginal),
      hora: horaLocal(registro.timestampOriginal),
    },
    nsr: registro.nsr != null ? String(registro.nsr) : "—",
    hash: registro.hash ?? "—",
    repP: `${REP_P.nome} (${REP_P.modelo} v${REP_P.versao})`,
  };
}

/** Nome do arquivo PDF do comprovante. */
export function nomeArquivoCRPT(crpt: CRPT): string {
  const nome = crpt.trabalhador.nome.toLowerCase().replace(/\s+/g, "-");
  return `crpt-${nome}-nsr${crpt.nsr}`;
}

/** Gera e baixa o PDF do CRPT. */
export function baixarCRPT(crpt: CRPT): void {
  baixarPDFRecibo(nomeArquivoCRPT(crpt), {
    titulo: "Comprovante de Registro de Ponto do Trabalhador",
    subtitulo: `NSR ${crpt.nsr} · ${crpt.marcacao.data} ${crpt.marcacao.hora}`,
    secoes: [
      {
        titulo: "Empregador",
        itens: [
          { rotulo: "Razão social", valor: crpt.empregador.razaoSocial },
          { rotulo: "CNPJ", valor: crpt.empregador.cnpj },
          { rotulo: "Município/UF", valor: crpt.empregador.municipio },
        ],
      },
      {
        titulo: "Trabalhador",
        itens: [
          { rotulo: "Nome", valor: crpt.trabalhador.nome },
          { rotulo: "CPF", valor: crpt.trabalhador.cpf },
        ],
      },
      {
        titulo: "Marcação",
        itens: [
          { rotulo: "Tipo", valor: crpt.marcacao.tipo },
          { rotulo: "Data", valor: crpt.marcacao.data },
          { rotulo: "Horário", valor: crpt.marcacao.hora },
          { rotulo: "NSR", valor: crpt.nsr },
        ],
      },
      {
        titulo: "Integridade",
        itens: [
          { rotulo: "Hash (SHA-256)", valor: crpt.hash },
          { rotulo: "Registrador", valor: crpt.repP },
        ],
      },
    ],
    rodape: [
      "Comprovante emitido nos termos da Portaria MTE nº 671/2021 (REP-P).",
      "O hash de segurança garante a integridade e a inalterabilidade do registro.",
    ],
  });
}
