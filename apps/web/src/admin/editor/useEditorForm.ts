/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { apiFetch } from '../../api/client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  type HighlightItem,
  type RiskItem,
  type MilestoneItem,
  type MediaItem,
} from '../SubEntityEditors';
import { eurToCents, centsToEur, bpsToPct, pctToBps } from './finance';

// ── Types ──
export interface OppFull {
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

export interface FormState {
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

export const EMPTY_FORM: FormState = {
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
export interface SectionDef {
  key: string;
  label: string;
  fields: (keyof FormState)[];
  isSubentity: boolean;
}

export const SECTIONS: SectionDef[] = [
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
export function oppToForm(opp: OppFull): FormState {
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

export function formToApiPayload(form: FormState): Record<string, any> {
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
export interface ValidationErrors {
  [key: string]: string[];
}

export function validateSection(
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

export function getMissingFields(form: FormState, highlights: HighlightItem[], risks: RiskItem[], media: MediaItem[]): string[] {
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

// ── Hook return type ──
export interface UseEditorFormReturn {
  // Core form
  form: FormState;
  setField: (field: keyof FormState, value: any) => void;
  dirty: boolean;
  version: number;

  // Save
  save: () => Promise<void>;
  isSaving: boolean;
  lastSavedAt: string | null;
  conflict: { currentVersion: number; providedVersion: number } | null;
  saveError: string | null;
  saveStatus: string;
  clearSaveError: () => void;

  // Subentity state
  highlights: HighlightItem[];
  setHighlights: (items: HighlightItem[]) => void;
  risks: RiskItem[];
  setRisks: (items: RiskItem[]) => void;
  milestones: MilestoneItem[];
  setMilestones: (items: MilestoneItem[]) => void;
  media: MediaItem[];
  setMedia: (items: MediaItem[]) => void;

  // Publish / review
  publish: () => void;
  sendToReview: () => void;
  isPublishing: boolean;
  isSendingReview: boolean;
  canPublish: boolean;

  // Navigation
  activeSection: string;
  setActiveSection: (key: string) => void;
  handleSectionChange: (key: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  sectionErrors: Record<string, boolean>;
  isSectionDirty: (section: SectionDef) => boolean;

  // Validation
  validationErrors: ValidationErrors;
  showValidation: boolean;

  // Loading
  isLoading: boolean;
  error: boolean;
  isNew: boolean;
  id: string | undefined;

  // ref
  activeSectionRef: React.RefObject<HTMLDivElement | null>;

  // Subentity counts for review
  subEntityCounts: { highlights: number; risks: number; milestones: number; media: number };
}

export function useEditorForm(): UseEditorFormReturn {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const save = useCallback(async () => {
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
  }, [isNew, createMutation, saveMutation, subentityMutation]);

  function handlePublish() {
    setSaveError(null);
    setShowValidation(true);

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
      const firstErrorSection = SECTIONS.find((s) => allErrors[s.key]?.length > 0);
      if (firstErrorSection) {
        setActiveSection(firstErrorSection.key);
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

  const isSaving = saveMutation.isPending || createMutation.isPending || subentityMutation.isPending;
  const isPublishing = publishMutation.isPending;
  // Backend endpoints are the RBAC source of truth. Better Auth session data
  // does not carry the local app_users role, so do not hide publish/review
  // actions from valid admins based on incomplete client state.
  const canPublish = true;

  const subEntityCounts = useMemo(() => ({
    highlights: highlights.length,
    risks: risks.length,
    milestones: milestones.length,
    media: media.length,
  }), [highlights, risks, milestones, media]);

  return {
    // Core form
    form,
    setField,
    dirty,
    version: form.version,

    // Save
    save,
    isSaving,
    lastSavedAt: lastSaved,
    conflict,
    saveError,
    saveStatus,
    clearSaveError: () => setSaveError(null),

    // Subentity state
    highlights,
    setHighlights,
    risks,
    setRisks,
    milestones,
    setMilestones,
    media,
    setMedia,

    // Publish / review
    publish: handlePublish,
    sendToReview: handleSendToReview,
    isPublishing,
    isSendingReview: reviewMutation.isPending,
    canPublish,

    // Navigation
    activeSection,
    setActiveSection,
    handleSectionChange,
    mobileMenuOpen,
    setMobileMenuOpen,
    sectionErrors,
    isSectionDirty,

    // Validation
    validationErrors,
    showValidation,

    // Loading
    isLoading: isLoading && !isNew,
    error: !!error && !isNew,
    isNew,
    id,

    // ref
    activeSectionRef,

    // Subentity counts
    subEntityCounts,
  };
}

// Re-export conversion utilities for convenience
export { eurToCents, centsToEur, bpsToPct, pctToBps };
