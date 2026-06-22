import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvestorDocuments } from './InvestorDocuments';

function mockDocuments(documents: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: documents }),
  })));
}

describe('InvestorDocuments', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no muestra enlace de descarga cuando el backend indica que no hay descarga real disponible', async () => {
    mockDocuments([
      {
        id: 'doc_pending',
        title: 'Contrato pendiente',
        type: 'legal_document',
        status: 'active',
        mime_type: 'application/pdf',
        byte_size: 1024,
        project_slug: 'plaza-america',
        project_title: 'Plaza América',
        download_available: false,
      },
    ]);

    render(<InvestorDocuments />);

    expect(await screen.findByText('Contrato pendiente')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /descargar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/descarga no disponible/i)).toBeInTheDocument();
  });

  it('muestra enlace de descarga solo cuando el documento real está disponible', async () => {
    mockDocuments([
      {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Contrato firmado',
        type: 'legal_document',
        status: 'active',
        mime_type: 'application/pdf',
        byte_size: 4096,
        project_slug: 'plaza-america',
        project_title: 'Plaza América',
        download_available: true,
      },
    ]);

    render(<InvestorDocuments />);

    const link = await screen.findByRole('link', { name: /descargar/i });
    expect(link).toHaveAttribute(
      'href',
      '/api/investor/projects/plaza-america/documents/00000000-0000-0000-0000-000000000001/download',
    );
  });
});
