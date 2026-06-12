/**
 * Motor de sincronização do outbox: recupera itens presos (crash anterior),
 * percorre os devidos em ordem, faz claim atômico (uma aba só) e envia pelo
 * enviador registrado da entidade. Falha transitória (rede, 5xx, 408, 429)
 * volta pra fila com backoff; definitiva (4xx de validação) vira
 * NEEDS_ATTENTION, visível para o operador. Nada é descartado em silêncio.
 */
import { ApiError } from "../api/client";
import type { ItemOutbox } from "./db";
import {
  concluir,
  listarDevidos,
  marcarAtencao,
  marcarEnviando,
  recuperarPresos,
  registrarFalha,
} from "./outbox";

export type Enviador = (item: ItemOutbox) => Promise<void>;

const enviadores = new Map<string, Enviador>();

export function registrarEnviador(entity: string, enviar: Enviador): void {
  enviadores.set(entity, enviar);
}

function erroDefinitivo(e: unknown): boolean {
  return (
    e instanceof ApiError &&
    e.status >= 400 &&
    e.status < 500 &&
    e.status !== 408 &&
    e.status !== 429
  );
}

let emExecucao: Promise<{ enviados: number; falhas: number }> | null = null;

export function processarFila(): Promise<{ enviados: number; falhas: number }> {
  // Gatilhos disparam juntos (online + intervalo + mount); ciclos sobrepostos
  // fariam recuperarPresos() derrubar o claim do ciclo em andamento.
  emExecucao ??= executarCiclo().finally(() => {
    emExecucao = null;
  });
  return emExecucao;
}

async function executarCiclo(): Promise<{ enviados: number; falhas: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { enviados: 0, falhas: 0 };
  }
  await recuperarPresos();
  let enviados = 0;
  let falhas = 0;
  for (const item of await listarDevidos()) {
    const enviar = enviadores.get(item.entity);
    if (!enviar) continue;
    if (!(await marcarEnviando(item.id))) continue;
    try {
      await enviar(item);
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      if (erroDefinitivo(e)) await marcarAtencao(item.id, motivo);
      else await registrarFalha(item.id, motivo);
      falhas++;
      continue;
    }
    // Fora do try: o envio deu certo — falha do Dexie ao concluir não pode
    // ser contabilizada como falha do servidor.
    await concluir(item.id);
    enviados++;
  }
  return { enviados, falhas };
}
