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
    image: { url: '/images/plaza-america.jpg', altText: 'Fachada del edificio en Plaza América, Vigo' },
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
    shortDescription: 'Promoción residencial de 25 viviendas en Castrelos, Vigo, actualmente en fase de estudio y anteproyecto, con una superficie aproximada de 2.900 m².',
    description: 'Proyecto de promoción residencial de 25 viviendas en la zona de Castrelos, Vigo. La operación se encuentra en fase de estudio y anteproyecto, con una superficie aproximada de 2.900 m² y análisis en curso de viabilidad urbanística, técnica y financiera.',
    city: 'Vigo',
    countryCode: 'ES',
    district: 'Castrelos',
    assetType: 'Residencial',
    strategy: 'Promoción residencial',
    status: 'in_study',
    visibility: 'public',
    currency: 'EUR',
    targetAmountCents: 200000000,
    committedAmountCents: 0,
    minimumInvestmentCents: 500000,
    estimatedTermMonths: 42,
    targetReturnType: 'target_annual_return',
    targetReturnBps: 700,
    riskLevel: 'medium',
    closingDate: null,
    publishedAt: '2026-06-15T08:00:00Z',
    image: { url: '/images/opportunity-patio.webp', altText: 'Imagen provisional. Proyecto residencial de veinticinco viviendas en Castrelos, Vigo' },
    highlights: [
      { label: 'Viviendas previstas', value: '25 unidades' },
      { label: 'Superficie aproximada', value: '2.900 m²' },
      { label: 'Estado', value: 'Estudio y anteproyecto' }
    ],
    risks: [
      { title: 'Riesgo urbanístico', description: 'La operación está en fase de anteproyecto y depende de la validación urbanística y técnica del desarrollo previsto.' },
      { title: 'Riesgo de costes y ejecución', description: 'Los costes de construcción, plazos de obra y disponibilidad de proveedores pueden variar durante la definición del proyecto.' },
      { title: 'Riesgo comercial', description: 'La velocidad de comercialización dependerá de la demanda residencial en Vigo y de las condiciones de mercado durante el periodo de ejecución.' }
    ],
    milestones: [
      { title: 'Cierre del anteproyecto', description: 'Definición preliminar del programa residencial y encaje técnico de las 25 viviendas.', plannedDate: '2026-09-30', completedAt: null },
      { title: 'Validación urbanística', description: 'Revisión de criterios urbanísticos y técnicos antes de avanzar a fases posteriores.', plannedDate: '2026-12-31', completedAt: null },
      { title: 'Estructuración de la operación', description: 'Preparación de documentación, presupuesto y condiciones de inversión.', plannedDate: '2027-03-31', completedAt: null },
      { title: 'Inicio estimado de ejecución', description: 'Arranque previsto de la fase de ejecución si se cumplen las condiciones previas.', plannedDate: '2027-06-30', completedAt: null }
    ]
  },
  {
    slug: 'cambio-uso-hostal-maria-berdiales-vigo',
    title: 'Cambio de uso en María Berdiales',
    shortDescription: 'Proyecto de cambio de uso de viviendas a hostal con 10 apartamentos en María Berdiales, Vigo. La operación está en estudio y cuenta con 800.000€ ya comprometidos sobre un capital objetivo de 1,1M€.',
    description: 'Proyecto de transformación de un inmueble actualmente destinado a viviendas en un hostal con 10 apartamentos en la zona de María Berdiales, Vigo. La operación se encuentra en fase de estudio, con análisis de cambio de uso, adecuación normativa, obra y modelo de explotación.',
    city: 'Vigo',
    countryCode: 'ES',
    district: 'María Berdiales',
    assetType: 'Alojamiento',
    strategy: 'Cambio de uso a hostal',
    status: 'in_study',
    visibility: 'public',
    currency: 'EUR',
    targetAmountCents: 110000000,
    committedAmountCents: 80000000,
    minimumInvestmentCents: 1000000,
    estimatedTermMonths: 38,
    targetReturnType: 'target_annual_return',
    targetReturnBps: null,
    riskLevel: 'medium',
    closingDate: null,
    publishedAt: '2026-06-14T08:00:00Z',
    image: { url: '/images/opportunity-rehabilitacion.webp', altText: 'Imagen provisional. Edificio objeto de estudio para cambio de uso a hostal en María Berdiales, Vigo' },
    highlights: [
      { label: 'Uso previsto', value: 'Hostal con 10 apartamentos' },
      { label: 'Capital comprometido', value: '800.000€ de 1,1M€' },
      { label: 'Fase', value: 'Estudio de cambio de uso' }
    ],
    risks: [
      { title: 'Riesgo de cambio de uso', description: 'La viabilidad depende de la compatibilidad urbanística, licencias y requisitos normativos para el uso previsto.' },
      { title: 'Riesgo de adecuación y obra', description: 'La transformación del inmueble puede requerir ajustes técnicos, licencias, costes adicionales o cambios en el alcance de obra.' },
      { title: 'Riesgo de explotación', description: 'El rendimiento dependerá de la ocupación, la demanda local y la gestión operativa del alojamiento una vez finalizado.' }
    ],
    milestones: [
      { title: 'Estudio de cambio de uso', description: 'Análisis urbanístico y normativo del paso de viviendas a alojamiento tipo hostal.', plannedDate: '2026-09-30', completedAt: null },
      { title: 'Anteproyecto de adecuación', description: 'Definición preliminar de distribución, alcance técnico y necesidades de obra.', plannedDate: '2026-12-31', completedAt: null },
      { title: 'Estructuración financiera', description: 'Revisión del capital comprometido, capital pendiente y condiciones de participación.', plannedDate: '2027-03-31', completedAt: null },
      { title: 'Inicio estimado de adecuación', description: 'Arranque previsto de trabajos si se validan licencias, presupuesto y documentación.', plannedDate: '2027-06-30', completedAt: null }
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
