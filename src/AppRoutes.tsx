import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useLogin } from "./pages/login/hooks/use-login";
import { RouteErrorBoundary } from "./components/ErrorBoundary/RouteErrorBoundary";

// Páginas carregadas sob demanda (cada rota vira um chunk próprio).
// Os componentes são exports nomeados, então adaptamos para `default`.
const PostoPortalProvider = lazy(() =>
  import("./portal/PostoPortalProvider").then((m) => ({
    default: m.PostoPortalProvider,
  })),
);
const AdminPage = lazy(() =>
  import("./pages/admin/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const DashboardSection = lazy(() =>
  import("./pages/admin/sections/DashboardSection").then((m) => ({
    default: m.DashboardSection,
  })),
);
const PortalPostoSection = lazy(() =>
  import("./pages/admin/sections/PortalPostoSection").then((m) => ({
    default: m.PortalPostoSection,
  })),
);
const OficinasPostosSection = lazy(() =>
  import("./pages/admin/sections/OficinasPostosSection").then((m) => ({
    default: m.OficinasPostosSection,
  })),
);
const CadastroClientesSection = lazy(() =>
  import("./pages/admin/sections/CadastroClientesSection").then((m) => ({
    default: m.CadastroClientesSection,
  })),
);
const AcessosLoginsSection = lazy(() =>
  import("./pages/admin/sections/AcessosLoginsSection").then((m) => ({
    default: m.AcessosLoginsSection,
  })),
);
const EquipamentosLocacaoSection = lazy(() =>
  import("./pages/admin/sections/EquipamentosLocacaoSection").then((m) => ({
    default: m.EquipamentosLocacaoSection,
  })),
);
const AdminPortalOficinaPage = lazy(() =>
  import("./pages/admin/sections/AdminPortalOficinaPage").then((m) => ({
    default: m.AdminPortalOficinaPage,
  })),
);
const AdminPortalLocacaoPage = lazy(() =>
  import("./pages/admin/sections/AdminPortalLocacaoPage").then((m) => ({
    default: m.AdminPortalLocacaoPage,
  })),
);
const AdminPortalPostoPage = lazy(() =>
  import("./pages/admin/sections/AdminPortalPostoPage").then((m) => ({
    default: m.AdminPortalPostoPage,
  })),
);
const OficinaPage = lazy(() =>
  import("./pages/oficina/OficinaPage").then((m) => ({
    default: m.OficinaPage,
  })),
);
const LocacaoPage = lazy(() =>
  import("./pages/locacao/LocacaoPage").then((m) => ({
    default: m.LocacaoPage,
  })),
);
const PostoPage = lazy(() =>
  import("./pages/posto/PostoPage").then((m) => ({ default: m.PostoPage })),
);
const PrefeituraPage = lazy(() =>
  import("./pages/prefeitura/PrefeituraPage").then((m) => ({
    default: m.PrefeituraPage,
  })),
);
const OperacionalLoginPage = lazy(() =>
  import("./pages/login/OperacionalLoginPage").then((m) => ({
    default: m.OperacionalLoginPage,
  })),
);
const ChecklistControlePage = lazy(() =>
  import("./pages/checklist-controle/ChecklistControlePage").then((m) => ({
    default: m.ChecklistControlePage,
  })),
);
const ChecklistLoginPage = lazy(() =>
  import("./pages/checklist-controle/ChecklistLoginPage").then((m) => ({
    default: m.ChecklistLoginPage,
  })),
);

function RouteFallback() {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100dvh",
        color: "#93a4c6",
        background: "#090f1f",
        font: "600 0.95rem system-ui, sans-serif",
      }}
    >
      Carregando…
    </div>
  );
}

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

function RootRoute() {
  const { user } = useLogin();

  if (user?.type === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <PostoPortalProvider />;
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/" element={<RootRoute />} />
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
            <Route
              path="portal-posto-admin"
              element={<AdminPortalPostoPage />}
            />
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
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
