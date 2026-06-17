/**
 * Frota do operador para o checklist — isolada por prefeitura NO SERVIDOR.
 *
 * Lê a frota pelo backend NestJS (`/equipamentos/{prefeituraId}`), que escopa
 * por prefeitura no servidor: nunca chega ao aparelho um equipamento de outra
 * empresa. O resultado fica em cache local (por prefeitura) para o checklist
 * seguir funcionando offline em campo — e o cache, por construção, só contém a
 * frota da própria prefeitura, então não vaza nem sem rede.
 *
 * Sem `prefeituraId` na sessão NÃO há frota (fail-closed): preferimos a tela
 * vazia a vazar a frota de todas as prefeituras (o que acontecia ao consultar
 * a coleção `equipamentos` direto, sem filtro garantido).
 */
import { equipamentosApi } from "../prefeitura/sections/equipamentos/equipamentos-api";

export type EquipFrota = {
  id: string;
  prefeituraId: string;
  label: string;
  chassis: string;
  modelo: string;
  linha: string;
  tipo: string;
};

function chave(prefeituraId: string): string {
  return `hu360-frota-operador:${prefeituraId}`;
}

function salvarCache(prefeituraId: string, frota: EquipFrota[]): void {
  try {
    localStorage.setItem(chave(prefeituraId), JSON.stringify(frota));
  } catch {
    /* cota cheia — segue sem cache */
  }
}

export function lerCacheFrota(prefeituraId: string): EquipFrota[] {
  if (!prefeituraId) return [];
  try {
    const raw = localStorage.getItem(chave(prefeituraId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? (parsed as EquipFrota[]) : [];
  } catch {
    return [];
  }
}

/**
 * Frota da prefeitura do operador. Online: busca no NestJS e atualiza o cache.
 * Offline / backend fora: cai no último cache DESTA prefeitura (já isolado).
 * Sem `prefeituraId`: retorna `[]` (fail-closed).
 */
export async function carregarFrotaOperador(
  prefeituraId: string,
): Promise<EquipFrota[]> {
  if (!prefeituraId) return [];
  try {
    const rows = await equipamentosApi.listar(prefeituraId);
    const frota: EquipFrota[] = rows.map((r) => ({
      id: r.id,
      prefeituraId,
      label: r.descricao,
      chassis: r.chassis,
      modelo: r.modelo,
      linha: r.linha,
      tipo: r.tipo,
    }));
    salvarCache(prefeituraId, frota);
    return frota;
  } catch {
    return lerCacheFrota(prefeituraId);
  }
}
