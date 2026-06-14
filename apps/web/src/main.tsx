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
const OpportunitiesCatalogPage = lazy(() => import('./opportunities/OpportunitiesCatalogPage').then((module) => ({ default: module.OpportunitiesCatalogPage })));
const OpportunityDetailPage = lazy(() => import('./opportunities/OpportunityDetailPage').then((module) => ({ default: module.OpportunityDetailPage })));
const LeadFormPage = lazy(() => import('./leads/LeadFormPage').then((module) => ({ default: module.LeadFormPage })));
const PrivacyPage = lazy(() => import('./leads/PrivacyPage').then((module) => ({ default: module.PrivacyPage })));

// ── Auth pages ──
const LoginPage = lazy(() => import('./auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./auth/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const VerifyEmailPage = lazy(() => import('./auth/VerifyEmailPage').then((module) => ({ default: module.VerifyEmailPage })));
const RecoverAccessPage = lazy(() => import('./auth/RecoverAccessPage').then((module) => ({ default: module.RecoverAccessPage })));
const ResetPasswordPage = lazy(() => import('./auth/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));

// ── Investor pages ──
const InvestorLayout = lazy(() => import('./investors/InvestorLayout').then((module) => ({ default: module.InvestorLayout })));
const InvestorDashboard = lazy(() => import('./investors/InvestorDashboard').then((module) => ({ default: module.InvestorDashboard })));
const InvestorOpportunities = lazy(() => import('./investors/InvestorOpportunities').then((module) => ({ default: module.InvestorOpportunities })));
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
const AdminUserList = lazy(() => import('./admin/AdminUserList').then((module) => ({ default: module.default })));
const AdminUserDetail = lazy(() => import('./admin/AdminUserDetail').then((module) => ({ default: module.default })));
const AdminAuditLog = lazy(() => import('./admin/AdminAuditLog').then((module) => ({ default: module.default })));
const AdminPreview = lazy(() => import('./admin/AdminPreview').then((module) => ({ default: module.default })));

const queryClient = new QueryClient();
function PageLoader() { return <main className="min-h-screen bg-carbon p-8 text-textLight" role="status">Cargando página…</main>; }
function lazyPage(element: React.ReactNode) { return <Suspense fallback={<PageLoader />}>{element}</Suspense>; }

// Onboarding routes still go to PlannedAccess
const plannedAccessRoutes = ['/onboarding', '/onboarding/perfil', '/onboarding/elegibilidad', '/onboarding/identidad', '/onboarding/fiscalidad', '/onboarding/riesgos', '/onboarding/completado'];

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/oportunidades', element: lazyPage(<OpportunitiesCatalogPage />) },
  { path: '/oportunidades/:slug', element: lazyPage(<OpportunityDetailPage />) },
  { path: '/solicitar-acceso', element: lazyPage(<LeadFormPage kind="access_request" />) },
  { path: '/contacto', element: lazyPage(<LeadFormPage kind="general_contact" />) },
  { path: '/oportunidades/:slug/solicitar-informacion', element: lazyPage(<LeadFormPage kind="opportunity_inquiry" />) },
  { path: '/privacidad', element: lazyPage(<PrivacyPage />) },

  // ── Auth routes ──
  { path: '/acceso', element: lazyPage(<LoginPage />) },
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
      { path: 'oportunidades', element: lazyPage(<InvestorOpportunities />) },
      { path: 'cuenta', element: lazyPage(<InvestorAccount />) },
      { path: 'seguridad', element: lazyPage(<InvestorSecurity />) },
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
      { path: 'oportunidades/:id/preview', element: lazyPage(<AdminPreview />) },
      { path: 'oportunidades/:id', element: lazyPage(<AdminOpportunityEditor />) },
      { path: 'leads', element: lazyPage(<AdminLeadList />) },
      { path: 'leads/:reference', element: lazyPage(<AdminLeadDetail />) },
      { path: 'usuarios', element: lazyPage(<AdminUserList />) },
      { path: 'usuarios/:reference', element: lazyPage(<AdminUserDetail />) },
      { path: 'auditoria', element: lazyPage(<AdminAuditLog />) },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
