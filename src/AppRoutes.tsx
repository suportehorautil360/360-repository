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
import { OficinaPage } from "./pages/oficina/OficinaPage";
import { LocacaoPage } from "./pages/locacao/LocacaoPage";
import { PostoPage } from "./pages/posto/PostoPage";
import { PrefeituraPage } from "./pages/prefeitura/PrefeituraPage";
import { useHU360Auth } from "./lib/hu360";
import { OperacionalLoginPage } from "./pages/login/OperacionalLoginPage";

type DestinoOperacional = "locacao" | "oficina";

type RequireOperacionalAuthProps = {
  destino: DestinoOperacional;
  children: ReactNode;
};

function RequireOperacionalAuth({
  destino,
  children,
}: RequireOperacionalAuthProps) {
  const { user, loading } = useHU360Auth();

  if (loading) return null;

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
        </Route>
        <Route
          path="/oficina"
          element={
            <RequireOperacionalAuth destino="oficina">
              <OficinaPage />
            </RequireOperacionalAuth>
          }
        />
        <Route path="/locacao" element={<LocacaoPage />} />
        <Route path="/login-operacional" element={<OperacionalLoginPage />} />
        <Route path="/posto" element={<PostoPage />} />
        <Route path="/prefeitura" element={<PrefeituraPage />} />
        <Route path="/prefeitura/:id" element={<PrefeituraPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
