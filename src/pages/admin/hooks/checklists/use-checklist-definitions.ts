import { useCallback, useState } from "react";
import {
  checklistDefinitionsApi,
  type ChecklistDefinition,
  type ChecklistDefinitionInput,
} from "../../../../features/checklist/api/checklist-definitions-api";

export interface UseChecklistDefinitionsAdmin {
  lista: ChecklistDefinition[];
  loading: boolean;
  erro: string | null;
  carregar: () => Promise<void>;
  adicionar: (
    input: ChecklistDefinitionInput,
  ) => Promise<{ ok: boolean; message: string }>;
  atualizar: (
    id: string,
    input: Partial<ChecklistDefinitionInput>,
  ) => Promise<{ ok: boolean; message: string }>;
  desativar: (id: string) => Promise<{ ok: boolean; message: string }>;
  semear: () => Promise<{ ok: boolean; message: string }>;
}

function msgErro(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/** CRUD do catálogo global de definições de checklist (via backend NestJS). */
export function useChecklistDefinitions(): UseChecklistDefinitionsAdmin {
  const [lista, setLista] = useState<ChecklistDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setLista(await checklistDefinitionsApi.listar());
    } catch (e) {
      setErro(msgErro(e, "Falha ao carregar as definições de checklist."));
    } finally {
      setLoading(false);
    }
  }, []);

  const adicionar = useCallback(async (input: ChecklistDefinitionInput) => {
    try {
      const novo = await checklistDefinitionsApi.criar(input);
      setLista((prev) => [...prev, novo]);
      return { ok: true, message: "Checklist criado." };
    } catch (e) {
      return { ok: false, message: msgErro(e, "Falha ao criar o checklist.") };
    }
  }, []);

  const atualizar = useCallback(
    async (id: string, input: Partial<ChecklistDefinitionInput>) => {
      try {
        await checklistDefinitionsApi.atualizar(id, input);
        // Recarrega para refletir version/itens consolidados pelo backend.
        const atualizado = await checklistDefinitionsApi.obter(id);
        setLista((prev) => prev.map((d) => (d.id === id ? atualizado : d)));
        return { ok: true, message: "Checklist atualizado." };
      } catch (e) {
        return {
          ok: false,
          message: msgErro(e, "Falha ao atualizar o checklist."),
        };
      }
    },
    [],
  );

  const desativar = useCallback(async (id: string) => {
    try {
      await checklistDefinitionsApi.remover(id);
      setLista((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ativo: false } : d)),
      );
      return { ok: true, message: "Checklist desativado." };
    } catch (e) {
      return {
        ok: false,
        message: msgErro(e, "Falha ao desativar o checklist."),
      };
    }
  }, []);

  const semear = useCallback(async () => {
    try {
      await checklistDefinitionsApi.seed();
      await carregar();
      return { ok: true, message: "Catálogo populado a partir do seed." };
    } catch (e) {
      return { ok: false, message: msgErro(e, "Falha ao popular o catálogo.") };
    }
  }, [carregar]);

  return {
    lista,
    loading,
    erro,
    carregar,
    adicionar,
    atualizar,
    desativar,
    semear,
  };
}
