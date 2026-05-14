import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { hashSenha } from "../../utils/hashSenha";
import { SESSION_KEY } from "./storage";
import { useHU360 } from "./useHU360";
import { useHU360Sync } from "./useHU360Sync";
import type { Usuario } from "./types";

export interface LoginResultado {
  ok: boolean;
  msg?: string;
}

export interface HU360AuthValue {
  user: Usuario | null;
  /** True enquanto a sessão remota (API) ainda está sendo validada. */
  loading: boolean;
  login: (usuario: string, senha: string) => Promise<LoginResultado>;
  /**
   * Loga um usuário diretamente pelo identificador (sem checar senha).
   * Use APENAS depois de outra etapa de autenticação ter validado o acesso
   * (ex.: SSO interno do Hub ⇒ Portal Oficina).
   *
   * Retorna `true` se o usuário existir na base local.
   */
  loginPorUsuario: (usuarioId: string) => boolean;
  logout: () => Promise<void>;
}

export const HU360AuthContext = createContext<HU360AuthValue | null>(null);

interface HU360AuthProviderProps {
  children: ReactNode;
}

function lerSessaoLocal(): Usuario | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Usuario;
  } catch {
    return null;
  }
}

function gravarSessaoLocal(user: Usuario): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function limparSessaoLocal(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function HU360AuthProvider({ children }: HU360AuthProviderProps) {
  const { usuarios } = useHU360();
  const sync = useHU360Sync();

  /*
   * Inicialização síncrona a partir do localStorage:
   * se já houver sessão válida o portal abre direto, sem flash de login.
   * Quando a API está habilitada, o useEffect abaixo apenas reconcilia
   * em segundo plano (sem bloquear a UI).
   */
  const [user, setUser] = useState<Usuario | null>(() => {
    const parsed = lerSessaoLocal();
    if (!parsed) return null;
    const fresh = usuarios.find((u) => u.usuario === parsed.usuario) ?? null;
    if (!fresh) {
      // sessão referenciando um usuário que não existe mais → derruba
      limparSessaoLocal();
      return null;
    }
    return { ...fresh, prefeituraId: fresh.prefeituraId || "tl-ms" };
  });
  const [loading, setLoading] = useState<boolean>(false);

  const usuariosRef = useRef(usuarios);
  usuariosRef.current = usuarios;

  // Reconciliação opcional com o servidor quando a API está habilitada.
  useEffect(() => {
    if (!sync.apiEnabled()) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await sync.session();
        if (cancelled) return;
        if (res.ok && res.logged && res.user) {
          const u: Usuario = {
            ...res.user,
            prefeituraId: res.user.prefeituraId || "tl-ms",
          };
          gravarSessaoLocal(u);
          setUser(u);
        } else if (res.ok) {
          // o servidor diz que não há sessão ativa: força logout local
          limparSessaoLocal();
          setUser(null);
        }
        // res.ok=false (HTTP/parse) → mantém estado atual
      } catch {
        /* erro de rede: mantém o estado atual */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sync]);

  const login = useCallback(
    async (usuario: string, senha: string): Promise<LoginResultado> => {
      if (sync.apiEnabled()) {
        try {
          const res = await sync.login(usuario, senha);
          if (!res.ok || !res.user) {
            return { ok: false, msg: res.msg ?? "Login ou senha inválidos." };
          }
          const u: Usuario = {
            ...res.user,
            prefeituraId: res.user.prefeituraId || "tl-ms",
          };
          gravarSessaoLocal(u);
          setUser(u);
          return { ok: true };
        } catch {
          return { ok: false, msg: "Erro de rede ou servidor." };
        }
      }

      // Tenta autenticar pelo Firestore primeiro (usuários reais cadastrados pelo admin)
      try {
        const senhaHash = await hashSenha(senha);
        const snap = await getDocs(
          query(collection(db, "users"), where("usuario", "==", usuario)),
        );
        if (!snap.empty) {
          const docData = snap.docs[0].data();
          if (docData.senha === senhaHash) {
            const u: Usuario = {
              nome: String(docData.nome ?? usuario),
              usuario: String(docData.usuario),
              senha: String(docData.senha),
              perfil: String(docData.perfil ?? "gestor"),
              vinculo: String(docData.vinculo ?? docData.type ?? "prefeitura"),
              prefeituraId: String(docData.prefeituraId || "tl-ms"),
              ...(docData.postoId ? { postoId: String(docData.postoId) } : {}),
            };
            gravarSessaoLocal(u);
            setUser(u);
            return { ok: true };
          }
          // Usuário existe mas senha errada – não testa seed local
          return { ok: false, msg: "Login ou senha inválidos." };
        }
      } catch {
        /* falha de rede: cai no seed local */
      }

      // Fallback: seed local (usuários demo sem hash)
      const found =
        usuariosRef.current.find(
          (u) => u.usuario === usuario && u.senha === senha,
        ) ?? null;
      if (!found) {
        return { ok: false, msg: "Login ou senha inválidos." };
      }
      const u: Usuario = {
        ...found,
        prefeituraId: found.prefeituraId || "tl-ms",
      };
      gravarSessaoLocal(u);
      setUser(u);
      return { ok: true };
    },
    [sync],
  );

  const loginPorUsuario = useCallback((usuarioId: string): boolean => {
    const found =
      usuariosRef.current.find((u) => u.usuario === usuarioId) ?? null;
    if (!found) return false;
    const u: Usuario = {
      ...found,
      prefeituraId: found.prefeituraId || "tl-ms",
    };
    gravarSessaoLocal(u);
    setUser(u);
    return true;
  }, []);

  const logout = useCallback(async () => {
    if (sync.apiEnabled()) {
      try {
        await sync.logout();
      } catch {
        /* ignora — ainda assim limpa estado local */
      }
    }
    limparSessaoLocal();
    setUser(null);
  }, [sync]);

  const value = useMemo<HU360AuthValue>(
    () => ({ user, loading, login, loginPorUsuario, logout }),
    [user, loading, login, loginPorUsuario, logout],
  );

  return (
    <HU360AuthContext.Provider value={value}>
      {children}
    </HU360AuthContext.Provider>
  );
}
