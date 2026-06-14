import { z } from 'zod/v4';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from './password.js';

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

export const registerSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().trim().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
    name: z.string().trim().min(1).max(200),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().trim().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  })
  .strict();

export const verifyEmailSchema = z
  .object({
    token: z.string().trim().min(1).max(512),
  })
  .strict();

export const resendVerificationSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1).max(512),
    password: z.string().trim().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  })
  .strict();

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const sessionResponseSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  expiresAt: z.date(),
  lastSeenAt: z.date(),
  isCurrent: z.boolean(),
});

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  roles: z.array(z.string()),
  status: z.string(),
  emailVerified: z.boolean(),
  createdAt: z.date(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
