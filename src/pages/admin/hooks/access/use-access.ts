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
} from "firebase/firestore";
import { db } from "../../../../lib/firebase/firebase";
import { hashSenha } from "../../../../utils/hashSenha";
import type { AcessoLoginProps } from "./types";

export const useAccess = create<AcessoLoginProps>()(() => ({
  adicionarUsuario: async (data) => {
    const nome = data.nome.trim();
    const usuario = data.usuario.trim();
    const email = data.email?.trim().toLowerCase() ?? "";
    const senha = data.senha.trim();

    if (!nome || !usuario || !senha) {
      return { ok: false, message: "Preencha nome, login e senha inicial." };
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: "E-mail inválido." };
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

    if (email) {
      const emailDup = await getDocs(
        query(collection(db, "users"), where("email", "==", email)),
      );
      if (!emailDup.empty) {
        return { ok: false, message: "Já existe um usuário com esse e-mail." };
      }
    }

    const senhaHash = await hashSenha(senha);

    await addDoc(collection(db, "users"), {
      nome,
      usuario,
      ...(email ? { email } : {}),
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
    if (filtros?.postoId) {
      constraints.push(where("postoId", "==", filtros.postoId));
    }
    const snap = await getDocs(
      constraints.length > 0 ? query(ref, ...constraints) : ref,
    );
    // `id` DEPOIS do spread: o doc id do Firestore vence o campo `id` legado
    // (randomUUID) salvo no doc — senão remover/resetar usam o id errado (no-op).
    return snap.docs.map(
      (d) => ({ ...d.data(), id: d.id }) as import("./types").UsuarioFirestore,
    );
  },

  resetarSenha: async (id, novaSenha) => {
    const senha = novaSenha.trim();
    if (!id) return { ok: false, message: "ID inválido." };
    if (senha.length < 4) {
      return { ok: false, message: "A senha deve ter no mínimo 4 caracteres." };
    }
    const senhaHash = await hashSenha(senha);
    await updateDoc(doc(db, "users", id), { senha: senhaHash });
    return { ok: true, message: "Senha redefinida." };
  },

  removerUsuario: async (id) => {
    if (!id) return { ok: false, message: "ID inválido." };
    await deleteDoc(doc(db, "users", id));
    return { ok: true, message: "Usuário removido." };
  },
}));
