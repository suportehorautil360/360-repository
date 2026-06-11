import { useEffect, useState } from "react";
import {
  checklistDefinitionsApi,
  type ChecklistDefinition,
} from "../api/checklist-definitions-api";
import { buildSeedDefinitions } from "../domain/definitions-resolver";

const CACHE_KEY = "hu360-checklist-definitions-cache";

function readCache(): ChecklistDefinition[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChecklistDefinition[];
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(defs: ChecklistDefinition[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(defs));
  } catch {
    // cota cheia / modo privado — ignora, o seed embutido cobre o offline.
  }
}

export interface UseChecklistDefinitions {
  definitions: ChecklistDefinition[];
  ready: boolean;
}

/**
 * Definições do checklist para a tela do operador, com 3 camadas de fallback
 * (offline-first — o campo nunca fica sem checklist):
 *   1. backend (atualiza o cache);
 *   2. cache em localStorage (última carga);
 *   3. seed embutido no bundle.
 * Estratégia stale-while-revalidate: usa o cache na hora e revalida em rede.
 */
export function useChecklistDefinitions(): UseChecklistDefinitions {
  const [definitions, setDefinitions] = useState<ChecklistDefinition[]>(
    () => readCache() ?? [],
  );
  const [ready, setReady] = useState<boolean>(() => (readCache()?.length ?? 0) > 0);

  useEffect(() => {
    let cancelado = false;

    const usarSeed = () => {
      if (cancelado) return;
      setDefinitions(buildSeedDefinitions());
      setReady(true);
    };

    (async () => {
      try {
        const data = await checklistDefinitionsApi.listar();
        if (cancelado) return;
        if (Array.isArray(data) && data.length > 0) {
          setDefinitions(data);
          writeCache(data);
          setReady(true);
        } else {
          // Backend ainda não semeado → cai no seed embutido.
          usarSeed();
        }
      } catch {
        if (cancelado) return;
        const cache = readCache();
        if (cache) {
          setDefinitions(cache);
          setReady(true);
        } else {
          usarSeed();
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  return { definitions, ready };
}
