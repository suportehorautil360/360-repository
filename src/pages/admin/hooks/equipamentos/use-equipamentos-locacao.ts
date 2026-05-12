import { useCallback, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "@firebase/firestore";
import {
  arquivoToTextPromise,
  parsePlanilhaTexto,
  type EquipamentoParseado,
} from "../../../../lib/hu360/equipamentos";
import { db } from "../../../../lib/firebase/firebase";

export interface EquipamentoDoc {
  id: string;
  prefeituraId: string;
  descricao: string;
  marca: string;
  modelo: string;
  chassis: string;
  linha: string;
  obra: string;
  status: string;
  criadoEm: string;
  /** Id da empresa em `empresas_terceiras_locacao` (sincronizado com HU360 local). */
  empresaTerceiraId?: string;
}

export interface DTOAddEquipamento {
  prefeituraId: string;
  descricao?: string;
  marca?: string;
  modelo?: string;
  chassis: string;
  linha?: string;
  obra?: string;
}

export interface UseEquipamentosLocacao {
  lista: EquipamentoDoc[];
  loading: boolean;
  carregar: (prefeituraId: string) => Promise<void>;
  adicionar: (
    data: DTOAddEquipamento,
  ) => Promise<{ ok: boolean; message: string }>;
  adicionarLote: (
    prefeituraId: string,
    entradas: EquipamentoParseado[],
  ) => Promise<{ adicionados: number; duplicados: number }>;
  importarTexto: (
    prefeituraId: string,
    raw: string,
  ) => Promise<{ adicionados: number; duplicados: number }>;
  importarArquivo: (
    prefeituraId: string,
    file: File,
  ) => Promise<{ adicionados: number; duplicados: number }>;
  remover: (id: string) => Promise<void>;
}

export function useEquipamentosLocacao(): UseEquipamentosLocacao {
  const [lista, setLista] = useState<EquipamentoDoc[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async (prefeituraId: string) => {
    if (!prefeituraId) return;
    setLoading(true);
    const q = query(
      collection(db, "equipamentos"),
      where("prefeituraId", "==", prefeituraId),
    );
    const snap = await getDocs(q);
    setLista(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EquipamentoDoc),
    );
    setLoading(false);
  }, []);

  const adicionar = useCallback(
    async (data: DTOAddEquipamento) => {
      const chassis = data.chassis.trim();
      if (!chassis)
        return { ok: false, message: "Informe ao menos o chassis." };
      if (!data.prefeituraId)
        return { ok: false, message: "Selecione o cliente." };

      // Duplicate check against current loaded list
      if (
        lista.some((e) => e.chassis.toLowerCase() === chassis.toLowerCase())
      ) {
        return { ok: false, message: "Chassis já cadastrado." };
      }

      const ref = await addDoc(collection(db, "equipamentos"), {
        prefeituraId: data.prefeituraId,
        descricao: data.descricao?.trim() ?? "",
        marca: data.marca?.trim() ?? "",
        modelo: data.modelo?.trim() ?? "",
        chassis,
        linha: data.linha?.trim() ?? "",
        obra: data.obra?.trim() ?? "",
        status: "ativo",
        criadoEm: new Date().toISOString(),
      });

      const novo: EquipamentoDoc = {
        id: ref.id,
        prefeituraId: data.prefeituraId,
        descricao: data.descricao?.trim() ?? "",
        marca: data.marca?.trim() ?? "",
        modelo: data.modelo?.trim() ?? "",
        chassis,
        linha: data.linha?.trim() ?? "",
        obra: data.obra?.trim() ?? "",
        status: "ativo",
        criadoEm: new Date().toISOString(),
      };
      setLista((prev) => [...prev, novo]);
      return { ok: true, message: "Equipamento adicionado." };
    },
    [lista],
  );

  const adicionarLote = useCallback(
    async (prefeituraId: string, entradas: EquipamentoParseado[]) => {
      let adicionados = 0;
      let duplicados = 0;
      const chassisSet = new Set(lista.map((e) => e.chassis.toLowerCase()));
      const novos: EquipamentoDoc[] = [];

      for (const entrada of entradas) {
        const chassis = entrada.chassis.trim();
        if (!chassis || chassisSet.has(chassis.toLowerCase())) {
          duplicados++;
          continue;
        }
        chassisSet.add(chassis.toLowerCase());
        const ref = await addDoc(collection(db, "equipamentos"), {
          prefeituraId,
          descricao: entrada.descricao ?? "",
          marca: entrada.marca ?? "",
          modelo: entrada.modelo ?? "",
          chassis,
          linha: entrada.linha ?? "",
          obra: entrada.obra ?? "",
          status: "ativo",
          criadoEm: new Date().toISOString(),
        });
        novos.push({
          id: ref.id,
          prefeituraId,
          descricao: entrada.descricao ?? "",
          marca: entrada.marca ?? "",
          modelo: entrada.modelo ?? "",
          chassis,
          linha: entrada.linha ?? "",
          obra: entrada.obra ?? "",
          status: "ativo",
          criadoEm: new Date().toISOString(),
        });
        adicionados++;
      }
      if (novos.length > 0) setLista((prev) => [...prev, ...novos]);
      return { adicionados, duplicados };
    },
    [lista],
  );

  const importarTexto = useCallback(
    async (prefeituraId: string, raw: string) => {
      const entradas = parsePlanilhaTexto(raw);
      return adicionarLote(prefeituraId, entradas);
    },
    [adicionarLote],
  );

  const importarArquivo = useCallback(
    async (prefeituraId: string, file: File) => {
      const texto = await arquivoToTextPromise(file);
      return importarTexto(prefeituraId, texto);
    },
    [importarTexto],
  );

  const remover = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "equipamentos", id));
    setLista((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return {
    lista,
    loading,
    carregar,
    adicionar,
    adicionarLote,
    importarTexto,
    importarArquivo,
    remover,
  };
}
