/**
 * Resolve o ledger imutável de ponto (Portaria 671) numa visão "efetiva" para
 * exibição/cálculo, SEM nunca alterar os registros de origem.
 *
 * Regras (decisões de produto):
 * - A marcação `original` é a fonte de verdade e o horário oficial.
 * - Uma correção (`ajuste` com refNsr/refId) só troca o horário oficial DEPOIS
 *   de o RH aprovar (`aplicado === true`). Enquanto pendente, mantém o horário
 *   original e marca `ajustePendente` (o espelho mostra um aviso).
 * - Uma inclusão de batida esquecida é um `ajuste` sem alvo (refNsr/refId nulos),
 *   já aprovado pelo RH; vira uma batida efetiva própria.
 * - Um `cancelamento` aplicado remove a original da visão efetiva.
 * - Compat. legado: registro sem `registro` é tratado como `original`; batida
 *   com `status === 'cancelado'` (modelo antigo) é descartada.
 */
import type { PontoRegistro } from "../api/pontos";

export interface BatidaEfetiva extends PontoRegistro {
  /** Há uma correção ainda não aprovada pelo RH para esta batida. */
  ajustePendente?: boolean;
  /** Id do registro de ajuste pendente (alvo de aprovar/reprovar no RH). */
  ajustePendenteId?: string;
  /** Horário corrigido aguardando aprovação (ISO) — só para exibir o aviso. */
  horarioAjustePendente?: string;
  /** Motivo informado pelo trabalhador na correção pendente. */
  motivoAjustePendente?: string | null;
  /** Quando uma correção aplicada trocou o horário, o horário original (ISO). */
  horarioAnterior?: string;
}

function natureza(r: PontoRegistro): NonNullable<PontoRegistro["registro"]> {
  return r.registro ?? "original";
}

/** Um ajuste/cancelamento mira a original O? (NSR preferido, id como fallback.) */
function mira(ref: PontoRegistro, alvo: PontoRegistro): boolean {
  if (ref.refNsr != null && alvo.nsr != null) return ref.refNsr === alvo.nsr;
  if (ref.refId) return ref.refId === alvo.id;
  return false;
}

/** Inclusão = ajuste sem alvo (não corrige nenhuma original). */
function ehInclusao(r: PontoRegistro): boolean {
  return natureza(r) === "ajuste" && r.refNsr == null && !r.refId;
}

export function resolverLedger(registros: PontoRegistro[]): BatidaEfetiva[] {
  const originais: PontoRegistro[] = [];
  const correcoes: PontoRegistro[] = [];
  const cancelamentos: PontoRegistro[] = [];
  const inclusoes: PontoRegistro[] = [];

  for (const r of registros) {
    const nat = natureza(r);
    if (nat === "cancelamento") cancelamentos.push(r);
    else if (ehInclusao(r)) inclusoes.push(r);
    else if (nat === "ajuste") correcoes.push(r);
    else originais.push(r); // original (ou legado sem `registro`)
  }

  const efetivas: BatidaEfetiva[] = [];

  for (const o of originais) {
    // Legado: batida cancelada no modelo antigo some.
    if (o.status === "cancelado") continue;
    // Cancelamento aplicado some.
    const cancelada = cancelamentos.some(
      (c) => c.aplicado !== false && mira(c, o),
    );
    if (cancelada) continue;

    const meus = correcoes.filter((a) => mira(a, o));
    // Última correção APLICADA (por NSR, senão por createdAt) define o oficial.
    const aplicadas = meus
      .filter((a) => a.aplicado === true)
      .sort(ordenar);
    // Pendente = aguardando o RH. Correção já REPROVADA (tem motivoReprovacao)
    // não conta como pendente — a original simplesmente prevalece.
    const pendentes = meus.filter(
      (a) => a.aplicado !== true && !a.motivoReprovacao,
    );

    if (aplicadas.length) {
      const corr = aplicadas[aplicadas.length - 1];
      efetivas.push({
        ...o,
        timestampOriginal: corr.timestampOriginal,
        horarioAnterior: o.timestampOriginal,
      });
    } else if (pendentes.length) {
      const corr = pendentes.sort(ordenar)[pendentes.length - 1];
      efetivas.push({
        ...o,
        ajustePendente: true,
        ajustePendenteId: corr.id,
        horarioAjustePendente: corr.timestampOriginal,
        motivoAjustePendente: corr.motivo ?? null,
      });
    } else {
      efetivas.push({ ...o });
    }
  }

  // Inclusões aprovadas viram batidas efetivas próprias.
  for (const inc of inclusoes) {
    if (inc.aplicado === false) continue;
    efetivas.push({ ...inc });
  }

  return efetivas;
}

/** Ordena por NSR quando houver; senão por createdAt; estável o suficiente. */
function ordenar(a: PontoRegistro, b: PontoRegistro): number {
  if (a.nsr != null && b.nsr != null) return a.nsr - b.nsr;
  return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}
