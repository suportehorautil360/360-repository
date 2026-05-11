import { create } from "zustand";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "@firebase/firestore";
import { db } from "../../../../lib/firebase/firebase";
import type { PostosProps } from "./types";

export const usePostos = create<PostosProps>()(() => ({
  listarPostos: async (prefeituraId) => {
    const q = query(
      collection(db, "postos"),
      where("prefeituraId", "==", prefeituraId),
    );
    const snap = await getDocs(q);
    return snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as import("./types").PostoFirestore,
    );
  },

  listarPostosAtivos: async (prefeituraId) => {
    const q = query(
      collection(db, "postos"),
      where("prefeituraId", "==", prefeituraId),
      where("status", "==", "Ativa"),
    );
    const snap = await getDocs(q);
    return snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as import("./types").PostoFirestore,
    );
  },

  adicionarPosto: async (data) => {
    const razaoSocial = data.razaoSocial.trim();
    if (!razaoSocial) {
      return { ok: false, message: "Preencha a razão social." };
    }
    if (!data.prefeituraId) {
      return { ok: false, message: "Selecione o cliente vinculado." };
    }
    const ref = await addDoc(collection(db, "postos"), {
      prefeituraId: data.prefeituraId,
      razaoSocial,
      ...(data.nomeFantasia ? { nomeFantasia: data.nomeFantasia.trim() } : {}),
      ...(data.cnpj ? { cnpj: data.cnpj.trim() } : {}),
      ...(data.bandeira ? { bandeira: data.bandeira.trim() } : {}),
      ...(data.endereco ? { endereco: data.endereco.trim() } : {}),
      ...(data.combustiveis ? { combustiveis: data.combustiveis.trim() } : {}),
      ...(data.limiteLitrosMes
        ? { limiteLitrosMes: data.limiteLitrosMes }
        : {}),
      ...(data.contrato ? { contrato: data.contrato.trim() } : {}),
      ...(data.validadeAte ? { validadeAte: data.validadeAte.trim() } : {}),
      status: data.status ?? "Ativa",
      createdAt: new Date().toISOString(),
    });
    return { ok: true, message: "Posto cadastrado.", id: ref.id };
  },

  removerPosto: async (id) => {
    if (!id) return { ok: false, message: "ID inválido." };
    await deleteDoc(doc(db, "postos", id));
    return { ok: true, message: "Posto removido." };
  },
}));
