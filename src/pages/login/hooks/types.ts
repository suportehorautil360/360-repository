import type { useNavigate } from "react-router-dom";

export type User = {
  id: string;
  usuario: string;
  type: "admin" | "locacao" | "oficina" | "posto" | "prefeitura";
  prefeituraId?: string;
  postoId?: string;
  officinaId?: string;
};

export interface LoginProps {
  user: User | null;
  setUser: (user: User) => void;
  logout: (navigate: ReturnType<typeof useNavigate>) => void;
  handleLogin: (
    usuario: string,
    senha: string,
    navigate: ReturnType<typeof useNavigate>,
  ) => Promise<{ error?: string }>;
}
