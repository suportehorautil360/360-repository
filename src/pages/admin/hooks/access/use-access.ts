import { create } from "zustand";
import { addDoc, collection, getDocs, query, where } from "@firebase/firestore";
import { db } from "../../../../lib/firebase/firebase";
import { hashSenha } from "../../../../utils/hashSenha";
import type { AcessoLoginProps } from "./types";

export const useAccess = create<AcessoLoginProps>()(() => ({
  handleAddLocacao: async (data) => {
    const nome = data.fullName.trim();
    const usuario = data.userLogin.trim();
    const senha = data.initialPassword.trim();

    if (!nome || !usuario || !senha) {
      return {
        ok: false,
        message: "Preencha nome, login e senha inicial.",
      };
    }

    if (senha.length < 4) {
      return {
        ok: false,
        message: "A senha inicial deve ter no minimo 4 caracteres.",
      };
    }

    const loginJaExiste = query(
      collection(db, "users"),
      where("usuario", "==", usuario),
    );

    const duplicados = await getDocs(loginJaExiste);
    if (!duplicados.empty) {
      return {
        ok: false,
        message: "Ja existe um usuario com esse login.",
      };
    }

    const senhaHash = await hashSenha(senha);

    await addDoc(collection(db, "users"), {
      nome,
      usuario,
      senha: senhaHash,
      perfil: data.profille === "Administrador" ? "admin" : "gestor",
      type: "locacao",
      createdAt: new Date().toISOString(),
    });

    return {
      ok: true,
      message: "Usuario de locacao cadastrado com sucesso.",
    };
  },
}));
