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
import { hashSenha } from "../../../../utils/hashSenha";
import type { AcessoLoginProps } from "./types";

export const useAccess = create<AcessoLoginProps>()(() => ({
  adicionarUsuario: async (data) => {
    const nome = data.nome.trim();
    const usuario = data.usuario.trim();
    const senha = data.senha.trim();

    if (!nome || !usuario || !senha) {
      return { ok: false, message: "Preencha nome, login e senha inicial." };
    }

    if (senha.length < 4) {
      return { ok: false, message: "A senha deve ter no mínimo 4 caracteres." };
    }

    if (!data.prefeituraId) {
      return { ok: false, message: "Selecione o cliente vinculado." };
    }

    const duplicados = await getDocs(
      query(collection(db, "users"), where("usuario", "==", usuario)),
    );
    if (!duplicados.empty) {
      return { ok: false, message: "Já existe um usuário com esse login." };
    }

    const senhaHash = await hashSenha(senha);

    await addDoc(collection(db, "users"), {
      nome,
      usuario,
      senha: senhaHash,
      perfil: data.perfil,
      type: data.vinculo,
      vinculo: data.vinculo,
      prefeituraId: data.prefeituraId,
      ...(data.postoId ? { postoId: data.postoId } : {}),
      ...(data.officinaId ? { officinaId: data.officinaId } : {}),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });

    return { ok: true, message: "Usuário cadastrado com sucesso." };
  },

  listarUsuarios: async (filtros) => {
    const ref = collection(db, "users");
    const constraints = [];
    if (filtros?.prefeituraId) {
      constraints.push(where("prefeituraId", "==", filtros.prefeituraId));
    }
    if (filtros?.vinculo) {
      constraints.push(where("vinculo", "==", filtros.vinculo));
    }
    const snap = await getDocs(
      constraints.length > 0 ? query(ref, ...constraints) : ref,
    );
    return snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as import("./types").UsuarioFirestore,
    );
  },

  removerUsuario: async (id) => {
    if (!id) return { ok: false, message: "ID inválido." };
    await deleteDoc(doc(db, "users", id));
    return { ok: true, message: "Usuário removido." };
  },
}));
