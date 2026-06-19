export const disclaimer = 'Datos ilustrativos de demostración. Los objetivos no están garantizados y no constituyen una oferta de inversión.';

export const opportunitySummary = {
  slug: 'eixample-rehabilitacion-luminosa',
  title: 'Rehabilitación luminosa en Eixample',
  shortDescription: 'Activo demo público servido desde PostgreSQL.',
  city: 'Barcelona',
  countryCode: 'ES',
  district: 'Eixample',
  assetType: 'Residencial urbano',
  strategy: 'Rehabilitación energética',
  status: 'funding',
  currency: 'EUR',
  targetAmount: { cents: 125000000, currency: 'EUR', formatted: '1.250.000 €' },
  committedAmount: { cents: 53000000, currency: 'EUR', formatted: '530.000 €' },
  projectTotalAmount: { cents: 68000000, currency: 'EUR', formatted: '680.000 €' },
  bankFinancingAmount: { cents: 15000000, currency: 'EUR', formatted: '150.000 €' },
  minimumInvestment: { cents: 1500000, currency: 'EUR', formatted: '15.000 €' },
  estimatedTermMonths: 18,
  targetReturnType: 'target_annual_return',
  targetReturn: { basisPoints: 820, decimal: 0.082, formatted: '8,2%' },
  riskLevel: 'medium',
  closingDate: '2026-10-15',
  publishedAt: '2026-06-01T08:00:00.000Z',
  fundingProgress: 42.4,
  primaryImage: { type: 'image', url: '/images/opportunity-rehabilitacion.webp', altText: 'Patio rehabilitado demo', position: 0 },
  disclaimer
} as const;

export const secondOpportunitySummary = {
  ...opportunitySummary,
  slug: 'valencia-logistica-ligera',
  title: 'Logística ligera en Valencia',
  city: 'Valencia',
  district: 'Riba-roja',
  assetType: 'Logístico',
  strategy: 'Reposicionamiento',
  status: 'open',
  riskLevel: 'high',
  committedAmount: { cents: 0, currency: 'EUR', formatted: '0 €' },
  fundingProgress: 0,
  targetReturnType: 'target_irr',
  targetReturn: { basisPoints: 1050, decimal: 0.105, formatted: '10,5%' },
  closingDate: null,
  primaryImage: { type: 'image', url: '/images/opportunity-logistica.webp', altText: 'Nave logística demo', position: 0 }
} as const;

export const opportunitiesResponse = {
  data: [opportunitySummary, secondOpportunitySummary],
  pagination: { limit: 6, offset: 0, total: 2, hasMore: false },
  meta: { disclaimer, allowedSorts: ['publishedAt', 'closingDate', 'fundingProgress', 'minimumInvestment', 'targetAmount'] }
};

export const opportunityDetailResponse = {
  data: {
    ...opportunitySummary,
    description: 'Descripción pública demo con contexto urbano y alcance de la rehabilitación. No contiene documentos privados ni información de inversores.',
    highlights: [
      { label: 'Ubicación', value: 'Eje consolidado con demanda residencial', position: 0 },
      { label: 'Plan técnico', value: 'Mejora energética y redistribución interior', position: 1 }
    ],
    risks: [
      { title: 'Riesgo de ejecución', description: 'Los plazos de obra pueden variar por licencias o suministros.', position: 0 },
      { title: 'Riesgo comercial', description: 'La demanda prevista puede cambiar durante el periodo de comercialización.', position: 1 }
    ],
    milestones: [
      { title: 'Due diligence técnica', description: 'Revisión documental y técnica del activo.', plannedDate: '2026-07-01', completedAt: null, position: 0 },
      { title: 'Inicio de obra', description: 'Arranque planificado de trabajos.', plannedDate: '2026-09-01', completedAt: null, position: 1 }
    ],
    media: [
      { type: 'image', url: '/images/opportunity-rehabilitacion.webp', altText: 'Patio rehabilitado demo', position: 0 }
    ]
  },
  meta: { disclaimer }
};
