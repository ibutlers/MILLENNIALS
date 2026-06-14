import { hash, verify } from '@node-rs/argon2';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Argon2id = algorithm 2
const ARGON2_OPTIONS = {
  algorithm: 2 as const,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  const trimmed = password.trim();
  if (trimmed.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (trimmed.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`Password must be at most ${PASSWORD_MAX_LENGTH} characters`);
  }
  return hash(trimmed, ARGON2_OPTIONS);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    return await verify(storedHash, password.trim());
  } catch {
    return false;
  }
}
