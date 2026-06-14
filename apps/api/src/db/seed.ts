import type { Pool, PoolClient } from 'pg';
import { createPool } from './pool.js';

type SeedOpportunity = {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  city: string;
  countryCode: string;
  district: string;
  assetType: string;
  strategy: string;
  status: string;
  visibility: string;
  currency: string;
  targetAmountCents: number;
  committedAmountCents: number;
  minimumInvestmentCents: number;
  estimatedTermMonths: number;
  targetReturnType: string;
  targetReturnBps: number | null;
  riskLevel: string;
  closingDate: string | null;
  publishedAt: string | null;
  image: { url: string; altText: string };
  highlights: Array<{ label: string; value: string }>;
  risks: Array<{ title: string; description: string }>;
  milestones: Array<{ title: string; description: string; plannedDate: string | null; completedAt?: string | null }>;
};

export const DEMO_OPPORTUNITY_DISCLAIMER = 'Datos ilustrativos de demostración. Los objetivos no están garantizados y no constituyen una oferta de inversión.';

export const seedOpportunities: SeedOpportunity[] = [
  {
    slug: 'eixample-rehabilitacion-luminosa',
    title: 'Rehabilitación luminosa en Eixample',
    shortDescription: 'Activo residencial ficticio con mejora de eficiencia y reposicionamiento comercial.',
    description: 'Oportunidad demo diseñada para validar el catálogo público de MILLENNIALS CONSTRUYEN | CAPITAL. Incluye hipótesis de rehabilitación, comercialización y seguimiento documental sin constituir oferta de inversión.',
    city: 'Barcelona',
    countryCode: 'ES',
    district: 'Eixample',
    assetType: 'Residencial urbano',
    strategy: 'Rehabilitación energética',
    status: 'funding',
    visibility: 'public',
    currency: 'EUR',
    targetAmountCents: 125000000,
    committedAmountCents: 53000000,
    minimumInvestmentCents: 1500000,
    estimatedTermMonths: 18,
    targetReturnType: 'target_annual_return',
    targetReturnBps: 820,
    riskLevel: 'medium',
    closingDate: '2026-10-15',
    publishedAt: '2026-06-01T08:00:00Z',
    image: { url: '/images/opportunity-rehabilitacion.webp', altText: 'Composición arquitectónica generada para una rehabilitación residencial demo en Barcelona' },
    highlights: [
      { label: 'Uso', value: 'Residencial con mejora energética' },
      { label: 'Documentación', value: 'Paquete técnico en preparación' },
      { label: 'Seguimiento', value: 'Hitos mensuales previstos' }
    ],
    risks: [
      { title: 'Riesgo de obra', description: 'El calendario podría variar por disponibilidad de contratistas o licencias.' },
      { title: 'Riesgo comercial', description: 'La absorción final depende de demanda y condiciones de mercado.' }
    ],
    milestones: [
      { title: 'Due diligence técnica', description: 'Revisión del estado del activo y alcance de intervención.', plannedDate: '2026-07-01', completedAt: null },
      { title: 'Inicio de obra', description: 'Arranque previsto de trabajos de mejora.', plannedDate: '2026-09-01', completedAt: null }
    ]
  },
  {
    slug: 'malaga-patio-productivo',
    title: 'Patio productivo en Málaga Este',
    shortDescription: 'Proyecto demo de reposicionamiento de activo mixto con patio y usos flexibles.',
    description: 'Caso ficticio para mostrar estados, riesgos y métricas públicas. Los importes son ilustrativos y no representan una captación real.',
    city: 'Málaga',
    countryCode: 'ES',
    district: 'Málaga Este',
    assetType: 'Mixto urbano',
    strategy: 'Reposicionamiento operativo',
    status: 'open',
    visibility: 'public',
    currency: 'EUR',
    targetAmountCents: 88000000,
    committedAmountCents: 17600000,
    minimumInvestmentCents: 1000000,
    estimatedTermMonths: 14,
    targetReturnType: 'target_total_return',
    targetReturnBps: 1050,
    riskLevel: 'medium',
    closingDate: '2026-09-20',
    publishedAt: '2026-06-05T08:00:00Z',
    image: { url: '/images/opportunity-patio.webp', altText: 'Composición arquitectónica generada para un activo con patio demo en Málaga' },
    highlights: [
      { label: 'Estrategia', value: 'Flexibilización de uso y mejora de patio' },
      { label: 'Estado', value: 'Abierta en demo pública' }
    ],
    risks: [
      { title: 'Riesgo de demanda', description: 'Los usos previstos podrían requerir ajustes si cambia la demanda local.' }
    ],
    milestones: [
      { title: 'Validación comercial', description: 'Contraste de usos y demanda potencial.', plannedDate: '2026-07-20', completedAt: null }
    ]
  },
  {
    slug: 'valencia-cambio-uso-controlado',
    title: 'Cambio de uso controlado en Valencia',
    shortDescription: 'Oportunidad ficticia con estrategia de cambio de uso y calendario regulatorio visible.',
    description: 'Proyecto demo para representar oportunidades con riesgo regulatorio superior y avance de financiación parcial.',
    city: 'Valencia',
    countryCode: 'ES',
    district: 'Camins al Grau',
    assetType: 'Terciario adaptable',
    strategy: 'Cambio de uso',
    status: 'coming_soon',
    visibility: 'public',
    currency: 'EUR',
    targetAmountCents: 164000000,
    committedAmountCents: 0,
    minimumInvestmentCents: 2500000,
    estimatedTermMonths: 24,
    targetReturnType: 'target_irr',
    targetReturnBps: 940,
    riskLevel: 'high',
    closingDate: null,
    publishedAt: '2026-06-08T08:00:00Z',
    image: { url: '/images/opportunity-urbano.webp', altText: 'Composición arquitectónica generada para un cambio de uso demo en Valencia' },
    highlights: [
      { label: 'Riesgo principal', value: 'Tramitación y calendario' },
      { label: 'Visibilidad', value: 'Próximamente en demo' }
    ],
    risks: [
      { title: 'Riesgo regulatorio', description: 'La estrategia depende de permisos y validación urbanística.' },
      { title: 'Riesgo de plazo', description: 'El plazo estimado puede variar por tiempos administrativos.' }
    ],
    milestones: [
      { title: 'Consulta urbanística', description: 'Contraste inicial con criterios técnicos.', plannedDate: '2026-08-10', completedAt: null }
    ]
  },
  {
    slug: 'sevilla-corredor-ribera',
    title: 'Corredor Ribera Sevilla',
    shortDescription: 'Activo demo ya financiado para mostrar seguimiento público sin datos privados.',
    description: 'Ficha ficticia de oportunidad financiada, útil para validar estados posteriores sin mostrar documentos ni inversores.',
    city: 'Sevilla',
    countryCode: 'ES',
    district: 'Ribera urbana',
    assetType: 'Residencial compacto',
    strategy: 'Compra y mejora selectiva',
    status: 'funded',
    visibility: 'public',
    currency: 'EUR',
    targetAmountCents: 69000000,
    committedAmountCents: 69000000,
    minimumInvestmentCents: 1000000,
    estimatedTermMonths: 12,
    targetReturnType: 'target_roi',
    targetReturnBps: 760,
    riskLevel: 'low',
    closingDate: '2026-08-01',
    publishedAt: '2026-05-28T08:00:00Z',
    image: { url: '/images/hero-architecture-640.webp', altText: 'Composición arquitectónica generada para una oportunidad demo financiada en Sevilla' },
    highlights: [
      { label: 'Estado', value: 'Financiada en entorno demo' },
      { label: 'Objetivo', value: 'Validar seguimiento posterior' }
    ],
    risks: [
      { title: 'Riesgo operativo', description: 'La ejecución puede desviarse por costes o tiempos de obra.' }
    ],
    milestones: [
      { title: 'Financiación completada', description: 'Hito demo de financiación completa.', plannedDate: '2026-06-15', completedAt: '2026-06-15T10:00:00Z' }
    ]
  },
  {
    slug: 'privada-demo-no-publica',
    title: 'Oportunidad privada demo no pública',
    shortDescription: 'Registro privado para validar exclusión del catálogo público.',
    description: 'Esta oportunidad existe solo para pruebas de visibilidad y no debe aparecer en endpoints públicos.',
    city: 'Madrid',
    countryCode: 'ES',
    district: 'No público',
    assetType: 'Residencial',
    strategy: 'Validación interna',
    status: 'open',
    visibility: 'private',
    currency: 'EUR',
    targetAmountCents: 50000000,
    committedAmountCents: 10000000,
    minimumInvestmentCents: 1000000,
    estimatedTermMonths: 10,
    targetReturnType: 'target_annual_return',
    targetReturnBps: 600,
    riskLevel: 'medium',
    closingDate: null,
    publishedAt: '2026-06-01T08:00:00Z',
    image: { url: '/images/opportunity-rehabilitacion.webp', altText: 'Imagen demo privada no pública' },
    highlights: [{ label: 'Visibilidad', value: 'Privada' }],
    risks: [{ title: 'No público', description: 'Solo prueba de exclusión.' }],
    milestones: []
  }
];

async function upsertOpportunity(client: PoolClient, opportunity: SeedOpportunity) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO opportunities (
      slug, title, short_description, description, city, country_code, district, asset_type, strategy,
      status, visibility, currency, target_amount_cents, committed_amount_cents, minimum_investment_cents,
      estimated_term_months, target_return_type, target_return_bps, risk_level, closing_date, published_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      short_description = EXCLUDED.short_description,
      description = EXCLUDED.description,
      city = EXCLUDED.city,
      country_code = EXCLUDED.country_code,
      district = EXCLUDED.district,
      asset_type = EXCLUDED.asset_type,
      strategy = EXCLUDED.strategy,
      status = EXCLUDED.status,
      visibility = EXCLUDED.visibility,
      currency = EXCLUDED.currency,
      target_amount_cents = EXCLUDED.target_amount_cents,
      committed_amount_cents = EXCLUDED.committed_amount_cents,
      minimum_investment_cents = EXCLUDED.minimum_investment_cents,
      estimated_term_months = EXCLUDED.estimated_term_months,
      target_return_type = EXCLUDED.target_return_type,
      target_return_bps = EXCLUDED.target_return_bps,
      risk_level = EXCLUDED.risk_level,
      closing_date = EXCLUDED.closing_date,
      published_at = EXCLUDED.published_at
    RETURNING id`,
    [
      opportunity.slug, opportunity.title, opportunity.shortDescription, opportunity.description, opportunity.city,
      opportunity.countryCode, opportunity.district, opportunity.assetType, opportunity.strategy, opportunity.status,
      opportunity.visibility, opportunity.currency, opportunity.targetAmountCents, opportunity.committedAmountCents,
      opportunity.minimumInvestmentCents, opportunity.estimatedTermMonths, opportunity.targetReturnType,
      opportunity.targetReturnBps, opportunity.riskLevel, opportunity.closingDate, opportunity.publishedAt
    ]
  );
  const id = result.rows[0].id;

  await client.query('DELETE FROM opportunity_media WHERE opportunity_id = $1', [id]);
  await client.query('DELETE FROM opportunity_highlights WHERE opportunity_id = $1', [id]);
  await client.query('DELETE FROM opportunity_risks WHERE opportunity_id = $1', [id]);
  await client.query('DELETE FROM opportunity_milestones WHERE opportunity_id = $1', [id]);

  await client.query(
    'INSERT INTO opportunity_media (opportunity_id, type, url, alt_text, position) VALUES ($1, $2, $3, $4, $5)',
    [id, 'image', opportunity.image.url, opportunity.image.altText, 0]
  );

  for (const [position, highlight] of opportunity.highlights.entries()) {
    await client.query('INSERT INTO opportunity_highlights (opportunity_id, label, value, position) VALUES ($1, $2, $3, $4)', [id, highlight.label, highlight.value, position]);
  }
  for (const [position, risk] of opportunity.risks.entries()) {
    await client.query('INSERT INTO opportunity_risks (opportunity_id, title, description, position) VALUES ($1, $2, $3, $4)', [id, risk.title, risk.description, position]);
  }
  for (const [position, milestone] of opportunity.milestones.entries()) {
    await client.query('INSERT INTO opportunity_milestones (opportunity_id, title, description, planned_date, completed_at, position) VALUES ($1, $2, $3, $4, $5, $6)', [id, milestone.title, milestone.description, milestone.plannedDate, milestone.completedAt ?? null, position]);
  }
}

export async function runSeed(pool: Pool = createPool()) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const opportunity of seedOpportunities) {
      await upsertOpportunity(client, opportunity);
    }
    await client.query('COMMIT');
    return { upserted: seedOpportunities.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const demoSeedEnabled = (process.env.DEMO_SEED_ENABLED ?? 'false').toLowerCase() === 'true';

  if (!demoSeedEnabled) {
    console.log(JSON.stringify({ status: 'skipped', reason: 'DEMO_SEED_ENABLED is not true — seed only runs in dev/demo environments' }));
    process.exit(0);
  }

  const pool = createPool();
  runSeed(pool)
    .then((result) => console.log(JSON.stringify({ status: 'ok', ...result })))
    .catch((error: unknown) => {
      console.error(JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Seed failed' }));
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
