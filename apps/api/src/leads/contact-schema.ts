import { z } from 'zod';

const SUBJECTS = ['Consulta general', 'Presentar un proyecto', 'Colaboración profesional', 'Otro'] as const;

export const contactSubjectEnum = z.enum(SUBJECTS);

export const contactRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(30).optional().transform((value) => value || undefined),
  subject: contactSubjectEnum,
  message: z.string().trim().min(20).max(2000),
  consent: z.literal(true),
  submittedAfterMs: z.number().int().min(2000).max(86_400_000),
  website: z.string().max(0).optional().default('')
}).strict();

export type ContactRequest = z.infer<typeof contactRequestSchema>;

export function normalizeContactInput(input: ContactRequest) {
  return {
    name: input.name.replace(/\s+/g, ' ').trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.replace(/\s+/g, ' ').trim(),
    subject: input.subject,
    message: input.message.replace(/[\u0000-\u001F\u007F]/g, '').trim()
  };
}

export const contactCreatedResponseSchema = z.object({
  data: z.object({
    publicReference: z.string(),
    status: z.literal('new'),
    createdAt: z.string(),
    message: z.string()
  })
});
