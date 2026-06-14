import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeadFormPage } from './LeadFormPage';

function renderPage(path = '/solicitar-acceso', kind: 'access_request' | 'general_contact' | 'opportunity_inquiry' = 'access_request') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path="/solicitar-acceso" element={<LeadFormPage kind={kind} />} /><Route path="/contacto" element={<LeadFormPage kind="general_contact" />} /></Routes></MemoryRouter></QueryClientProvider>);
}

function mockFetch(settingsEnabled: boolean, postOk = true) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/api/v1/lead-settings')) return { ok: true, json: async () => ({ data: { enabled: settingsEnabled, privacyPolicyVersion: '2026-06-14', controllerConfigured: settingsEnabled, privacyContactConfigured: settingsEnabled } }) };
    if (url.includes('/api/v1/leads') && postOk) return { ok: true, status: 201, json: async () => ({ data: { publicReference: 'RS-20260614-ABC123', kind: 'access_request', status: 'new', createdAt: '2026-06-14T09:00:00.000Z', message: 'Solicitud recibida. Conserva esta referencia para futuras comunicaciones.' } }) };
    return { ok: false, status: 503, json: async () => ({ error: { code: 'leads_disabled' } }) };
  }));
}

describe('LeadFormPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows an honest disabled state when lead capture is unavailable', async () => {
    mockFetch(false);
    renderPage();
    expect(await screen.findByText(/solicitudes todavía no están habilitadas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar solicitud/i })).toBeDisabled();
  });

  it('validates required fields and privacy consent', async () => {
    mockFetch(true);
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /enviar solicitud/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/campo obligatorio/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/privacidad/i);
  });

  it('submits only after API 201 and shows the public reference', async () => {
    mockFetch(true);
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /enviar solicitud/i })).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText(/^Nombre/i), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText(/Apellidos/i), { target: { value: 'Lovelace' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'ada@example.test' } });
    fireEvent.click(screen.getByLabelText(/Acepto la información de privacidad/i));
    fireEvent.click(screen.getByLabelText(/comunicaciones comerciales/i));
    fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));
    expect(await screen.findByText(/RS-20260614-ABC123/)).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith('/api/v1/leads', expect.objectContaining({ method: 'POST' }));
  });
});
