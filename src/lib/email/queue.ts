/**
 * Email rate limiting module
 *
 * Note: This implementation uses in-memory storage which works for single-instance
 * deployments. For production with multiple instances, consider using Redis
 * (e.g., @upstash/redis) for distributed rate limiting.
 */

const MAX_EMAILS_PER_HOUR = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

// In-memory rate limit store
// Map of email -> { count: number, resetAt: number }
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Clean up expired entries periodically
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [email, data] of rateLimitStore.entries()) {
    if (now >= data.resetAt) {
      rateLimitStore.delete(email);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}

/**
 * Check if email rate limit is exceeded
 * @returns true if within rate limit, false if exceeded
 */
export async function checkEmailRateLimit(email: string): Promise<boolean> {
  const now = Date.now();
  const existing = rateLimitStore.get(email);

  if (!existing || now >= existing.resetAt) {
    // First email or window expired - start fresh
    rateLimitStore.set(email, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  // Increment count
  existing.count += 1;

  return existing.count <= MAX_EMAILS_PER_HOUR;
}

/**
 * Get remaining emails for user within the current rate limit window
 */
export async function getRemainingEmails(email: string): Promise<number> {
  const now = Date.now();
  const existing = rateLimitStore.get(email);

  if (!existing || now >= existing.resetAt) {
    return MAX_EMAILS_PER_HOUR;
  }

  return Math.max(0, MAX_EMAILS_PER_HOUR - existing.count);
}

/**
 * Get time until rate limit resets (in seconds)
 */
export async function getTimeUntilReset(email: string): Promise<number> {
  const now = Date.now();
  const existing = rateLimitStore.get(email);

  if (!existing || now >= existing.resetAt) {
    return 0;
  }

  return Math.ceil((existing.resetAt - now) / 1000);
}

// Export constants for testing
export const RATE_LIMIT_CONFIG = {
  MAX_EMAILS_PER_HOUR,
  RATE_LIMIT_WINDOW,
};
