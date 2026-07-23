import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { isAdminAuthenticated } from "../../admin/adminSession";
import { getAdminSecret } from "../../lib/api/admin-secret";
import { useHU360Auth } from "../../lib/hu360";
import { AdminLayout } from "./AdminLayout";
import { useLogin } from "../login/hooks/use-login";

/** Usuário do seed HU360 que recebe a sessão quando o admin entra via env. */
const ADMIN_USUARIO_HU360 = "admin";

/**
 * Shell autenticado do admin. Sem sessão, redireciona para `/login-admin`.
 */
export function AdminPage() {
  const auth = useHU360Auth();
  const { user } = useLogin();

  const hasAdminSecret = Boolean(getAdminSecret());
  const sessionAuthenticated =
    (isAdminAuthenticated() || user?.type === "admin") && hasAdminSecret;

  useEffect(() => {
    if (!sessionAuthenticated) return;
    if (auth.loading) return;
    if (auth.user) return;
    auth.loginPorUsuario(ADMIN_USUARIO_HU360, { persist: false });
  }, [sessionAuthenticated, auth.loading, auth.user, auth]);

  if (!sessionAuthenticated) {
    return <Navigate to="/login-admin" replace />;
  }

  return <AdminLayout />;
}
