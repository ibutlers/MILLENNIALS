import { z } from "zod";

// ── Auth status ──
export const authStatusResponseSchema = z.object({
  available: z.boolean(),
});

// ── User ──
export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  roles: z.array(z.string()),
  status: z.string(),
  emailVerified: z.boolean(),
  createdAt: z.string().datetime(),
});

// ── Registration ──
export const registerRequestSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().trim().min(8).max(256),
    name: z.string().trim().min(1).max(200),
  })
  .strict();

export const registerResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    status: z.string(),
    createdAt: z.string(),
  }),
});

// ── Login ──
export const loginRequestSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().trim().min(8).max(256),
  })
  .strict();

export const loginResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    email: z.string(),
    status: z.string(),
  }),
});

// ── Me ──
export const meResponseSchema = z.object(userResponseSchema.shape);

// ── Logout ──
export const logoutResponseSchema = z.object({
  data: z.object({ message: z.string() }),
});

// ── Email verification ──
export const verifyEmailRequestSchema = z
  .object({
    token: z.string().trim().min(1).max(512),
  })
  .strict();

export const verifyEmailResponseSchema = z.object({
  data: z.object({ message: z.string() }),
});

// ── Password recovery ──
export const forgotPasswordRequestSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
  })
  .strict();

export const forgotPasswordResponseSchema = z.object({
  data: z.object({ message: z.string() }),
});

export const resetPasswordRequestSchema = z
  .object({
    token: z.string().trim().min(1).max(512),
    password: z.string().trim().min(8).max(256),
  })
  .strict();

export const resetPasswordResponseSchema = z.object({
  data: z.object({ message: z.string() }),
});

// ── Sessions ──
export const sessionResponseSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  lastSeenAt: z.string().datetime().nullable(),
  isCurrent: z.boolean(),
});

export const sessionsListResponseSchema = z.object({
  data: z.array(sessionResponseSchema),
});

// ── Inferred types ──
export type AuthStatusResponse = z.infer<typeof authStatusResponseSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;
export type VerifyEmailResponse = z.infer<typeof verifyEmailResponseSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;
export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
