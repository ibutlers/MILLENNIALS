import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvestorVerification } from './InvestorVerification';

vi.mock('../metadata', () => ({ setPageMetadata: vi.fn() }));
vi.mock('../auth/context', () => ({
  useAuth: () => ({ user: { name: 'Víctor Pérez González', email: 'victor@example.test' }, isAuthAvailable: true }),
}));

describe('InvestorVerification', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: {
        status: 'not_configured',
        providerStatus: { configured: false, status: 'not_configured' },
        canInitiate: false,
        disclaimer: 'El proveedor de verificación de identidad (KYC) no está configurado. No se simula un estado verificado.',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  });

  afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

  async function renderVerification() {
    render(<InvestorVerification />);
    await waitFor(() => expect(screen.queryByText(/Consultando el estado privado de verificación/i)).not.toBeInTheDocument());
  }

  it('muestra un onboarding KYC multi-paso sin simular verificación externa', async () => {
    await renderVerification();
    expect(screen.getByRole('heading', { level: 1, name: /completa tu verificación kyc/i })).toBeInTheDocument();
    expect(screen.getByText(/Paso 1 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /progreso de verificación kyc/i })).toHaveAttribute('aria-valuenow', '33');
    expect(screen.getByText(/Verificación de identidad pendiente/i)).toBeInTheDocument();
    expect(screen.getByText(/Proveedor KYC no configurado/i)).toBeInTheDocument();
    expect(screen.getByText(/No se generan enlaces, códigos QR ni estados verificados ficticios/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /persona física/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /empresa o entidad jurídica/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continuar$/i })).toBeDisabled();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/investor/verification', expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }));
  });

  it('abre los campos de persona física al seleccionar ese tipo de cuenta', async () => {
    await renderVerification();
    fireEvent.click(screen.getByRole('button', { name: /persona física/i }));
    const continueButton = screen.getByRole('button', { name: /^continuar$/i });
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);
    expect(screen.getByText(/Paso 2 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /completa los datos de tu perfil/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nombre$/i)).toHaveValue('Víctor');
    expect(screen.getByLabelText(/^Apellidos$/i)).toHaveValue('Pérez González');
    expect(screen.getByLabelText(/Documento de identidad \(DNI\/NIE\/Pasaporte\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Fecha de nacimiento$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nacionalidad$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Teléfono móvil$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^País de residencia fiscal$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Dirección postal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar al paso documental/i })).toBeDisabled();
  });

  it('adapta el formulario cuando el perfil opera como empresa', async () => {
    await renderVerification();
    fireEvent.click(screen.getByRole('button', { name: /empresa o entidad jurídica/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));
    expect(screen.getByRole('heading', { name: /completa los datos de tu perfil/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Denominación social$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nº de identificación fiscal \(CIF\/NIF\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nombre del representante$/i)).toHaveValue('Víctor');
    expect(screen.getByLabelText(/^Apellidos del representante$/i)).toHaveValue('Pérez González');
    expect(screen.getByLabelText(/Documento de identidad del representante/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Cargo \/ relación con la sociedad$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^País de constitución de la sociedad$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^País de residencia fiscal de la sociedad$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Domicilio de la sociedad/i)).toBeInTheDocument();
  });

  it('mantiene desactivada la acción dependiente del proveedor externo', async () => {
    await renderVerification();
    fireEvent.click(screen.getByRole('button', { name: /persona física/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));

    fireEvent.change(screen.getByLabelText(/Documento de identidad \(DNI\/NIE\/Pasaporte\)/i), { target: { value: '12345678A' } });
    fireEvent.change(screen.getByLabelText(/^Fecha de nacimiento$/i), { target: { value: '1990-01-01' } });
    fireEvent.change(screen.getByLabelText(/^Nacionalidad$/i), { target: { value: 'España' } });
    fireEvent.change(screen.getByLabelText(/^Teléfono móvil$/i), { target: { value: '+34 600 000 000' } });
    fireEvent.change(screen.getByLabelText(/^País de residencia fiscal$/i), { target: { value: 'España' } });
    fireEvent.change(screen.getByLabelText(/^Dirección postal/i), { target: { value: 'Calle Real 1, Vigo' } });

    const documentStepButton = screen.getByRole('button', { name: /continuar al paso documental/i });
    expect(documentStepButton).toBeEnabled();
    fireEvent.click(documentStepButton);

    expect(screen.getByText(/Paso 3 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /documentación y verificación externa/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /sesión externa pendiente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar verificación externa/i })).toBeDisabled();
    expect(document.body).not.toHaveTextContent(/verificación completada|identidad verificada|kyc aprobado/i);
  });

  it('muestra proveedor disponible sin habilitar una sesión externa ficticia', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      data: {
        status: 'not_started',
        providerStatus: { configured: true, status: 'ok', message: 'Proveedor KYC disponible.' },
        canInitiate: false,
        disclaimer: 'El proveedor KYC está disponible, pero el inicio de sesión externa todavía no está habilitado para este perfil.',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await renderVerification();
    expect(screen.getByText(/Proveedor KYC configurado/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /persona física/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));
    fireEvent.change(screen.getByLabelText(/Documento de identidad \(DNI\/NIE\/Pasaporte\)/i), { target: { value: '12345678A' } });
    fireEvent.change(screen.getByLabelText(/^Fecha de nacimiento$/i), { target: { value: '1990-01-01' } });
    fireEvent.change(screen.getByLabelText(/^Nacionalidad$/i), { target: { value: 'España' } });
    fireEvent.change(screen.getByLabelText(/^Teléfono móvil$/i), { target: { value: '+34 600 000 000' } });
    fireEvent.change(screen.getByLabelText(/^País de residencia fiscal$/i), { target: { value: 'España' } });
    fireEvent.change(screen.getByLabelText(/^Dirección postal/i), { target: { value: 'Calle Real 1, Vigo' } });
    fireEvent.click(screen.getByRole('button', { name: /continuar al paso documental/i }));

    expect(screen.getByRole('heading', { name: /sesión externa no iniciada/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar verificación externa/i })).toBeDisabled();
    expect(document.body).not.toHaveTextContent(/verificación completada|identidad verificada|kyc aprobado/i);
  });
});
