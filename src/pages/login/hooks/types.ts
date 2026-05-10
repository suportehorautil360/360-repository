import type { useNavigate } from "react-router-dom";

export type User = {
  id: string;
  usuario: string;
  type: "admin" | "locacao" | "oficina" | "posto" | "prefeitura";
};

export interface LoginProps {
  user: User | null;
  setUser: (user: User) => void;
  handleLogin: (
    usuario: string,
    senha: string,
    navigate: ReturnType<typeof useNavigate>,
  ) => Promise<void>;
}
