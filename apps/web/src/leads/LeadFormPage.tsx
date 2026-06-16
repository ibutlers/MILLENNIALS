import { useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { setPageMetadata } from '../metadata';
import { fetchOpportunityDetail } from '../opportunities/api';
import { fetchLeadSettings, submitLead, type LeadCreated, type LeadKind } from './api';

type Errors = Record<string, string>;

const labels = {
  access_request: { title: 'Solicitar acceso a MILLENNIALS CONSTRUYEN', eyebrow: 'Acceso privado futuro', intro: 'Déjanos tus datos para valorar una futura invitación cuando la zona privada esté disponible.', cta: 'Enviar solicitud de acceso' },
  opportunity_inquiry: { title: 'Solicitar información de oportunidad', eyebrow: 'Información pública', intro: 'Solicitar información no implica invertir ni reservar participación.', cta: 'Solicitar información' },
  general_contact: { title: 'Contactar con MILLENNIALS CONSTRUYEN', eyebrow: 'Contacto general', intro: 'Usa este canal para consultas generales sobre la firma o la plataforma.', cta: 'Enviar consulta' }
};

export function LeadFormPage({ kind }: { kind: LeadKind }) {
  const { slug } = useParams();
  const mountedAt = useRef(Date.now());
  const errorRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<LeadCreated | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const settings = useQuery({ queryKey: ['lead-settings'], queryFn: ({ signal }) => fetchLeadSettings(signal), staleTime: 30_000 });
  const opportunity = useQuery({ queryKey: ['opportunity', slug], queryFn: ({ signal }) => fetchOpportunityDetail(slug ?? '', signal), enabled: kind === 'opportunity_inquiry' && Boolean(slug), staleTime: 30_000 });
  const text = labels[kind];

  useEffect(() => { setPageMetadata(`${text.title} | MILLENNIALS CONSTRUYEN`, `${text.intro} Captación provisional con privacidad pendiente de revisión legal.`); }, [text.intro, text.title]);
  useEffect(() => { if (Object.keys(errors).length) errorRef.current?.focus(); }, [errors]);

  const disabledReason = useMemo(() => {
    if (settings.isLoading) return 'Comprobando disponibilidad…';
    if (settings.isError || !settings.data?.enabled) return 'Las solicitudes todavía no están habilitadas porque faltan datos legales reales del responsable o el canal de privacidad.';
    return null;
  }, [settings.data?.enabled, settings.isError, settings.isLoading]);

  function validate(form: HTMLFormElement): { data?: FormData; errors: Errors } {
    const data = new FormData(form);
    const next: Errors = {};
    for (const name of ['firstName', 'lastName', 'email']) if (!String(data.get(name) ?? '').trim()) next[name] = 'Campo obligatorio.';
    if (!String(data.get('email') ?? '').includes('@')) next.email = 'Introduce un email válido.';
    if (String(data.get('message') ?? '').length > 2000) next.message = 'El mensaje no puede superar 2000 caracteres.';
    if (data.get('privacyAccepted') !== 'on') next.privacyAccepted = 'Debes aceptar la información de privacidad para que podamos responder.';
    if (String(data.get('website') ?? '').trim()) next.website = 'No se pudo procesar la solicitud.';
    return { data, errors: next };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const { data, errors: nextErrors } = validate(form);
    setErrors(nextErrors);
    if (!data || Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const search = new URLSearchParams(window.location.search);
      const created = await submitLead({
        kind,
        opportunitySlug: kind === 'opportunity_inquiry' ? slug : undefined,
        firstName: String(data.get('firstName') ?? ''),
        lastName: String(data.get('lastName') ?? ''),
        email: String(data.get('email') ?? ''),
        phone: String(data.get('phone') ?? '') || undefined,
        countryCode: String(data.get('countryCode') ?? '') || undefined,
        investmentRange: String(data.get('investmentRange') ?? '') || undefined,
        message: String(data.get('message') ?? '') || undefined,
        sourcePath: window.location.pathname,
        referrer: document.referrer || undefined,
        utmSource: search.get('utm_source') ?? undefined,
        utmMedium: search.get('utm_medium') ?? undefined,
        utmCampaign: search.get('utm_campaign') ?? undefined,
        privacyAccepted: true,
        marketingOptIn: data.get('marketingOptIn') === 'on',
        riskAcknowledged: data.get('riskAcknowledged') === 'on',
        submittedAfterMs: Date.now() - mountedAt.current,
        website: String(data.get('website') ?? '')
      });
      setResult(created);
      form.reset();
    } catch (error) {
      const message = error instanceof Error && error.message === 'disabled'
        ? 'La captación todavía no está habilitada. No hemos guardado la solicitud.'
        : error instanceof Error && error.message === 'rate_limited'
          ? 'Demasiados intentos. Inténtalo más tarde.'
          : 'No hemos podido enviar la solicitud. Revisa los datos e inténtalo de nuevo.';
      setErrors({ form: message });
    } finally { setSubmitting(false); }
  }

  return (
    <main className="min-h-screen bg-ivory px-4 py-10 text-textDark sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="breadcrumb" className="text-sm"><Link to="/" className="underline">Inicio</Link> / <span>{text.title}</span></nav>
        <section className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-textDark/75">{text.eyebrow}</p>
            <h1 className="mt-4 font-serif text-5xl tracking-[-0.04em] sm:text-6xl">{text.title}</h1>
            <p className="mt-5 text-lg leading-8 text-textDark/75">{text.intro}</p>
            {kind === 'opportunity_inquiry' && opportunity.data ? <div className="mt-6 border border-carbon/10 bg-white/55 p-4"><h2 className="font-serif text-2xl">{opportunity.data.data.title}</h2><p className="mt-2 text-sm text-textDark/75">{opportunity.data.data.shortDescription}</p></div> : null}
            <p className="mt-6 border border-bronze bg-bronze/10 p-4 text-sm leading-6">No hay inversión real, reserva, autenticación ni KYC en este hito. Los datos se usan solo para responder a tu solicitud.</p>
          </div>
          <div className="border border-carbon/10 bg-white/70 p-5 shadow-xl shadow-carbon/5">
            {disabledReason ? <div role="status" className="border border-warning bg-warning/10 p-4 text-sm font-bold">{disabledReason}</div> : null}
            {Object.keys(errors).length ? <div ref={errorRef} tabIndex={-1} role="alert" className="mt-4 border border-danger bg-danger/10 p-4"><p className="font-bold">Revisa el formulario</p><ul className="mt-2 list-disc pl-5">{Object.entries(errors).map(([k, v]) => <li key={k}>{v}</li>)}</ul></div> : null}
            {result ? <div role="status" className="mt-4 border border-mineral bg-mineral/20 p-4"><p className="font-bold">Solicitud recibida</p><p>Referencia pública: <strong>{result.publicReference}</strong></p><p>{result.message}</p></div> : null}
            <form className="mt-5 grid gap-4" onSubmit={onSubmit} noValidate>
              <div className="hidden" aria-hidden="true"><label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <label className="grid gap-1">Nombre<input name="firstName" className="border border-carbon/20 p-3" autoComplete="given-name" disabled={Boolean(disabledReason) || submitting} /></label>
              <label className="grid gap-1">Apellidos<input name="lastName" className="border border-carbon/20 p-3" autoComplete="family-name" disabled={Boolean(disabledReason) || submitting} /></label>
              <label className="grid gap-1">Email<input name="email" type="email" className="border border-carbon/20 p-3" autoComplete="email" disabled={Boolean(disabledReason) || submitting} /></label>
              <label className="grid gap-1">Teléfono opcional<input name="phone" className="border border-carbon/20 p-3" autoComplete="tel" disabled={Boolean(disabledReason) || submitting} /></label>
              <label className="grid gap-1">País opcional<input name="countryCode" maxLength={2} className="border border-carbon/20 p-3" placeholder="ES" disabled={Boolean(disabledReason) || submitting} /></label>
              {kind !== 'general_contact' ? <label className="grid gap-1">Rango de interés aproximado opcional<select name="investmentRange" className="border border-carbon/20 p-3" disabled={Boolean(disabledReason) || submitting}><option value="">Sin indicar</option><option value="10000_25000">10.000–25.000 €</option><option value="25000_50000">25.000–50.000 €</option><option value="50000_plus">Más de 50.000 €</option></select></label> : null}
              <label className="grid gap-1">Mensaje opcional<textarea name="message" rows={5} maxLength={2000} className="border border-carbon/20 p-3" disabled={Boolean(disabledReason) || submitting} /></label>
              <label className="flex gap-3"><input name="privacyAccepted" type="checkbox" disabled={Boolean(disabledReason) || submitting} /> <span>Acepto la <Link to="/privacidad" className="underline">información de privacidad provisional</Link> para que MILLENNIALS CONSTRUYEN pueda responder.</span></label>
              <label className="flex gap-3"><input name="marketingOptIn" type="checkbox" disabled={Boolean(disabledReason) || submitting} /> <span>Acepto recibir comunicaciones comerciales futuras. Opcional y separado.</span></label>
              {kind === 'opportunity_inquiry' ? <label className="flex gap-3"><input name="riskAcknowledged" type="checkbox" disabled={Boolean(disabledReason) || submitting} /> <span>Entiendo que solicitar información no implica inversión y que los objetivos no están garantizados.</span></label> : null}
              <button type="submit" disabled={Boolean(disabledReason) || submitting} className="bg-mineral px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-textDark disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Enviando…' : text.cta}</button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
