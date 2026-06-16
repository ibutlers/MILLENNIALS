import { z } from 'zod';

const PROFILES = ['Inversor particular', 'Empresa', 'Family office', 'Profesional del sector', 'Otro'] as const;
const EXPERIENCE_LEVELS = ['Sin experiencia previa', 'Alguna inversión previa', 'Experiencia habitual', 'Prefiero no indicarlo'] as const;

export const coinvestRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(30).optional().transform((value) => value || undefined),
  profile: z.enum(PROFILES),
  experience: z.enum(EXPERIENCE_LEVELS),
  interests: z.string().trim().max(1000).optional().transform((value) => value || undefined),
  consent: z.literal(true),
  submittedAfterMs: z.number().int().min(2000).max(86_400_000),
  website: z.string().max(0).optional().default('')
}).strict();

export type CoinvestRequest = z.infer<typeof coinvestRequestSchema>;

export const COINVEST_CONSENT_VERSION = 'v1-2026';

export function normalizeCoinvestInput(input: CoinvestRequest) {
  return {
    name: input.name.replace(/\s+/g, ' ').trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.replace(/\s+/g, ' ').trim(),
    profile: input.profile,
    experience: input.experience,
    interests: input.interests?.replace(/[\u0000-\u001F\u007F]/g, '').trim()
  };
}

export const coinvestCreatedResponseSchema = z.object({
  data: z.object({
    publicReference: z.string(),
    status: z.literal('new'),
    createdAt: z.string(),
    message: z.string()
  })
});
