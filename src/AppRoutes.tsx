import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { useLogin } from "./pages/login/hooks/use-login";
import { useOperadorSession } from "./pages/checklist-controle/useOperadorSession";
import { jaBateuHoje } from "./pages/checklist-controle/ponto-dia";
import { usePontoAtivo } from "./lib/api/feature-flags";
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
const ParceirosSection = lazy(() =>
  import("./pages/admin/sections/ParceirosSection").then((m) => ({
    default: m.ParceirosSection,
  })),
);
const PostoDetalhePage = lazy(() =>
  import("./pages/admin/sections/PostoDetalhePage").then((m) => ({
    default: m.PostoDetalhePage,
  })),
);
const OficinaDetalhePage = lazy(() =>
  import("./pages/admin/sections/OficinaDetalhePage").then((m) => ({
    default: m.OficinaDetalhePage,
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
const ClientesSection = lazy(() =>
  import("./pages/admin/sections/ClientesSection").then((m) => ({
    default: m.ClientesSection,
  })),
);
const FinanceiroSection = lazy(() =>
  import("./pages/admin/sections/FinanceiroSection").then((m) => ({
    default: m.FinanceiroSection,
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
const WhatsappSection = lazy(() =>
  import("./pages/admin/sections/WhatsappSection").then((m) => ({
    default: m.WhatsappSection,
  })),
);
const SuportePostosAdminSection = lazy(() =>
  import("./pages/admin/sections/SuportePostosAdminSection").then((m) => ({
    default: m.SuportePostosAdminSection,
  })),
);
const ChecklistsSection = lazy(() =>
  import("./pages/admin/sections/ChecklistsSection").then((m) => ({
    default: m.ChecklistsSection,
  })),
);
const FuncionalidadesSection = lazy(() =>
  import("./pages/admin/sections/FuncionalidadesSection").then((m) => ({
    default: m.FuncionalidadesSection,
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
const PrefeituraLoginPage = lazy(() =>
  import("./pages/prefeitura/PrefeituraLoginPage").then((m) => ({
    default: m.PrefeituraLoginPage,
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
const PontoPage = lazy(() =>
  import("./pages/checklist-controle/PontoPage").then((m) => ({
    default: m.PontoPage,
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

function RequirePrefeituraAuth({ children }: { children: ReactNode }) {
  const { user } = useLogin();
  const { id: idParam } = useParams<{ id?: string }>();

  if (!user) {
    return <Navigate to="/login-prefeitura" replace />;
  }

  if (user.type !== "prefeitura") {
    return (
      <Navigate
        to={user.type === "admin" ? "/admin/dashboard" : "/login-prefeitura"}
        replace
      />
    );
  }

  const municipioDaRota = idParam?.trim();
  const municipioDoUsuario = user.prefeituraId?.trim();

  if (
    municipioDaRota &&
    municipioDoUsuario &&
    municipioDaRota !== municipioDoUsuario
  ) {
    return (
      <Navigate
        to={`/prefeitura/${municipioDoUsuario}/dashboard`}
        replace
      />
    );
  }

  return <>{children}</>;
}

function PrefeituraRoute() {
  return (
    <RequirePrefeituraAuth>
      <PrefeituraPage />
    </RequirePrefeituraAuth>
  );
}

function RootRoute() {
  const { user } = useLogin();

  if (user?.type === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <PostoPortalProvider />;
}

/**
 * Gate obrigatório de ponto: com sessão de operador ativa e sem batida
 * registrada hoje, manda bater o ponto antes de liberar o checklist.
 */
function RequirePonto({ children }: { children: ReactNode }) {
  const { session } = useOperadorSession();
  const { ativo, carregando } = usePontoAtivo(session?.idCliente);

  // Sem ponto ativo (ou ainda carregando a flag) não força o gate.
  if (!session || !ativo) return <>{children}</>;
  if (carregando) return <RouteFallback />;
  if (!jaBateuHoje(session)) return <Navigate to="/ponto" replace />;

  return <>{children}</>;
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
            <Route path="clientes" element={<ClientesSection />} />
            <Route path="financeiro" element={<FinanceiroSection />} />
            <Route
              path="funcionalidades"
              element={<FuncionalidadesSection />}
            />
            <Route path="whatsapp" element={<WhatsappSection />} />
            <Route path="suporte-postos" element={<SuportePostosAdminSection />} />
            <Route path="checklists" element={<ChecklistsSection />} />
            <Route path="portal-posto" element={<PortalPostoSection />} />
            <Route path="parceiros" element={<ParceirosSection />} />
            <Route path="parceiros/posto/:postoId" element={<PostoDetalhePage />} />
            <Route
              path="parceiros/oficina/:oficinaId"
              element={<OficinaDetalhePage />}
            />
            <Route path="oficinas-postos" element={<OficinasPostosSection />} />
            <Route path="cadastros" element={<CadastroClientesSection />} />
            <Route
              path="cadastros/:clienteId"
              element={<CadastroClientesSection />}
            />
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
          <Route path="/login-prefeitura" element={<PrefeituraLoginPage />} />
          <Route path="/checklist-login" element={<ChecklistLoginPage />} />
          <Route path="/ponto" element={<PontoPage />} />
          <Route
            path="/checklist-controle"
            element={
              <RequirePonto>
                <ChecklistControlePage />
              </RequirePonto>
            }
          />
          <Route
            path="/posto/:id"
            element={
              <RequireOperacionalAuth destino="posto">
                <PostoPage />
              </RequireOperacionalAuth>
            }
          />
          <Route path="/prefeitura" element={<PrefeituraRoute />} />
          <Route path="/prefeitura/:id" element={<PrefeituraRoute />} />
          <Route
            path="/prefeitura/:id/funcionarios/novo"
            element={<PrefeituraRoute />}
          />
          <Route
            path="/prefeitura/:id/funcionarios/:funcId/editar"
            element={<PrefeituraRoute />}
          />
          <Route
            path="/prefeitura/:id/funcionarios/:funcId/historico"
            element={<PrefeituraRoute />}
          />
          <Route
            path="/prefeitura/:id/funcionarios/:funcId/historico/:dia"
            element={<PrefeituraRoute />}
          />
          <Route
            path="/prefeitura/:id/equipamentos/novo"
            element={<PrefeituraRoute />}
          />
          <Route
            path="/prefeitura/:id/equipamentos/:equipId/editar"
            element={<PrefeituraRoute />}
          />
          <Route path="/prefeitura/:id/:secao" element={<PrefeituraRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
