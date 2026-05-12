import { create } from "zustand";
import type { LoginProps, User } from "./types";
import { collection, getDocs, query, where } from "@firebase/firestore";
import { hashSenha } from "../../../utils/hashSenha";
import { db } from "../../../lib/firebase/firebase";
import { persist } from "zustand/middleware";

export const useLogin = create<LoginProps>()(
  persist(
    (set) => ({
      user: null as User | null,
      setUser: (user: User) => set({ user }),
      logout: (navigate) => {
        set({ user: null });
        navigate("/");
      },

      handleLogin: async (usuario: string, senha: string, navigate) => {
        const hashPassword = await hashSenha(senha);

        const q = query(
          collection(db, "users"),
          where("usuario", "==", usuario),
          where("senha", "==", hashPassword),
        );
        const querySnapshot = (await getDocs(q)).docs?.map((doc) => doc.data());
        const rawDoc = querySnapshot[0] as
          | (User & { prefeituraId?: string; postoId?: string })
          | undefined;
        const userData: User | undefined = rawDoc
          ? {
              id: rawDoc.id,
              usuario: rawDoc.usuario,
              type: rawDoc.type,
              prefeituraId: rawDoc.prefeituraId,
              postoId: rawDoc.postoId,
              officinaId: (rawDoc as User & { officinaId?: string }).officinaId,
            }
          : undefined;
        set({ user: userData ?? null });
        if (!userData) {
          return { error: "Usuário ou senha inválidos." };
        }
        if (userData.type === "locacao") {
          navigate(`/locacao/${userData.prefeituraId}`);
          return {};
        }
        if (userData.type === "oficina") {
          navigate(`/oficina/${userData.prefeituraId}`);
          return {};
        }
        if (userData.type === "posto") {
          navigate(`/posto/${userData.prefeituraId}`);
          return {};
        }
        if (userData.type === "prefeitura") {
          navigate(`/prefeitura/${userData.prefeituraId}`);
          return {};
        }
        navigate("/admin");
        return {};
      },
    }),
    {
      name: "login-store",
    },
  ),
);
