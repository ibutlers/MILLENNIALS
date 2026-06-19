import type { Pool } from 'pg';
import { DEMO_OPPORTUNITY_DISCLAIMER } from '../db/seed.js';
import { calculateFundingProgress, serializeDate, serializeDateTime, serializeMoney, serializePercentage } from './finance.js';
import type { z } from 'zod';
import { opportunityListQuerySchema } from './schemas.js';

type ListQuery = z.infer<typeof opportunityListQuerySchema>;

type DbOpportunity = {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  description?: string;
  city: string;
  country_code: string;
  district: string | null;
  asset_type: string;
  strategy: string;
  status: string;
  currency: string;
  target_amount_cents: string;
  committed_amount_cents: string;
  project_total_amount_cents: string | null;
  bank_financing_amount_cents: string | null;
  minimum_investment_cents: string;
  estimated_term_months: number;
  target_return_type: string;
  target_return_bps: number | null;
  risk_level: string;
  closing_date: Date | string | null;
  published_at: Date | string | null;
  total_count?: string;
};

type DbMedia = { type: string; url: string; alt_text: string; position: number };
type DbHighlight = { label: string; value: string; position: number };
type DbRisk = { title: string; description: string; position: number };
type DbMilestone = { title: string; description: string; planned_date: Date | string | null; completed_at: Date | string | null; position: number };

const SORT_SQL: Record<ListQuery['sort'], string> = {
  publishedAt: 'o.published_at',
  closingDate: 'o.closing_date',
  fundingProgress: '(o.committed_amount_cents::numeric / NULLIF(o.target_amount_cents, 0))',
  minimumInvestment: 'o.minimum_investment_cents',
  targetAmount: 'o.target_amount_cents'
};

function mapMedia(row: DbMedia) {
  return { type: row.type, url: row.url, altText: row.alt_text, position: row.position };
}

function mapSummary(row: DbOpportunity, media: DbMedia | null = null) {
  const currency = row.currency;
  return {
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    city: row.city,
    countryCode: row.country_code,
    district: row.district,
    assetType: row.asset_type,
    strategy: row.strategy,
    status: row.status,
    currency,
    targetAmount: serializeMoney(row.target_amount_cents, currency),
    committedAmount: serializeMoney(row.committed_amount_cents, currency),
    projectTotalAmount: serializeMoney(row.project_total_amount_cents ?? row.target_amount_cents, currency),
    bankFinancingAmount: serializeMoney(row.bank_financing_amount_cents ?? Math.max(0, Number(row.target_amount_cents) - Number(row.committed_amount_cents)), currency),
    minimumInvestment: serializeMoney(row.minimum_investment_cents, currency),
    estimatedTermMonths: row.estimated_term_months,
    targetReturnType: row.target_return_type,
    targetReturn: serializePercentage(row.target_return_bps),
    riskLevel: row.risk_level,
    closingDate: serializeDate(row.closing_date),
    publishedAt: serializeDateTime(row.published_at),
    fundingProgress: calculateFundingProgress(row.committed_amount_cents, row.target_amount_cents),
    primaryImage: media ? mapMedia(media) : null,
    disclaimer: DEMO_OPPORTUNITY_DISCLAIMER
  };
}

export class OpportunityRepository {
  constructor(private readonly pool: Pool) {}

  async list(query: ListQuery) {
    const filters = ['o.visibility = $1', 'o.published_at IS NOT NULL'];
    const values: unknown[] = ['public'];

    const addFilter = (sql: string, value: unknown) => {
      values.push(value);
      filters.push(sql.replace('?', `$${values.length}`));
    };

    if (query.status) addFilter('o.status = ?', query.status);
    if (query.city) addFilter('lower(o.city) = lower(?)', query.city);
    if (query.assetType) addFilter('lower(o.asset_type) = lower(?)', query.assetType);
    if (query.strategy) addFilter('lower(o.strategy) = lower(?)', query.strategy);
    if (query.riskLevel) addFilter('o.risk_level = ?', query.riskLevel);

    const sortSql = SORT_SQL[query.sort];
    const direction = query.direction === 'asc' ? 'ASC' : 'DESC';
    values.push(query.limit, query.offset);
    const limitParam = `$${values.length - 1}`;
    const offsetParam = `$${values.length}`;

    const result = await this.pool.query<DbOpportunity & DbMedia>(
      `SELECT o.*, count(*) OVER() AS total_count,
        m.type, m.url, m.alt_text, m.position
       FROM opportunities o
       LEFT JOIN LATERAL (
         SELECT type::text, url, alt_text, position FROM opportunity_media
         WHERE opportunity_id = o.id AND type = 'image'
         ORDER BY position ASC LIMIT 1
       ) m ON true
       WHERE ${filters.join(' AND ')}
       ORDER BY ${sortSql} ${direction} NULLS LAST, o.slug ASC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      values
    );

    const total = result.rows[0]?.total_count ? Number(result.rows[0].total_count) : 0;
    return {
      data: result.rows.map((row) => mapSummary(row, row.url ? row : null)),
      pagination: { limit: query.limit, offset: query.offset, total, hasMore: query.offset + query.limit < total },
      meta: { disclaimer: DEMO_OPPORTUNITY_DISCLAIMER, allowedSorts: Object.keys(SORT_SQL) }
    };
  }

  async findBySlug(slug: string) {
    const opportunity = await this.pool.query<DbOpportunity>(
      `SELECT * FROM opportunities
       WHERE slug = $1 AND visibility = 'public' AND published_at IS NOT NULL
       LIMIT 1`,
      [slug]
    );
    const row = opportunity.rows[0];
    if (!row) return null;

    const [media, highlights, risks, milestones] = await Promise.all([
      this.pool.query<DbMedia>('SELECT type::text, url, alt_text, position FROM opportunity_media WHERE opportunity_id = $1 ORDER BY position ASC', [row.id]),
      this.pool.query<DbHighlight>('SELECT label, value, position FROM opportunity_highlights WHERE opportunity_id = $1 ORDER BY position ASC', [row.id]),
      this.pool.query<DbRisk>('SELECT title, description, position FROM opportunity_risks WHERE opportunity_id = $1 ORDER BY position ASC', [row.id]),
      this.pool.query<DbMilestone>('SELECT title, description, planned_date, completed_at, position FROM opportunity_milestones WHERE opportunity_id = $1 ORDER BY position ASC', [row.id])
    ]);

    return {
      data: {
        ...mapSummary(row, media.rows[0] ?? null),
        description: row.description ?? '',
        media: media.rows.map(mapMedia),
        highlights: highlights.rows,
        risks: risks.rows,
        milestones: milestones.rows.map((item) => ({
          title: item.title,
          description: item.description,
          plannedDate: serializeDate(item.planned_date),
          completedAt: serializeDateTime(item.completed_at),
          position: item.position
        }))
      },
      meta: { disclaimer: DEMO_OPPORTUNITY_DISCLAIMER }
    };
  }
}
