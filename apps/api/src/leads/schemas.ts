import { z } from 'zod';

export const leadKindSchema = z.enum(['access_request', 'opportunity_inquiry', 'general_contact']);
export const leadStatusSchema = z.enum(['new', 'in_review', 'contacted', 'qualified', 'closed', 'rejected']);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);

export const leadRequestSchema = z.object({
  kind: leadKindSchema,
  opportunitySlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(140).optional(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  phone: optionalTrimmed(40),
  countryCode: z.string().trim().length(2).optional(),
  investmentRange: optionalTrimmed(80),
  message: optionalTrimmed(2000),
  sourcePath: z.string().trim().min(1).max(240).regex(/^\//),
  referrer: optionalTrimmed(500),
  utmSource: optionalTrimmed(120),
  utmMedium: optionalTrimmed(120),
  utmCampaign: optionalTrimmed(120),
  privacyAccepted: z.literal(true),
  marketingOptIn: z.boolean().optional().default(false),
  riskAcknowledged: z.boolean().optional().default(false),
  submittedAfterMs: z.number().int().min(1500).max(86_400_000),
  website: z.string().max(0).optional().default('')
}).strict().superRefine((value, ctx) => {
  if (value.kind === 'opportunity_inquiry' && !value.opportunitySlug) {
    ctx.addIssue({ code: 'custom', path: ['opportunitySlug'], message: 'Opportunity slug is required for opportunity inquiries.' });
  }
  if (value.kind !== 'opportunity_inquiry' && value.opportunitySlug) {
    ctx.addIssue({ code: 'custom', path: ['opportunitySlug'], message: 'Opportunity slug is only allowed for opportunity inquiries.' });
  }
});

export type LeadRequest = z.infer<typeof leadRequestSchema>;

export function normalizeLeadInput(input: LeadRequest) {
  return {
    ...input,
    firstName: input.firstName.replace(/\s+/g, ' ').trim(),
    lastName: input.lastName.replace(/\s+/g, ' ').trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.replace(/\s+/g, ' ').trim(),
    countryCode: input.countryCode?.trim().toUpperCase(),
    message: input.message?.replace(/[\u0000-\u001F\u007F]/g, '').trim()
  };
}

export const leadCreatedResponseSchema = z.object({
  data: z.object({
    publicReference: z.string(),
    kind: leadKindSchema,
    status: z.literal('new'),
    createdAt: z.string(),
    message: z.string()
  })
});
