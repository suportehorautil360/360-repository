import { create } from "zustand";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "@firebase/firestore";
import { db } from "../../../../lib/firebase/firebase";
import type { OficinasProps } from "./types";

export const useOficinas = create<OficinasProps>()(() => ({
  listarOficinas: async (prefeituraId) => {
    const q = query(
      collection(db, "oficinas"),
      where("prefeituraId", "==", prefeituraId),
    );
    const snap = await getDocs(q);
    return snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as import("./types").OficinaFirestore,
    );
  },

  adicionarOficina: async (data) => {
    const nome = data.nome.trim();
    const especialidade = data.especialidade.trim();
    if (!nome || !especialidade) {
      return { ok: false, message: "Preencha nome e especialidade." };
    }
    if (!data.prefeituraId) {
      return { ok: false, message: "Selecione o cliente vinculado." };
    }
    const ref = await addDoc(collection(db, "oficinas"), {
      prefeituraId: data.prefeituraId,
      nome,
      especialidade,
      status: data.status ?? "Ativa",
      ...(data.credChecklist ? { credChecklist: data.credChecklist } : {}),
      ...(data.credObservacoes
        ? { credObservacoes: data.credObservacoes }
        : {}),
      ...(data.credAnexosNomes?.length
        ? { credAnexosNomes: data.credAnexosNomes }
        : {}),
      ...(data.credCnpjExtraido
        ? { credCnpjExtraido: data.credCnpjExtraido }
        : {}),
      ...(data.credRazaoSocialExtraida
        ? { credRazaoSocialExtraida: data.credRazaoSocialExtraida }
        : {}),
      createdAt: new Date().toISOString(),
    });
    return { ok: true, message: "Oficina cadastrada.", id: ref.id };
  },

  atualizarCredOficina: async (id, data) => {
    if (!id) return { ok: false, message: "ID inválido." };
    const payload: Record<string, unknown> = {};
    if (data.credChecklist !== undefined)
      payload.credChecklist = data.credChecklist;
    if (data.credObservacoes !== undefined)
      payload.credObservacoes = data.credObservacoes;
    if (data.credAnexosNomes !== undefined)
      payload.credAnexosNomes = data.credAnexosNomes;
    if (data.credCnpjExtraido !== undefined)
      payload.credCnpjExtraido = data.credCnpjExtraido;
    if (data.credRazaoSocialExtraida !== undefined)
      payload.credRazaoSocialExtraida = data.credRazaoSocialExtraida;
    await updateDoc(doc(db, "oficinas", id), payload);
    return { ok: true, message: "Credenciamento atualizado." };
  },

  removerOficina: async (id) => {
    if (!id) return { ok: false, message: "ID inválido." };
    await deleteDoc(doc(db, "oficinas", id));
    return { ok: true, message: "Oficina removida." };
  },
}));
