import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { App } from './App';
import { NotFound } from './NotFound';
import './styles.css';

const PlannedAccess = lazy(() => import('./PlannedAccess').then((module) => ({ default: module.PlannedAccess })));
const OpportunitiesCatalogPage = lazy(() => import('./opportunities/OpportunitiesCatalogPage').then((module) => ({ default: module.OpportunitiesCatalogPage })));
const OpportunityDetailPage = lazy(() => import('./opportunities/OpportunityDetailPage').then((module) => ({ default: module.OpportunityDetailPage })));
const LeadFormPage = lazy(() => import('./leads/LeadFormPage').then((module) => ({ default: module.LeadFormPage })));
const PrivacyPage = lazy(() => import('./leads/PrivacyPage').then((module) => ({ default: module.PrivacyPage })));

const queryClient = new QueryClient();
function PageLoader() { return <main className="min-h-screen bg-carbon p-8 text-textLight" role="status">Cargando página…</main>; }
function lazyPage(element: React.ReactNode) { return <Suspense fallback={<PageLoader />}>{element}</Suspense>; }

const plannedAccessRoutes = ['/registro','/verificar-email','/onboarding','/onboarding/perfil','/onboarding/elegibilidad','/onboarding/identidad','/onboarding/fiscalidad','/onboarding/riesgos','/onboarding/completado'];
const plannedInvestorRoutes = ['/inversores','/inversores/oportunidades','/inversores/oportunidades/:slug','/inversores/cartera','/inversores/actualizaciones','/inversores/documentos','/inversores/cuenta','/inversores/ayuda'];

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/oportunidades', element: lazyPage(<OpportunitiesCatalogPage />) },
  { path: '/oportunidades/:slug', element: lazyPage(<OpportunityDetailPage />) },
  { path: '/solicitar-acceso', element: lazyPage(<LeadFormPage kind="access_request" />) },
  { path: '/contacto', element: lazyPage(<LeadFormPage kind="general_contact" />) },
  { path: '/oportunidades/:slug/solicitar-informacion', element: lazyPage(<LeadFormPage kind="opportunity_inquiry" />) },
  { path: '/privacidad', element: lazyPage(<PrivacyPage />) },
  { path: '/acceso', element: lazyPage(<LeadFormPage kind="access_request" />) },
  ...plannedAccessRoutes.map((path) => ({ path, element: lazyPage(<PlannedAccess variant="access" />) })),
  ...plannedInvestorRoutes.map((path) => ({ path, element: lazyPage(<PlannedAccess variant="investors" />) })),
  { path: '*', element: <NotFound /> }
]);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
