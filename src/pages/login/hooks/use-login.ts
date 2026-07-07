import { create } from "zustand";
import type { LoginProps, User } from "./types";
import { collection, getDocs, query, where } from "firebase/firestore";
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
        let querySnapshot: Record<string, unknown>[];
        try {
          querySnapshot = (await getDocs(q)).docs.map((doc) => doc.data());
        } catch {
          // Offline e o usuário ainda não está no cache do Firestore: a query
          // não tem como ser resolvida. Mensagem clara em vez de "inválido".
          if (!navigator.onLine) {
            return {
              error: "Sem conexão. O login exige internet na primeira vez.",
            };
          }
          return { error: "Falha ao conectar. Tente novamente." };
        }
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
              perfil: rawDoc.perfil,
              cargo: rawDoc.cargo,
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
          navigate(`/prefeitura/${userData.prefeituraId}/dashboard`);
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
