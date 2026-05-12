import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PostoPortalProvider } from "./portal/PostoPortalProvider";
import { AdminPage } from "./pages/admin/AdminPage";
import { DashboardSection } from "./pages/admin/sections/DashboardSection";
import { PortalPostoSection } from "./pages/admin/sections/PortalPostoSection";
import { OficinasPostosSection } from "./pages/admin/sections/OficinasPostosSection";
import { CadastroClientesSection } from "./pages/admin/sections/CadastroClientesSection";
import { AcessosLoginsSection } from "./pages/admin/sections/AcessosLoginsSection";
import { EquipamentosLocacaoSection } from "./pages/admin/sections/EquipamentosLocacaoSection";
import { AdminPortalOficinaPage } from "./pages/admin/sections/AdminPortalOficinaPage";
import { AdminPortalLocacaoPage } from "./pages/admin/sections/AdminPortalLocacaoPage";
import { AdminPortalPostoPage } from "./pages/admin/sections/AdminPortalPostoPage";
import { OficinaPage } from "./pages/oficina/OficinaPage";
import { LocacaoPage } from "./pages/locacao/LocacaoPage";
import { PostoPage } from "./pages/posto/PostoPage";
import { PrefeituraPage } from "./pages/prefeitura/PrefeituraPage";
import { useLogin } from "./pages/login/hooks/use-login";
import { OperacionalLoginPage } from "./pages/login/OperacionalLoginPage";
import { ChecklistControlePage } from "./pages/checklist-controle/ChecklistControlePage";
import { ChecklistLoginPage } from "./pages/checklist-controle/ChecklistLoginPage";

type DestinoOperacional = "locacao" | "oficina" | "posto";

type RequireOperacionalAuthProps = {
  destino: DestinoOperacional;
  children: ReactNode;
};

function RequireOperacionalAuth({
  destino,
  children,
}: RequireOperacionalAuthProps) {
  const { user } = useLogin();

  if (!user) {
    return <Navigate to={`/login-operacional?destino=${destino}`} replace />;
  }

  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PostoPortalProvider />} />
        <Route path="/admin" element={<AdminPage />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardSection />} />
          <Route path="portal-posto" element={<PortalPostoSection />} />
          <Route path="oficinas-postos" element={<OficinasPostosSection />} />
          <Route path="cadastros" element={<CadastroClientesSection />} />
          <Route path="usuarios" element={<AcessosLoginsSection />} />
          <Route
            path="equipamentos-locacao"
            element={<EquipamentosLocacaoSection />}
          />
          <Route path="portal-oficina" element={<AdminPortalOficinaPage />} />
          <Route path="portal-locacao" element={<AdminPortalLocacaoPage />} />
          <Route path="portal-posto-admin" element={<AdminPortalPostoPage />} />
        </Route>
        <Route
          path="/oficina/:id"
          element={
            <RequireOperacionalAuth destino="oficina">
              <OficinaPage />
            </RequireOperacionalAuth>
          }
        />
        <Route
          path="/locacao/:id"
          element={
            <RequireOperacionalAuth destino="locacao">
              <LocacaoPage />
            </RequireOperacionalAuth>
          }
        />
        <Route path="/login-operacional" element={<OperacionalLoginPage />} />
        <Route path="/checklist-login" element={<ChecklistLoginPage />} />
        <Route path="/checklist-controle" element={<ChecklistControlePage />} />
        <Route
          path="/posto/:id"
          element={
            <RequireOperacionalAuth destino="posto">
              <PostoPage />
            </RequireOperacionalAuth>
          }
        />
        <Route path="/prefeitura" element={<PrefeituraPage />} />
        <Route path="/prefeitura/:id" element={<PrefeituraPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
