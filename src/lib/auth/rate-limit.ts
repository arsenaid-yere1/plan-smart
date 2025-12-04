/**
 * Rate limiting for auth endpoints
 *
 * This implementation uses in-memory storage by default.
 * For production with multiple instances, configure UPSTASH_REDIS_REST_URL
 * and UPSTASH_REDIS_REST_TOKEN environment variables.
 */

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}

// In-memory store for development/single-instance deployments
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Check if IP is rate limited for login attempts
 */
export async function checkLoginRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt?: Date;
}> {
  const key = `login_attempts:${ip}`;
  const entry = rateLimitStore.get(key);
  const now = Date.now();

  // If entry exists and not expired
  if (entry && entry.resetAt > now) {
    if (entry.attempts >= MAX_LOGIN_ATTEMPTS) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.resetAt),
      };
    }

    return {
      allowed: true,
      remaining: MAX_LOGIN_ATTEMPTS - entry.attempts,
    };
  }

  // No entry or expired - allow request
  return {
    allowed: true,
    remaining: MAX_LOGIN_ATTEMPTS,
  };
}

/**
 * Increment login attempt counter
 */
export async function incrementLoginAttempts(ip: string): Promise<void> {
  const key = `login_attempts:${ip}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (entry && entry.resetAt > now) {
    // Increment existing entry
    entry.attempts += 1;
    rateLimitStore.set(key, entry);
  } else {
    // Create new entry
    rateLimitStore.set(key, {
      attempts: 1,
      resetAt: now + LOCKOUT_DURATION,
    });
  }
}

/**
 * Reset login attempts on successful login
 */
export async function resetLoginAttempts(ip: string): Promise<void> {
  const key = `login_attempts:${ip}`;
  rateLimitStore.delete(key);
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(remaining: number, resetAt?: Date): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(MAX_LOGIN_ATTEMPTS),
    'X-RateLimit-Remaining': String(remaining),
  };

  if (resetAt) {
    headers['X-RateLimit-Reset'] = String(Math.ceil(resetAt.getTime() / 1000));
  }

  return headers;
}
