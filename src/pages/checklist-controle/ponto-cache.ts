/**
 * Cache last-known da folha de ponto. O histórico (e escala/config/abonos) vem
 * da API NestJS por fetch, que não funciona offline; sem cache a tela dava
 * "load failed". Guardamos a última carga online por prefeitura e servimos
 * offline. O badge de pendentes cobre as batidas ainda não sincronizadas.
 */
import type { PontoRegistro } from "../../lib/api/pontos";
import type { Escala } from "../../lib/api/escala";
import type { Configuracao } from "../../lib/api/configuracoes";
import type { Abono } from "../../lib/api/abonos";

export type PontoCache = {
  lista: PontoRegistro[];
  escala: Escala | null;
  empresa: Configuracao["empresa"] | null;
  abonos: Abono[];
};

function chave(prefeituraId: string): string {
  return `hu360-ponto-cache:${prefeituraId}`;
}

export function salvarCachePonto(
  prefeituraId: string,
  dados: PontoCache,
): void {
  try {
    localStorage.setItem(chave(prefeituraId), JSON.stringify(dados));
  } catch {
    /* cota cheia — segue sem cache */
  }
}

export function lerCachePonto(prefeituraId: string): PontoCache | null {
  try {
    const raw = localStorage.getItem(chave(prefeituraId));
    return raw ? (JSON.parse(raw) as PontoCache) : null;
  } catch {
    return null;
  }
}
