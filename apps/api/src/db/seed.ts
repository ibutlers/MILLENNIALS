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

export const DEMO_OPPORTUNITY_DISCLAIMER = 'La información publicada tiene carácter informativo y preliminar. Las operaciones en estudio pueden sufrir modificaciones y su publicación no constituye una oferta de inversión.';

export const seedOpportunities: SeedOpportunity[] = [
  {
    slug: 'promocion-9-viviendas-plaza-america-vigo',
    title: 'Promoción de 9 viviendas en Plaza América',
    shortDescription: 'Promoción residencial de un edificio de nueve viviendas en Travesía de la calle Coruña, en la zona de Plaza América, Vigo. La financiación está completamente cubierta y el proyecto se encuentra actualmente en ejecución.',
    description: 'Promoción residencial de nueve viviendas en Travesía de la calle Coruña, en la zona de Plaza América, Vigo. El proyecto cuenta con financiación cerrada y se encuentra en fase de ejecución. Los datos financieros detallados no se publican en esta fase.',
    city: 'Vigo',
    countryCode: 'ES',
    district: 'Travesía de la calle Coruña · Plaza América',
    assetType: 'Residencial',
    strategy: 'Promoción residencial',
    status: 'in_execution',
    visibility: 'public',
    currency: 'EUR',
    targetAmountCents: 1,
    committedAmountCents: 1,
    minimumInvestmentCents: 1,
    estimatedTermMonths: 1,
    targetReturnType: 'target_annual_return',
    targetReturnBps: null,
    riskLevel: 'medium',
    closingDate: null,
    publishedAt: '2026-06-16T08:00:00Z',
    image: { url: '/images/opportunity-urbano.webp', altText: 'Imagen provisional. Promoción residencial de nueve viviendas en la zona de Plaza América, Vigo' },
    highlights: [
      { label: 'Viviendas', value: '9 unidades' },
      { label: 'Ubicación', value: 'Travesía de la calle Coruña · Plaza América' },
      { label: 'Financiación', value: 'Capital cubierto · 100%' }
    ],
    risks: [
      { title: 'Riesgo de ejecución', description: 'El calendario de obra puede verse afectado por disponibilidad de materiales o condiciones meteorológicas.' },
      { title: 'Riesgo de mercado', description: 'La velocidad de comercialización depende de la demanda local en el momento de finalización.' }
    ],
    milestones: [
      { title: 'Financiación cerrada', description: 'Capital completamente cubierto para la ejecución del proyecto.', plannedDate: '2026-03-01', completedAt: '2026-03-01T10:00:00Z' },
      { title: 'Inicio de obra', description: 'Comienzo de los trabajos de construcción.', plannedDate: '2026-04-15', completedAt: '2026-04-15T10:00:00Z' },
      { title: 'Finalización prevista', description: 'Entrega estimada de las viviendas.', plannedDate: '2027-06-30', completedAt: null }
    ]
  },
  {
    slug: 'promocion-25-viviendas-castrelos-vigo',
    title: 'Promoción de 25 viviendas en Castrelos',
    shortDescription: 'Proyecto de promoción residencial de veinticinco viviendas en Castrelos, actualmente en fase de estudio, análisis de viabilidad y definición del proyecto.',
    description: 'Proyecto de promoción residencial de veinticinco viviendas en la zona de Castrelos, Vigo. La operación se encuentra en fase de estudio, con trabajos en curso de análisis de viabilidad urbanística, técnica y financiera, así como definición del anteproyecto.',
    city: 'Vigo',
    countryCode: 'ES',
    district: 'Castrelos',
    assetType: 'Residencial',
    strategy: 'Promoción residencial',
    status: 'in_study',
    visibility: 'public',
    currency: 'EUR',
    targetAmountCents: 1,
    committedAmountCents: 0,
    minimumInvestmentCents: 1,
    estimatedTermMonths: 1,
    targetReturnType: 'target_annual_return',
    targetReturnBps: null,
    riskLevel: 'medium',
    closingDate: null,
    publishedAt: '2026-06-15T08:00:00Z',
    image: { url: '/images/opportunity-patio.webp', altText: 'Imagen provisional. Proyecto residencial de veinticinco viviendas en Castrelos, Vigo' },
    highlights: [
      { label: 'Viviendas', value: '25 unidades' },
      { label: 'Fase', value: 'Estudio y análisis de viabilidad' },
      { label: 'Ubicación', value: 'Castrelos, Vigo' }
    ],
    risks: [
      { title: 'Riesgo de viabilidad', description: 'El proyecto está en fase de estudio y los análisis urbanísticos, técnicos y financieros pueden concluir que no es viable en los términos actuales.' },
      { title: 'Riesgo urbanístico', description: 'La viabilidad depende de la compatibilidad urbanística de la parcela con el programa de viviendas previsto.' }
    ],
    milestones: [
      { title: 'Análisis de viabilidad', description: 'Estudio urbanístico, técnico y financiero del proyecto.', plannedDate: '2026-09-30', completedAt: null },
      { title: 'Definición del anteproyecto', description: 'Elaboración del programa de viviendas y documento preliminar.', plannedDate: '2026-12-31', completedAt: null }
    ]
  },
  {
    slug: 'cambio-uso-hostal-maria-berdiales-vigo',
    title: 'Cambio de uso en María Berdiales',
    shortDescription: 'Proyecto de transformación de un edificio de uso residencial en un establecimiento de alojamiento tipo hostal en María Berdiales, Vigo. La operación se encuentra actualmente en fase de estudio y análisis de viabilidad.',
    description: 'Proyecto de transformación de un edificio de uso residencial en un establecimiento de alojamiento tipo hostal en la zona de María Berdiales, Vigo. La operación contempla el cambio de uso del inmueble y se encuentra en fase de estudio, con análisis de viabilidad urbanística, adecuación normativa y modelo de explotación.',
    city: 'Vigo',
    countryCode: 'ES',
    district: 'María Berdiales',
    assetType: 'Residencial',
    strategy: 'Cambio de uso',
    status: 'in_study',
    visibility: 'public',
    currency: 'EUR',
    targetAmountCents: 1,
    committedAmountCents: 0,
    minimumInvestmentCents: 1,
    estimatedTermMonths: 1,
    targetReturnType: 'target_annual_return',
    targetReturnBps: null,
    riskLevel: 'medium',
    closingDate: null,
    publishedAt: '2026-06-14T08:00:00Z',
    image: { url: '/images/opportunity-rehabilitacion.webp', altText: 'Imagen provisional. Edificio objeto de estudio para cambio de uso a hostal en María Berdiales, Vigo' },
    highlights: [
      { label: 'Uso actual', value: 'Residencial' },
      { label: 'Uso previsto', value: 'Alojamiento tipo hostal' },
      { label: 'Fase', value: 'Estudio y análisis de viabilidad' }
    ],
    risks: [
      { title: 'Riesgo normativo', description: 'El cambio de uso requiere cumplir la normativa urbanística y sectorial de alojamiento turístico.' },
      { title: 'Riesgo de viabilidad', description: 'Los análisis pueden determinar que la operación no es viable en los términos estudiados inicialmente.' }
    ],
    milestones: [
      { title: 'Estudio urbanístico', description: 'Verificación de la compatibilidad urbanística del cambio de uso.', plannedDate: '2026-10-31', completedAt: null },
      { title: 'Análisis de explotación', description: 'Modelo de negocio y proyecciones del establecimiento.', plannedDate: '2026-12-31', completedAt: null }
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
