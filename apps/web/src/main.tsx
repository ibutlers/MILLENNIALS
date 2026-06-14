import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { App } from './App';
import { NotFound } from './NotFound';
import { PlannedAccess } from './PlannedAccess';
import { OpportunitiesCatalogPage } from './opportunities/OpportunitiesCatalogPage';
import { OpportunityDetailPage } from './opportunities/OpportunityDetailPage';
import './styles.css';

const queryClient = new QueryClient();
const plannedAccessRoutes = [
  '/acceso',
  '/registro',
  '/verificar-email',
  '/onboarding',
  '/onboarding/perfil',
  '/onboarding/elegibilidad',
  '/onboarding/identidad',
  '/onboarding/fiscalidad',
  '/onboarding/riesgos',
  '/onboarding/completado'
];

const plannedInvestorRoutes = [
  '/inversores',
  '/inversores/oportunidades',
  '/inversores/oportunidades/:slug',
  '/inversores/cartera',
  '/inversores/actualizaciones',
  '/inversores/documentos',
  '/inversores/cuenta',
  '/inversores/ayuda'
];

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/oportunidades', element: <OpportunitiesCatalogPage /> },
  { path: '/oportunidades/:slug', element: <OpportunityDetailPage /> },
  ...plannedAccessRoutes.map((path) => ({ path, element: <PlannedAccess variant="access" /> })),
  ...plannedInvestorRoutes.map((path) => ({ path, element: <PlannedAccess variant="investors" /> })),
  { path: '*', element: <NotFound /> }
]);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
