import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../../lib/firebase/firebase";
import type { VeiculoFrota, VeiculoFrotaInput } from "./types";

const COLECAO = "frota";

export interface UseFrota {
  lista: VeiculoFrota[];
  loading: boolean;
  /** Adiciona 1 veículo. Recusa código duplicado. */
  adicionar: (
    data: VeiculoFrotaInput,
  ) => Promise<{ ok: boolean; message: string }>;
  /** Adiciona vários (usado pelo botão "popular com exemplos"). */
  adicionarLote: (entradas: VeiculoFrotaInput[]) => Promise<number>;
  /**
   * Atualiza a leitura (e opcionalmente o alvo da próxima revisão).
   * Toda atualização reavalia o bloqueio: zera `liberado`, então se a nova
   * leitura ainda estiver vencida o veículo volta a bloquear.
   */
  atualizar: (
    id: string,
    dados: { medicaoAtual: number; revisaoEm: number },
  ) => Promise<void>;
  /** Libera o uso de um veículo com revisão vencida. */
  liberar: (id: string) => Promise<void>;
  remover: (id: string) => Promise<void>;
}

export function useFrota(): UseFrota {
  const [lista, setLista] = useState<VeiculoFrota[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, COLECAO));
    setLista(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VeiculoFrota),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const adicionar = useCallback(
    async (data: VeiculoFrotaInput) => {
      const codigo = data.codigo.trim();
      if (!codigo) return { ok: false, message: "Informe o código." };
      if (!data.nome.trim()) return { ok: false, message: "Informe o nome." };
      if (lista.some((v) => v.codigo.toLowerCase() === codigo.toLowerCase())) {
        return { ok: false, message: "Código já cadastrado." };
      }

      const novo: Omit<VeiculoFrota, "id"> = {
        codigo,
        nome: data.nome.trim(),
        marca: data.marca.trim(),
        tipo: data.tipo,
        medicaoAtual: data.medicaoAtual,
        revisaoEm: data.revisaoEm,
        obra: data.obra.trim() || "Disponível",
        liberado: false,
        criadoEm: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, COLECAO), novo);
      setLista((prev) => [...prev, { id: ref.id, ...novo }]);
      return { ok: true, message: "Veículo adicionado." };
    },
    [lista],
  );

  const adicionarLote = useCallback(async (entradas: VeiculoFrotaInput[]) => {
    const novos: VeiculoFrota[] = [];
    for (const data of entradas) {
      const novo: Omit<VeiculoFrota, "id"> = {
        codigo: data.codigo.trim(),
        nome: data.nome.trim(),
        marca: data.marca.trim(),
        tipo: data.tipo,
        medicaoAtual: data.medicaoAtual,
        revisaoEm: data.revisaoEm,
        obra: data.obra.trim() || "Disponível",
        liberado: false,
        criadoEm: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, COLECAO), novo);
      novos.push({ id: ref.id, ...novo });
    }
    if (novos.length > 0) setLista((prev) => [...prev, ...novos]);
    return novos.length;
  }, []);

  const atualizar = useCallback(
    async (id: string, dados: { medicaoAtual: number; revisaoEm: number }) => {
      const patch = { ...dados, liberado: false };
      await updateDoc(doc(db, COLECAO, id), patch);
      setLista((prev) =>
        prev.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      );
    },
    [],
  );

  const liberar = useCallback(async (id: string) => {
    await updateDoc(doc(db, COLECAO, id), { liberado: true });
    setLista((prev) =>
      prev.map((v) => (v.id === id ? { ...v, liberado: true } : v)),
    );
  }, []);

  const remover = useCallback(async (id: string) => {
    await deleteDoc(doc(db, COLECAO, id));
    setLista((prev) => prev.filter((v) => v.id !== id));
  }, []);

  return {
    lista,
    loading,
    adicionar,
    adicionarLote,
    atualizar,
    liberar,
    remover,
  };
}
