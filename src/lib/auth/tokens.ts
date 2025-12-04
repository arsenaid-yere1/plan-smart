import { randomBytes } from 'crypto';

/**
 * Generate a secure random token for email verification or password reset
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Get expiration date for verification tokens (24 hours)
 */
export function getVerificationTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
}

/**
 * Get expiration date for password reset tokens (1 hour)
 */
export function getPasswordResetTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 1);
  return expiry;
}

/**
 * Check if a token has expired
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return new Date() > expiresAt;
}
