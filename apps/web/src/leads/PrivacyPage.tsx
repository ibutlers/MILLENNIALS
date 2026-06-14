import { useEffect } from 'react';
import { Link } from 'react-router';
import { setPageMetadata } from '../metadata';

export function PrivacyPage() {
  useEffect(() => setPageMetadata('Privacidad provisional | MILLENNIALS CONSTRUYEN | CAPITAL', 'Información provisional sobre la captación de solicitudes en MILLENNIALS CONSTRUYEN | CAPITAL pendiente de revisión legal.'), []);
  return (
    <main className="min-h-screen bg-ivory px-4 py-12 text-textDark sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl">
        <nav aria-label="breadcrumb" className="text-sm"><Link to="/" className="underline">Inicio</Link> / Privacidad</nav>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-textDark/75">Privacidad provisional</p>
        <h1 className="mt-4 font-serif text-5xl tracking-[-0.04em]">Información de privacidad pendiente de revisión legal.</h1>
        <div className="mt-8 space-y-6 text-lg leading-8 text-textDark/78">
          <p>Esta página no es asesoramiento legal ni certifica cumplimiento regulatorio. La captación real permanece desactivada si falta la identidad real del responsable o el correo real de privacidad.</p>
          <h2 className="font-serif text-3xl text-textDark">Datos recogidos</h2><p>Nombre, apellidos, email, teléfono opcional, país opcional, rango aproximado opcional, mensaje opcional, origen de la solicitud, consentimientos y referencia pública.</p>
          <h2 className="font-serif text-3xl text-textDark">Finalidad</h2><p>Responder a solicitudes de acceso, información sobre oportunidades o contacto general. No se recogen documentos, KYC, DNI, patrimonio, información bancaria ni órdenes de inversión.</p>
          <h2 className="font-serif text-3xl text-textDark">Base y consentimiento</h2><p>La aceptación de privacidad es necesaria para responder. El consentimiento comercial es opcional y separado.</p>
          <h2 className="font-serif text-3xl text-textDark">Conservación</h2><p>La política definitiva de conservación queda pendiente de revisión legal. Hasta entonces se conservará solo lo necesario para responder y operar la solicitud.</p>
          <h2 className="font-serif text-3xl text-textDark">Derechos y contacto</h2><p>El canal real de privacidad debe configurarse antes de activar captación real. Sin ese dato, los formularios se muestran desactivados.</p>
          <h2 className="font-serif text-3xl text-textDark">Proveedores técnicos</h2><p>La aplicación usa infraestructura propia con PostgreSQL persistente y Docker Compose. No se añade CAPTCHA ni proveedor externo de formularios en este hito.</p>
          <h2 className="font-serif text-3xl text-textDark">Decisiones automatizadas</h2><p>No se toman decisiones automatizadas sobre solicitudes. No existe inversión, autenticación ni KYC real en este hito.</p>
        </div>
      </article>
    </main>
  );
}
