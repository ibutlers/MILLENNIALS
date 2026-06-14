/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router';
import { apiFetch } from '../api/client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  HighlightsEditor,
  RisksEditor,
  MilestonesEditor,
  MediaEditor,
  type HighlightItem,
  type RiskItem,
  type MilestoneItem,
  type MediaItem,
} from './SubEntityEditors';
import { useAuth } from '../auth/context';

// ── Types ──
interface OppFull {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  description: string;
  city: string;
  country_code: string;
  district: string | null;
  asset_type: string;
  strategy: string;
  editorial_status: string;
  visibility: string;
  status: string;
  currency: string;
  target_amount_cents: number;
  committed_amount_cents: number;
  minimum_investment_cents: number;
  estimated_term_months: number;
  target_return_type: string | null;
  target_return_bps: number | null;
  risk_level: string;
  closing_date: string | null;
  disclaimer: string | null;
  version: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SubEntitiesResponse {
  data: {
    highlights: Array<{ label: string; value: string; position: number }>;
    risks: Array<{ title: string; description: string; position: number }>;
    milestones: Array<{ title: string; description: string; planned_date: string | null; completed_at: string | null; position: number }>;
    media: Array<{ asset_id: string; alt_text: string; primary: boolean; position: number }>;
  };
}

interface FormState {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  city: string;
  countryCode: string;
  district: string;
  assetType: string;
  strategy: string;
  editorialStatus: string;
  visibility: string;
  status: string;
  currency: string;
  targetAmountCents: number;
  committedAmountCents: number;
  minimumInvestmentCents: number;
  estimatedTermMonths: number;
  targetReturnType: string;
  targetReturnBps: number;
  riskLevel: string;
  closingDate: string;
  disclaimer: string;
  version: number;
}

const EMPTY_FORM: FormState = {
  title: '',
  slug: '',
  shortDescription: '',
  description: '',
  city: '',
  countryCode: 'ES',
  district: '',
  assetType: '',
  strategy: '',
  editorialStatus: 'draft',
  visibility: 'private',
  status: 'coming_soon',
  currency: 'EUR',
  targetAmountCents: 0,
  committedAmountCents: 0,
  minimumInvestmentCents: 0,
  estimatedTermMonths: 12,
  targetReturnType: '',
  targetReturnBps: 0,
  riskLevel: 'medium',
  closingDate: '',
  disclaimer: '',
  version: 1,
};

// ── Section definitions ──
interface SectionDef {
  key: string;
  label: string;
  fields: (keyof FormState)[];
  isSubentity: boolean;
}

const SECTIONS: SectionDef[] = [
  { key: 'general', label: 'General', fields: ['title', 'slug', 'shortDescription'], isSubentity: false },
  { key: 'location', label: 'Localización', fields: ['city', 'countryCode', 'district'], isSubentity: false },
  { key: 'assetStrategy', label: 'Activo y estrategia', fields: ['assetType', 'strategy'], isSubentity: false },
  { key: 'statusVisibility', label: 'Estado y visibilidad', fields: ['editorialStatus', 'visibility', 'status'], isSubentity: false },
  { key: 'financials', label: 'Financieras', fields: ['currency', 'targetAmountCents', 'committedAmountCents', 'minimumInvestmentCents', 'estimatedTermMonths', 'targetReturnType', 'targetReturnBps', 'riskLevel', 'closingDate'], isSubentity: false },
  { key: 'description', label: 'Descripción', fields: ['description', 'disclaimer'], isSubentity: false },
  { key: 'highlights', label: 'Highlights', fields: [], isSubentity: true },
  { key: 'risks', label: 'Riesgos', fields: [], isSubentity: true },
  { key: 'milestones', label: 'Hitos', fields: [], isSubentity: true },
  { key: 'media', label: 'Media', fields: [], isSubentity: true },
  { key: 'review', label: 'Revisión', fields: [], isSubentity: false },
];

// ── Helpers ──
const EUR_TO_CENTS = (eur: number) => Math.round(eur * 100);
const CENTS_TO_EUR = (cents: number) => (cents / 100).toFixed(2);
const BPS_TO_PCT = (bps: number) => (bps / 100).toFixed(2);
const PCT_TO_BPS = (pct: number) => Math.round(pct * 100);

function oppToForm(opp: OppFull): FormState {
  return {
    title: opp.title || '',
    slug: opp.slug || '',
    shortDescription: opp.short_description || '',
    description: opp.description || '',
    city: opp.city || '',
    countryCode: opp.country_code || 'ES',
    district: opp.district || '',
    assetType: opp.asset_type || '',
    strategy: opp.strategy || '',
    editorialStatus: opp.editorial_status || 'draft',
    visibility: opp.visibility || 'private',
    status: opp.status || 'coming_soon',
    currency: opp.currency || 'EUR',
    targetAmountCents: opp.target_amount_cents || 0,
    committedAmountCents: opp.committed_amount_cents || 0,
    minimumInvestmentCents: opp.minimum_investment_cents || 0,
    estimatedTermMonths: opp.estimated_term_months || 12,
    targetReturnType: opp.target_return_type || '',
    targetReturnBps: opp.target_return_bps || 0,
    riskLevel: opp.risk_level || 'medium',
    closingDate: opp.closing_date ? opp.closing_date.slice(0, 10) : '',
    disclaimer: opp.disclaimer || '',
    version: opp.version,
  };
}

function formToApiPayload(form: FormState): Record<string, any> {
  return {
    title: form.title,
    slug: form.slug,
    short_description: form.shortDescription,
    description: form.description,
    city: form.city,
    country_code: form.countryCode,
    district: form.district || null,
    asset_type: form.assetType,
    strategy: form.strategy,
    editorial_status: form.editorialStatus,
    visibility: form.visibility,
    status: form.status,
    currency: form.currency,
    target_amount_cents: form.targetAmountCents,
    committed_amount_cents: form.committedAmountCents,
    minimum_investment_cents: form.minimumInvestmentCents,
    estimated_term_months: form.estimatedTermMonths,
    target_return_type: form.targetReturnType || null,
    target_return_bps: form.targetReturnBps || null,
    risk_level: form.riskLevel,
    closing_date: form.closingDate || null,
    disclaimer: form.disclaimer || null,
  };
}

// ── Validation ──
interface ValidationErrors {
  [key: string]: string[];
}

function validateSection(
  sectionKey: string,
  form: FormState,
  highlights: HighlightItem[],
  risks: RiskItem[],
  media: MediaItem[],
): string[] {
  const errors: string[] = [];

  switch (sectionKey) {
    case 'general':
      if (!form.title.trim()) errors.push('El título es obligatorio');
      break;
    case 'location':
      if (!form.city.trim()) errors.push('La ciudad es obligatoria');
      if (!form.countryCode.trim()) errors.push('El código de país es obligatorio');
      break;
    case 'assetStrategy':
      if (!form.assetType.trim()) errors.push('El tipo de activo es obligatorio');
      if (!form.strategy.trim()) errors.push('La estrategia es obligatoria');
      break;
    case 'statusVisibility':
      if (!form.editorialStatus) errors.push('El estado editorial es obligatorio');
      if (!form.visibility) errors.push('La visibilidad es obligatoria');
      if (!form.status) errors.push('El estado es obligatorio');
      break;
    case 'financials':
      if (form.targetAmountCents <= 0) errors.push('El capital objetivo debe ser mayor que 0');
      if (form.minimumInvestmentCents <= 0) errors.push('El ticket mínimo debe ser mayor que 0');
      if (form.estimatedTermMonths <= 0) errors.push('El plazo estimado debe ser mayor que 0');
      break;
    case 'description':
      if (!form.description.trim()) errors.push('La descripción es obligatoria para publicar');
      break;
    case 'risks':
      if (risks.length === 0) errors.push('Se requiere al menos un riesgo para publicar');
      break;
    case 'media':
      if (media.length === 0) errors.push('Se requiere al menos una imagen para publicar');
      break;
    case 'review': {
      // Aggregate all validation for review
      const allErrors: string[] = [];
      for (const s of SECTIONS) {
        if (s.key === 'review') continue;
        const sectionErrors = validateSection(s.key, form, highlights, risks, media);
        allErrors.push(...sectionErrors);
      }
      return allErrors;
    }
  }

  return errors;
}

function getMissingFields(form: FormState, highlights: HighlightItem[], risks: RiskItem[], media: MediaItem[]): string[] {
  const missing: string[] = [];
  if (!form.title.trim()) missing.push('Título');
  if (!form.city.trim()) missing.push('Ciudad');
  if (!form.countryCode.trim()) missing.push('Código de país');
  if (!form.assetType.trim()) missing.push('Tipo de activo');
  if (!form.strategy.trim()) missing.push('Estrategia');
  if (!form.description.trim()) missing.push('Descripción');
  if (form.targetAmountCents <= 0) missing.push('Capital objetivo');
  if (risks.length === 0) missing.push('Al menos 1 riesgo');
  if (media.length === 0) missing.push('Al menos 1 imagen');
  return missing;
}

// ── Main component ──
export default function AdminOpportunityEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isNew = !id;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<FormState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState<{ currentVersion: number; providedVersion: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('general');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showValidation, setShowValidation] = useState(false);
  const activeSectionRef = useRef<HTMLDivElement>(null);

  // Subentity state
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [initialHighlights, setInitialHighlights] = useState<HighlightItem[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [initialRisks, setInitialRisks] = useState<RiskItem[]>([]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [initialMilestones, setInitialMilestones] = useState<MilestoneItem[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [initialMedia, setInitialMedia] = useState<MediaItem[]>([]);

  // ── Query: main opportunity ──
  const { data, isLoading, error } = useQuery<{ data: OppFull }>({
    queryKey: ['admin', 'opportunities', id],
    queryFn: () => apiFetch(`/api/v1/admin/opportunities/${id}`),
    enabled: !isNew,
  });

  // ── Query: subentities ──
  const { data: subData } = useQuery<SubEntitiesResponse>({
    queryKey: ['admin', 'opportunities', id, 'subentities'],
    queryFn: () => apiFetch(`/api/v1/admin/opportunities/${id}/subentities`),
    enabled: !isNew && !!id,
  });

  // ── Load form data ──
  useEffect(() => {
    if (data?.data) {
      const f = oppToForm(data.data);
      setForm(f);
      setInitialForm(f);
    }
  }, [data]);

  // ── Load subentity data ──
  useEffect(() => {
    if (subData?.data) {
      const h: HighlightItem[] = (subData.data.highlights || []).map((item, i) => ({
        _id: crypto.randomUUID(),
        label: item.label,
        value: item.value,
        position: item.position ?? i,
      }));
      const r: RiskItem[] = (subData.data.risks || []).map((item, i) => ({
        _id: crypto.randomUUID(),
        title: item.title,
        description: item.description,
        position: item.position ?? i,
      }));
      const m: MilestoneItem[] = (subData.data.milestones || []).map((item, i) => ({
        _id: crypto.randomUUID(),
        title: item.title,
        description: item.description,
        plannedDate: item.planned_date || '',
        completedAt: item.completed_at || '',
        position: item.position ?? i,
      }));
      const med: MediaItem[] = (subData.data.media || []).map((item, i) => ({
        _id: crypto.randomUUID(),
        assetId: item.asset_id,
        alt: item.alt_text,
        primary: item.primary,
        position: item.position ?? i,
      }));

      setHighlights(h);
      setInitialHighlights(h);
      setRisks(r);
      setInitialRisks(r);
      setMilestones(m);
      setInitialMilestones(m);
      setMedia(med);
      setInitialMedia(med);
    }
  }, [subData]);

  // ── Dirty detection ──
  useEffect(() => {
    if (!initialForm) {
      // For new opportunities, check if anything differs from EMPTY_FORM
      const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY_FORM) ||
        highlights.length > 0 || risks.length > 0 || milestones.length > 0 || media.length > 0;
      setDirty(isDirty);
      return;
    }

    const formDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
    const highlightsDirty = JSON.stringify(highlights) !== JSON.stringify(initialHighlights);
    const risksDirty = JSON.stringify(risks) !== JSON.stringify(initialRisks);
    const milestonesDirty = JSON.stringify(milestones) !== JSON.stringify(initialMilestones);
    const mediaDirty = JSON.stringify(media) !== JSON.stringify(initialMedia);

    setDirty(formDirty || highlightsDirty || risksDirty || milestonesDirty || mediaDirty);
  }, [form, highlights, risks, milestones, media, initialForm, initialHighlights, initialRisks, initialMilestones, initialMedia]);

  // ── Section dirty detection ──
  function isSectionDirty(section: SectionDef): boolean {
    if (!initialForm && isNew) {
      if (section.isSubentity) {
        if (section.key === 'highlights') return highlights.length > 0;
        if (section.key === 'risks') return risks.length > 0;
        if (section.key === 'milestones') return milestones.length > 0;
        if (section.key === 'media') return media.length > 0;
      }
      return section.fields.some((f) => form[f] !== EMPTY_FORM[f]);
    }
    if (!initialForm) return false;

    if (section.isSubentity) {
      if (section.key === 'highlights') return JSON.stringify(highlights) !== JSON.stringify(initialHighlights);
      if (section.key === 'risks') return JSON.stringify(risks) !== JSON.stringify(initialRisks);
      if (section.key === 'milestones') return JSON.stringify(milestones) !== JSON.stringify(initialMilestones);
      if (section.key === 'media') return JSON.stringify(media) !== JSON.stringify(initialMedia);
    }
    return section.fields.some((f) => form[f] !== initialForm[f]);
  }

  // ── Validation error indicator per section ──
  const sectionErrors = useMemo(() => {
    const errs: Record<string, boolean> = {};
    for (const s of SECTIONS) {
      const errors = validateSection(s.key, form, highlights, risks, media);
      errs[s.key] = errors.length > 0;
    }
    return errs;
  }, [form, highlights, risks, media]);

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No ID');
      const body = { ...formToApiPayload(form), version: form.version };
      const resp: any = await apiFetch(`/api/v1/admin/opportunities/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return resp;
    },
    onSuccess: (resp: any) => {
      if (resp?.data?.version) {
        setForm((prev) => ({ ...prev, version: resp.data.version }));
        setInitialForm((prev) => prev ? { ...prev, version: resp.data.version } : null);
      }
      setConflict(null);
      setSaveError(null);
      const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      setLastSaved(now);
      setSaveStatus('Guardado correctamente');
      queryClient.invalidateQueries({ queryKey: ['admin', 'opportunities'] });
    },
    onError: (err: any) => {
      setSaveStatus('');
      if (err?.code === 'version_conflict') {
        setConflict({ currentVersion: err.currentVersion, providedVersion: err.providedVersion });
      } else {
        setSaveError(err?.message || 'Error al guardar.');
      }
    },
  });

  const subentityMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No ID');
      const body = {
        highlights: highlights.map((h, i) => ({ label: h.label, value: h.value, position: i })),
        risks: risks.map((r, i) => ({ title: r.title, description: r.description, position: i })),
        milestones: milestones.map((m, i) => ({
          title: m.title,
          description: m.description,
          planned_date: m.plannedDate || null,
          completed_at: m.completedAt || null,
          position: i,
        })),
        media: media.map((m, i) => ({
          asset_id: m.assetId,
          alt_text: m.alt,
          primary: m.primary,
          position: i,
        })),
        version: form.version,
      };
      return apiFetch(`/api/v1/admin/opportunities/${id}/subentities`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setInitialHighlights([...highlights]);
      setInitialRisks([...risks]);
      setInitialMilestones([...milestones]);
      setInitialMedia([...media]);
      queryClient.invalidateQueries({ queryKey: ['admin', 'opportunities', id, 'subentities'] });
    },
    onError: (err: any) => {
      setSaveError(err?.message || 'Error al guardar subentidades.');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = formToApiPayload(form);
      return apiFetch('/api/v1/admin/opportunities', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: (resp: any) => {
      if (resp?.data?.id) {
        navigate(`/admin/oportunidades/${resp.data.id}`, { replace: true });
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'opportunities'] });
    },
    onError: (err: any) => {
      setSaveError(err?.message || 'Error al crear la oportunidad.');
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No ID');
      return apiFetch(`/api/v1/admin/opportunities/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ version: form.version }),
      });
    },
    onSuccess: () => {
      setSaveStatus('Publicado correctamente');
      queryClient.invalidateQueries({ queryKey: ['admin', 'opportunities'] });
    },
    onError: (err: any) => {
      setSaveError(err?.message || 'Error al publicar.');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No ID');
      return apiFetch(`/api/v1/admin/opportunities/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ editorial_status: 'review', version: form.version }),
      });
    },
    onSuccess: () => {
      setForm((prev) => ({ ...prev, editorialStatus: 'review' }));
      setSaveStatus('Enviado a revisión');
      queryClient.invalidateQueries({ queryKey: ['admin', 'opportunities'] });
    },
    onError: (err: any) => {
      setSaveError(err?.message || 'Error al enviar a revisión.');
    },
  });

  // ── Handlers ──
  function setField(field: keyof FormState, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaveError(null);
    setSaveStatus('Guardando…');
    setConflict(null);

    if (isNew) {
      createMutation.mutate();
      return;
    }

    try {
      await saveMutation.mutateAsync();
      await subentityMutation.mutateAsync();
    } catch {
      // Errors handled in onError callbacks
    }
  }

  function handlePublish() {
    setSaveError(null);
    setShowValidation(true);

    // Validate all sections
    const allErrors: ValidationErrors = {};
    let hasErrors = false;
    for (const s of SECTIONS) {
      if (s.key === 'review') continue;
      const errs = validateSection(s.key, form, highlights, risks, media);
      if (errs.length > 0) {
        allErrors[s.key] = errs;
        hasErrors = true;
      }
    }
    setValidationErrors(allErrors);

    if (hasErrors) {
      // Navigate to first section with errors
      const firstErrorSection = SECTIONS.find((s) => allErrors[s.key]?.length > 0);
      if (firstErrorSection) {
        setActiveSection(firstErrorSection.key);
        // Focus first error field after render
        setTimeout(() => {
          const el = activeSectionRef.current?.querySelector('input, textarea, select');
          if (el instanceof HTMLElement) el.focus();
        }, 100);
      }
      setSaveError('Corrige los errores antes de publicar.');
      return;
    }

    publishMutation.mutate();
  }

  function handleSendToReview() {
    if (isNew) {
      setSaveError('Guarda primero la oportunidad antes de enviar a revisión.');
      return;
    }
    reviewMutation.mutate();
  }

  function handleSectionChange(key: string) {
    setActiveSection(key);
    setMobileMenuOpen(false);
    setShowValidation(false);
  }

  // ── Warn on leave ──
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // ── Loading / error states ──
  if (isLoading && !isNew) {
    return <div className="animate-pulse p-8 text-[#9B7E5F]">Cargando oportunidad…</div>;
  }
  if (error && !isNew) {
    return <div className="p-8 text-[#9B7E5F]">Error al cargar la oportunidad.</div>;
  }

  const isSaving = saveMutation.isPending || createMutation.isPending || subentityMutation.isPending;
  const isPublishing = publishMutation.isPending;
  const canPublish = user?.roles?.some((r) => ['admin', 'operator'].includes(r));

  // ── Render ──
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {saveStatus}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[#1A3E48] shrink-0">
        <h2 className="font-serif text-xl text-[#FBF7F0]">
          {isNew ? 'Nueva oportunidad' : 'Editar oportunidad'}
        </h2>
        <div className="flex items-center gap-4">
          <Link
            to={`/admin/oportunidades/${id}/preview`}
            className="text-sm text-[#7FA88C] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vista previa ↗
          </Link>
          <Link to="/admin/oportunidades" className="text-sm text-[#9B7E5F] hover:text-[#FBF7F0]">
            ← Volver al listado
          </Link>
        </div>
      </div>

      {/* Conflict banner */}
      {conflict && (
        <div className="mx-4 mt-3 rounded border border-[#9B7E5F] bg-[#0F2A30] p-3 text-[#9B7E5F] shrink-0">
          <p className="font-medium">Conflicto de versión</p>
          <p className="mt-1 text-sm">
            Otro usuario modificó esta oportunidad (versión actual: {conflict.currentVersion},
            tu versión: {conflict.providedVersion}). Recarga para ver los cambios más recientes.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded bg-[#7FA88C] px-3 py-1.5 text-sm font-medium text-[#08191C] hover:bg-[#5C8D7A]"
          >
            Recargar página
          </button>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="mx-4 mt-3 rounded border border-[#9B7E5F] bg-[#0F2A30] p-3 text-[#9B7E5F] shrink-0">
          {saveError}
          <button
            onClick={() => setSaveError(null)}
            className="ml-3 text-sm text-[#FBF7F0] hover:underline"
            aria-label="Cerrar error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Mobile section selector */}
      <div className="md:hidden shrink-0 px-4 pt-3">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex w-full items-center justify-between rounded border border-[#1A3E48] bg-[#0F2A30] px-4 py-2.5 text-[#FBF7F0]"
          aria-expanded={mobileMenuOpen}
        >
          <span className="flex items-center gap-2">
            {SECTIONS.find((s) => s.key === activeSection)?.label || 'Sección'}
            {sectionErrors[activeSection] && (
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-label="Errores en esta sección" />
            )}
          </span>
          <span className={`transform transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {mobileMenuOpen && (
          <div className="mt-1 rounded border border-[#1A3E48] bg-[#0F2A30] shadow-lg">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => handleSectionChange(s.key)}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                  activeSection === s.key
                    ? 'bg-[#1A3E48] text-[#7FA88C] border-l-2 border-l-[#7FA88C]'
                    : 'text-[#9B7E5F] hover:bg-[#1A3E48] hover:text-[#FBF7F0]'
                }`}
              >
                {s.label}
                {sectionErrors[s.key] && (
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500 flex-shrink-0" aria-label="Errores" />
                )}
                {isSectionDirty(s) && (
                  <span className="text-xs text-[#7FA88C] ml-auto" aria-label="Modificado">●</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-60 md:flex-col md:shrink-0 border-r border-[#1A3E48] bg-[#0F2A30] overflow-y-auto">
          <nav className="py-2" aria-label="Secciones del editor">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => handleSectionChange(s.key)}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors border-l-2 ${
                  activeSection === s.key
                    ? 'border-l-[#7FA88C] bg-[#1A3E48] text-[#7FA88C]'
                    : 'border-l-transparent text-[#9B7E5F] hover:bg-[#1A3E48] hover:text-[#FBF7F0]'
                }`}
              >
                <span className="flex-1">{s.label}</span>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  {sectionErrors[s.key] && (
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-label="Errores en esta sección" />
                  )}
                  {isSectionDirty(s) && (
                    <span className="text-xs text-[#7FA88C]" aria-label="Cambios sin guardar">●</span>
                  )}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Content panel */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto p-6" ref={activeSectionRef}>
            {/* General */}
            {activeSection === 'general' && (
              <div className="space-y-5 max-w-2xl">
                <h3 className="font-serif text-lg text-[#7FA88C]">Información general</h3>
                <label className="block">
                  <span className="text-sm text-[#9B7E5F]">Título *</span>
                  <input
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                    className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    placeholder="Nombre de la oportunidad"
                  />
                  {showValidation && validationErrors.general?.map((e, i) => (
                    <p key={i} className="mt-1 text-xs text-red-400">{e}</p>
                  ))}
                </label>
                <label className="block">
                  <span className="text-sm text-[#9B7E5F]">Slug</span>
                  <input
                    value={form.slug}
                    onChange={(e) => setField('slug', e.target.value)}
                    className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C] font-mono text-sm"
                    placeholder="nombre-de-la-oportunidad"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-[#9B7E5F]">Descripción breve</span>
                  <textarea
                    value={form.shortDescription}
                    onChange={(e) => setField('shortDescription', e.target.value)}
                    rows={2}
                    className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    placeholder="Resumen de una o dos líneas"
                  />
                </label>
              </div>
            )}

            {/* Location */}
            {activeSection === 'location' && (
              <div className="space-y-5 max-w-2xl">
                <h3 className="font-serif text-lg text-[#7FA88C]">Localización</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Ciudad *</span>
                    <input
                      value={form.city}
                      onChange={(e) => setField('city', e.target.value)}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                      placeholder="Madrid"
                    />
                    {showValidation && validationErrors.location?.map((e, i) => (
                      <p key={i} className="mt-1 text-xs text-red-400">{e}</p>
                    ))}
                  </label>
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Código país *</span>
                    <input
                      value={form.countryCode}
                      onChange={(e) => setField('countryCode', e.target.value.toUpperCase())}
                      maxLength={2}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C] uppercase"
                      placeholder="ES"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm text-[#9B7E5F]">Distrito</span>
                  <input
                    value={form.district}
                    onChange={(e) => setField('district', e.target.value)}
                    className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    placeholder="Salamanca"
                  />
                </label>
              </div>
            )}

            {/* Asset + Strategy */}
            {activeSection === 'assetStrategy' && (
              <div className="space-y-5 max-w-2xl">
                <h3 className="font-serif text-lg text-[#7FA88C]">Tipo de activo y estrategia</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Tipo de activo *</span>
                    <input
                      value={form.assetType}
                      onChange={(e) => setField('assetType', e.target.value)}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                      placeholder="Residencial, Comercial, etc."
                    />
                    {showValidation && validationErrors.assetStrategy?.map((e, i) => (
                      <p key={i} className="mt-1 text-xs text-red-400">{e}</p>
                    ))}
                  </label>
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Estrategia *</span>
                    <input
                      value={form.strategy}
                      onChange={(e) => setField('strategy', e.target.value)}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                      placeholder="Compra-reforma-venta, Alquiler, etc."
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Status + Visibility */}
            {activeSection === 'statusVisibility' && (
              <div className="space-y-5 max-w-2xl">
                <h3 className="font-serif text-lg text-[#7FA88C]">Estado y visibilidad</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Estado editorial *</span>
                    <select
                      value={form.editorialStatus}
                      onChange={(e) => setField('editorialStatus', e.target.value)}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    >
                      <option value="draft">Borrador</option>
                      <option value="review">En revisión</option>
                      <option value="published">Publicado</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Visibilidad *</span>
                    <select
                      value={form.visibility}
                      onChange={(e) => setField('visibility', e.target.value)}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    >
                      <option value="private">Privado</option>
                      <option value="public">Público</option>
                      <option value="unlisted">No listado</option>
                      <option value="draft">Borrador</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Estado comercial *</span>
                    <select
                      value={form.status}
                      onChange={(e) => setField('status', e.target.value)}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    >
                      <option value="coming_soon">Próximamente</option>
                      <option value="open">Abierto</option>
                      <option value="funding">Financiación</option>
                      <option value="funded">Financiado</option>
                      <option value="in_execution">En ejecución</option>
                      <option value="commercializing">Comercializando</option>
                      <option value="closed">Cerrado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </label>
                </div>
                {showValidation && validationErrors.statusVisibility?.map((e, i) => (
                  <p key={i} className="text-xs text-red-400">{e}</p>
                ))}
              </div>
            )}

            {/* Financials */}
            {activeSection === 'financials' && (
              <div className="space-y-5 max-w-2xl">
                <h3 className="font-serif text-lg text-[#7FA88C]">Métricas financieras</h3>
                <p className="text-xs text-[#5C8D7A]">
                  Los importes se introducen en euros y se convierten a céntimos. Los porcentajes se convierten a basis points.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Capital objetivo (€) *</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.targetAmountCents ? CENTS_TO_EUR(form.targetAmountCents) : '0.00'}
                      onChange={(e) => setField('targetAmountCents', EUR_TO_CENTS(parseFloat(e.target.value) || 0))}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Capital comprometido (€)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.committedAmountCents ? CENTS_TO_EUR(form.committedAmountCents) : '0.00'}
                      onChange={(e) => setField('committedAmountCents', EUR_TO_CENTS(parseFloat(e.target.value) || 0))}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Ticket mínimo (€) *</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.minimumInvestmentCents ? CENTS_TO_EUR(form.minimumInvestmentCents) : '0.00'}
                      onChange={(e) => setField('minimumInvestmentCents', EUR_TO_CENTS(parseFloat(e.target.value) || 0))}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Plazo estimado (meses) *</span>
                    <input
                      type="number"
                      min="1"
                      max="360"
                      value={form.estimatedTermMonths || 12}
                      onChange={(e) => setField('estimatedTermMonths', parseInt(e.target.value) || 0)}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Tipo de retorno</span>
                    <select
                      value={form.targetReturnType}
                      onChange={(e) => setField('targetReturnType', e.target.value)}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    >
                      <option value="">Sin especificar</option>
                      <option value="target_annual_return">Retorno anual objetivo</option>
                      <option value="target_total_return">Retorno total objetivo</option>
                      <option value="target_irr">TIR objetivo</option>
                      <option value="target_roi">ROI objetivo</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Retorno objetivo (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      step="0.01"
                      value={form.targetReturnBps ? BPS_TO_PCT(form.targetReturnBps) : ''}
                      onChange={(e) => setField('targetReturnBps', PCT_TO_BPS(parseFloat(e.target.value) || 0))}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm text-[#9B7E5F]">Moneda</span>
                  <input
                    value={form.currency}
                    onChange={(e) => setField('currency', e.target.value.toUpperCase())}
                    maxLength={3}
                    className="mt-1 block w-24 rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C] uppercase"
                  />
                </label>
                <hr className="border-[#1A3E48]" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Nivel de riesgo</span>
                    <select
                      value={form.riskLevel}
                      onChange={(e) => setField('riskLevel', e.target.value)}
                      className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    >
                      <option value="low">Bajo</option>
                      <option value="medium">Medio</option>
                      <option value="high">Alto</option>
                      <option value="very_high">Muy alto</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm text-[#9B7E5F]">Fecha de cierre</span>
                    <input
                      type="date"
                      value={form.closingDate}
                      onChange={(e) => setField('closingDate', e.target.value)}
                      className="mt-1 block rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    />
                  </label>
                </div>
                {showValidation && validationErrors.financials?.map((e, i) => (
                  <p key={i} className="text-xs text-red-400">{e}</p>
                ))}
              </div>
            )}

            {/* Description */}
            {activeSection === 'description' && (
              <div className="space-y-5 max-w-2xl">
                <h3 className="font-serif text-lg text-[#7FA88C]">Descripción y tesis</h3>
                <label className="block">
                  <span className="text-sm text-[#9B7E5F]">Descripción *</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    rows={8}
                    className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    placeholder="Describe la tesis de inversión, el activo, la ubicación y los fundamentos de la oportunidad."
                  />
                  {showValidation && validationErrors.description?.map((e, i) => (
                    <p key={i} className="mt-1 text-xs text-red-400">{e}</p>
                  ))}
                </label>
                <label className="block">
                  <span className="text-sm text-[#9B7E5F]">Disclaimer legal</span>
                  <textarea
                    value={form.disclaimer}
                    onChange={(e) => setField('disclaimer', e.target.value)}
                    rows={3}
                    className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-sm text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
                    placeholder="Texto legal opcional que se mostrará al pie de la página de la oportunidad."
                  />
                </label>
              </div>
            )}

            {/* Highlights */}
            {activeSection === 'highlights' && (
              <div className="max-w-2xl">
                <HighlightsEditor items={highlights} onChange={setHighlights} />
              </div>
            )}

            {/* Risks */}
            {activeSection === 'risks' && (
              <div className="max-w-2xl">
                <RisksEditor items={risks} onChange={setRisks} />
                {showValidation && validationErrors.risks?.map((e, i) => (
                  <p key={i} className="mt-2 text-xs text-red-400">{e}</p>
                ))}
              </div>
            )}

            {/* Milestones */}
            {activeSection === 'milestones' && (
              <div className="max-w-2xl">
                <MilestonesEditor items={milestones} onChange={setMilestones} />
              </div>
            )}

            {/* Media */}
            {activeSection === 'media' && (
              <div className="max-w-2xl">
                <MediaEditor items={media} onChange={setMedia} />
                {showValidation && validationErrors.media?.map((e, i) => (
                  <p key={i} className="mt-2 text-xs text-red-400">{e}</p>
                ))}
              </div>
            )}

            {/* Review + Publish */}
            {activeSection === 'review' && (
              <div className="space-y-8 max-w-2xl">
                <h3 className="font-serif text-lg text-[#7FA88C]">Revisión y publicación</h3>

                {/* Validation summary */}
                <div className="rounded border border-[#1A3E48] bg-[#0F2A30] p-5">
                  <h4 className="font-medium text-[#FBF7F0] mb-3">Resumen de validación</h4>
                  {(() => {
                    const missing = getMissingFields(form, highlights, risks, media);
                    if (missing.length === 0) {
                      return (
                        <div className="flex items-center gap-2 text-[#7FA88C]">
                          <span>✓</span>
                          <span className="text-sm">Todos los campos requeridos están completos.</span>
                        </div>
                      );
                    }
                    return (
                      <div>
                        <p className="text-sm text-[#9B7E5F] mb-2">Campos pendientes:</p>
                        <ul className="space-y-1">
                          {missing.map((field) => (
                            <li key={field} className="flex items-center gap-2 text-sm text-red-400">
                              <span>✗</span> {field}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </div>

                {/* Checklist */}
                <div className="rounded border border-[#1A3E48] bg-[#0F2A30] p-5">
                  <h4 className="font-medium text-[#FBF7F0] mb-3">Checklist de publicación</h4>
                  <ul className="space-y-3">
                    {[
                      { label: 'Título y descripción completos', ok: !!form.title.trim() && !!form.description.trim() },
                      { label: 'Localización definida', ok: !!form.city.trim() && !!form.countryCode.trim() },
                      { label: 'Activo y estrategia definidos', ok: !!form.assetType.trim() && !!form.strategy.trim() },
                      { label: 'Métricas financieras completas', ok: form.targetAmountCents > 0 && form.minimumInvestmentCents > 0 },
                      { label: 'Highlights añadidos', ok: highlights.length > 0 },
                      { label: 'Al menos 1 riesgo identificado', ok: risks.length > 0 },
                      { label: 'Al menos 1 imagen', ok: media.length > 0 },
                      { label: 'Al menos 1 hito definido', ok: milestones.length > 0 },
                    ].map((item) => (
                      <li key={item.label} className="flex items-center gap-2 text-sm">
                        <span className={item.ok ? 'text-[#7FA88C]' : 'text-[#9B7E5F]'}>
                          {item.ok ? '✓' : '○'}
                        </span>
                        <span className={item.ok ? 'text-[#FBF7F0]' : 'text-[#9B7E5F]'}>
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Counts summary */}
                <div className="grid gap-3 sm:grid-cols-4 text-center">
                  {[
                    { label: 'Highlights', count: highlights.length },
                    { label: 'Riesgos', count: risks.length },
                    { label: 'Hitos', count: milestones.length },
                    { label: 'Imágenes', count: media.length },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded border border-[#1A3E48] bg-[#0F2A30] p-3">
                      <p className="text-2xl font-medium text-[#FBF7F0]">{stat.count}</p>
                      <p className="text-xs text-[#9B7E5F]">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  {canPublish && (
                    <button
                      onClick={handleSendToReview}
                      disabled={reviewMutation.isPending || isNew}
                      className="rounded border border-[#7FA88C] px-5 py-2.5 text-sm font-medium text-[#7FA88C] hover:bg-[#1A3E48] disabled:opacity-50 focus:outline-2 focus:outline-[#7FA88C]"
                    >
                      {reviewMutation.isPending ? 'Enviando…' : 'Enviar a revisión'}
                    </button>
                  )}
                  {canPublish && (
                    <button
                      onClick={handlePublish}
                      disabled={isPublishing || isNew}
                      className="rounded bg-[#7FA88C] px-5 py-2.5 text-sm font-medium text-[#08191C] hover:bg-[#5C8D7A] disabled:opacity-50 focus:outline-2 focus:outline-[#7FA88C]"
                    >
                      {isPublishing ? 'Publicando…' : 'Publicar'}
                    </button>
                  )}
                  {!canPublish && (
                    <p className="text-sm text-[#9B7E5F]">
                      Solo administradores y operadores pueden publicar.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sticky bottom bar */}
          <div className="shrink-0 border-t border-[#1A3E48] bg-[#0F2A30] px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving || (!dirty && !isNew)}
                  className="rounded bg-[#7FA88C] px-6 py-2 font-medium text-[#08191C] hover:bg-[#5C8D7A] disabled:opacity-50 focus:outline-2 focus:outline-[#7FA88C] transition-colors"
                >
                  {isSaving ? 'Guardando…' : isNew ? 'Crear borrador' : 'Guardar cambios'}
                </button>
                {dirty && (
                  <span className="text-sm text-[#9B7E5F]" aria-live="polite">
                    Cambios sin guardar
                  </span>
                )}
                {saveStatus && !isSaving && (
                  <span className="text-sm text-[#7FA88C]" aria-live="polite">
                    {saveStatus}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-[#5C8D7A]">
                {lastSaved && <span>Guardado: {lastSaved}</span>}
                <span>Versión {form.version || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
