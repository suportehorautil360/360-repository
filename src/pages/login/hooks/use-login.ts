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

      handleLogin: async (usuario: string, senha: string, navigate) => {
        const hashPassword = await hashSenha(senha);

        const q = query(
          collection(db, "users"),
          where("usuario", "==", usuario),
          where("senha", "==", hashPassword),
        );
        const querySnapshot = (await getDocs(q)).docs?.map((doc) => doc.data());
        console.log("Query snapshot:", querySnapshot[0] as User);
        const userData = querySnapshot[0] as User | undefined;
        set({ user: userData });
        if (userData) {
          if (userData.type === "locacao") {
            navigate("/locacao");
            return;
          }
          if (userData.type === "oficina") {
            navigate("/oficina");
            return;
          }

          navigate("/admin");
        }
      },
    }),
    {
      name: "login-store",
    },
  ),
);
