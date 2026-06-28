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
  publicInvestmentAmount: { cents: 53000000, currency: 'EUR', formatted: '530.000 €' },
  minimumInvestment: { cents: 1500000, currency: 'EUR', formatted: '15.000 €' },
  estimatedTermMonths: 18,
  publicReturnDisplay: '12,3% +50%*',
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
  fundingProgress: 0,
  publicReturnDisplay: '15,8% +50%*',
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
    projectTotalAmount: { cents: 68000000, currency: 'EUR', formatted: '680.000 €' },
    bankFinancingAmount: { cents: 15000000, currency: 'EUR', formatted: '150.000 €' },
    closingDate: '2026-10-15',
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
