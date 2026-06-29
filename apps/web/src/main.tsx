import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { App } from './App';
import { NotFound } from './NotFound';
import { AuthProvider } from './auth/context';
import './styles.css';

// ── Existing lazy pages ──
const PlannedAccess = lazy(() => import('./PlannedAccess').then((module) => ({ default: module.PlannedAccess })));
const OpportunityDetailPage = lazy(() => import('./opportunities/OpportunityDetailPage').then((module) => ({ default: module.OpportunityDetailPage })));
const LeadFormPage = lazy(() => import('./leads/LeadFormPage').then((module) => ({ default: module.LeadFormPage })));
const PrivacyPage = lazy(() => import('./leads/PrivacyPage').then((module) => ({ default: module.PrivacyPage })));

// ── Auth pages ──
const AccessEntryPage = lazy(() => import('./auth/AccessEntryPage').then((module) => ({ default: module.AccessEntryPage })));
const LoginPage = lazy(() => import('./auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./auth/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const VerifyEmailPage = lazy(() => import('./auth/VerifyEmailPage').then((module) => ({ default: module.VerifyEmailPage })));
const RecoverAccessPage = lazy(() => import('./auth/RecoverAccessPage').then((module) => ({ default: module.RecoverAccessPage })));
const ResetPasswordPage = lazy(() => import('./auth/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));
const ActivationPage = lazy(() => import('./auth/ActivationPage').then((module) => ({ default: module.ActivationPage })));
const TwoFactorPage = lazy(() => import('./auth/TwoFactorPage').then((module) => ({ default: module.TwoFactorPage })));

// ── Investor pages ──
const InvestorLayout = lazy(() => import('./investors/InvestorLayout').then((module) => ({ default: module.InvestorLayout })));
const InvestorDashboard = lazy(() => import('./investors/InvestorDashboard').then((module) => ({ default: module.InvestorDashboard })));
const InvestorProfile = lazy(() => import('./investors/InvestorProfile').then((module) => ({ default: module.InvestorProfile })));
const InvestorPortfolio = lazy(() => import('./investors/InvestorPortfolio').then((module) => ({ default: module.InvestorPortfolio })));
const InvestorDocuments = lazy(() => import('./investors/InvestorDocuments').then((module) => ({ default: module.InvestorDocuments })));
const InvestorVerification = lazy(() => import('./investors/InvestorVerification').then((module) => ({ default: module.InvestorVerification })));
const InvestorOpportunities = lazy(() => import('./investors/InvestorOpportunities').then((module) => ({ default: module.InvestorOpportunities })));
const InvestorProjectDetail = lazy(() => import('./investors/InvestorProjectDetail').then((module) => ({ default: module.InvestorProjectDetail })));
const InvestorAccount = lazy(() => import('./investors/InvestorAccount').then((module) => ({ default: module.InvestorAccount })));
const InvestorSecurity = lazy(() => import('./investors/InvestorSecurity').then((module) => ({ default: module.InvestorSecurity })));

// ── Guards (lazy-loaded for code splitting) ──
const RequireAuth = lazy(() => import('./auth/guards').then((module) => ({ default: module.RequireAuth })));

// ── Admin pages ──
const AdminLayout = lazy(() => import('./admin/AdminLayout').then((module) => ({ default: module.default })));
const AdminDashboard = lazy(() => import('./admin/AdminDashboard').then((module) => ({ default: module.default })));
const AdminOpportunityList = lazy(() => import('./admin/AdminOpportunityList').then((module) => ({ default: module.default })));
const AdminOpportunityEditor = lazy(() => import('./admin/AdminOpportunityEditor').then((module) => ({ default: module.default })));
const AdminLeadList = lazy(() => import('./admin/AdminLeadList').then((module) => ({ default: module.default })));
const AdminLeadDetail = lazy(() => import('./admin/AdminLeadDetail').then((module) => ({ default: module.default })));
const AdminInvestmentRequests = lazy(() => import('./admin/AdminInvestmentRequests').then((module) => ({ default: module.default })));
const AdminUserList = lazy(() => import('./admin/AdminUserList').then((module) => ({ default: module.default })));
const AdminUserDetail = lazy(() => import('./admin/AdminUserDetail').then((module) => ({ default: module.default })));
const AdminAuditLog = lazy(() => import('./admin/AdminAuditLog').then((module) => ({ default: module.default })));

const queryClient = new QueryClient();
function PageLoader() { return <main className="min-h-screen bg-carbon p-8 text-textLight" role="status">Cargando página…</main>; }
function lazyPage(element: React.ReactNode) { return <Suspense fallback={<PageLoader />}>{element}</Suspense>; }

// Helper: redirect preserving search + hash
function redirectTo(path: string) {
  return ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    return Response.redirect(new URL(`${path}${url.search}${url.hash}`, url.origin), 301);
  };
}

const plannedAccessRoutes = ['/onboarding', '/onboarding/perfil', '/onboarding/elegibilidad', '/onboarding/identidad', '/onboarding/fiscalidad', '/onboarding/riesgos', '/onboarding/completado'];

const router = createBrowserRouter([
  { path: '/', element: <App /> },

  // ── Landing section redirects (pages that now live on /) ──
  { path: '/nosotros', loader: redirectTo('/#nosotros'), element: null as unknown as React.ReactNode },
  { path: '/actividad', loader: redirectTo('/#actividad'), element: null as unknown as React.ReactNode },
  { path: '/proyectos', loader: redirectTo('/#proyectos'), element: null as unknown as React.ReactNode },
  { path: '/faq', loader: redirectTo('/#faq'), element: null as unknown as React.ReactNode },
  { path: '/contacto', loader: redirectTo('/#contacto'), element: null as unknown as React.ReactNode },

  // ── Standalone pages ──
  { path: '/proyectos/:slug', element: lazyPage(<OpportunityDetailPage />) },
  { path: '/coinvierte', element: lazyPage(<LeadFormPage kind="access_request" />) },
  { path: '/proyectos/:slug/solicitar-informacion', element: lazyPage(<LeadFormPage kind="opportunity_inquiry" />) },
  { path: '/privacidad', element: lazyPage(<PrivacyPage />) },

  // ── Legacy redirects ──
  { path: '/firma', loader: redirectTo('/#nosotros'), element: null as unknown as React.ReactNode },
  { path: '/metodologia', loader: redirectTo('/#metodologia'), element: null as unknown as React.ReactNode },
  { path: '/oportunidades', loader: redirectTo('/#proyectos'), element: null as unknown as React.ReactNode },
  { path: '/oportunidades/:slug', loader: ({ request, params }) => { const url = new URL(request.url); const slug = params.slug ?? ''; return Response.redirect(new URL(`/proyectos/${slug}${url.search}${url.hash}`, url.origin), 301); }, element: null as unknown as React.ReactNode },
  { path: '/oportunidades/:slug/solicitar-informacion', loader: ({ request, params }) => { const url = new URL(request.url); const slug = params.slug ?? ''; return Response.redirect(new URL(`/proyectos/${slug}/solicitar-informacion${url.search}${url.hash}`, url.origin), 301); }, element: null as unknown as React.ReactNode },
  { path: '/solicitar-acceso', loader: redirectTo('/coinvierte'), element: null as unknown as React.ReactNode },

  // ── Auth routes ──
  { path: '/acceso', element: lazyPage(<AccessEntryPage />) },
  { path: '/acceso/login', element: lazyPage(<LoginPage />) },
  { path: '/acceso/activar', element: lazyPage(<ActivationPage />) },
  { path: '/acceso/verificar', element: lazyPage(<VerifyEmailPage />) },
  { path: '/acceso/recuperar', element: lazyPage(<RecoverAccessPage />) },
  { path: '/acceso/restablecer', element: lazyPage(<ResetPasswordPage />) },
  { path: '/acceso/2fa', element: lazyPage(<TwoFactorPage />) },
  { path: '/registro', element: lazyPage(<RegisterPage />) },
  { path: '/verificar-email', element: lazyPage(<VerifyEmailPage />) },
  { path: '/recuperar-acceso', element: lazyPage(<RecoverAccessPage />) },
  { path: '/restablecer-acceso', element: lazyPage(<ResetPasswordPage />) },

  // ── Onboarding routes (still planned) ──
  ...plannedAccessRoutes.map((path) => ({ path, element: lazyPage(<PlannedAccess variant="access" />) })),

  // ── Investor routes (wrapped in RequireAuth) ──
  {
    path: '/inversores',
    element: lazyPage(
      <Suspense fallback={<PageLoader />}>
        <RequireAuth>
          <InvestorLayout />
        </RequireAuth>
      </Suspense>
    ),
    children: [
      { index: true, element: lazyPage(<InvestorDashboard />) },
      { path: 'perfil', element: lazyPage(<InvestorProfile />) },
      { path: 'cartera', element: lazyPage(<InvestorPortfolio />) },
      { path: 'documentos', element: lazyPage(<InvestorDocuments />) },
      { path: 'verificacion', element: lazyPage(<InvestorVerification />) },
      { path: 'oportunidades', element: lazyPage(<InvestorOpportunities />) },
      { path: 'proyectos/:slug', element: lazyPage(<InvestorProjectDetail />) },
      { path: 'cuenta', element: lazyPage(<InvestorAccount />) },
      { path: 'seguridad', element: lazyPage(<InvestorSecurity />) },
    ],
  },
  // ── /inversor alias (canonical private area path) ──
  {
    path: '/inversor',
    element: lazyPage(
      <Suspense fallback={<PageLoader />}>
        <RequireAuth>
          <InvestorLayout />
        </RequireAuth>
      </Suspense>
    ),
    children: [
      { index: true, element: lazyPage(<InvestorDashboard />) },
      { path: 'proyectos', element: lazyPage(<InvestorOpportunities />) },
      { path: 'proyectos/:slug', element: lazyPage(<InvestorProjectDetail />) },
      { path: 'perfil', element: lazyPage(<InvestorProfile />) },
    ],
  },

  // ── Catch-all ──
  { path: '*', element: <NotFound /> },

  // ── Admin routes ──
  {
    path: '/admin',
    element: lazyPage(
      <Suspense fallback={<PageLoader />}>
        <AdminLayout />
      </Suspense>
    ),
    children: [
      { index: true, element: lazyPage(<AdminDashboard />) },
      { path: 'oportunidades', element: lazyPage(<AdminOpportunityList />) },
      { path: 'oportunidades/nueva', element: lazyPage(<AdminOpportunityEditor />) },
      { path: 'oportunidades/:id', element: lazyPage(<AdminOpportunityEditor />) },
      { path: 'leads', element: lazyPage(<AdminLeadList />) },
      { path: 'leads/:reference', element: lazyPage(<AdminLeadDetail />) },
      { path: 'inversiones', element: lazyPage(<AdminInvestmentRequests />) },
      { path: 'usuarios', element: lazyPage(<AdminUserList />) },
      { path: 'usuarios/:reference', element: lazyPage(<AdminUserDetail />) },
      { path: 'auditoria', element: lazyPage(<AdminAuditLog />) },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider baseURL={window.location.origin}>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
