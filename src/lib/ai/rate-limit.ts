// In-memory rate limiting for AI regeneration requests
// Resets at midnight UTC

interface RateLimitEntry {
  count: number;
  resetAt: number; // UTC midnight timestamp
}

const regenerationLimits = new Map<string, RateLimitEntry>();

const MAX_REGENERATIONS_PER_DAY = 10;

function getMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1, // Next midnight
    0, 0, 0, 0
  ));
  return midnight.getTime();
}

export function checkAIRegenerationLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
} {
  const entry = regenerationLimits.get(userId);
  const now = Date.now();

  // No entry or expired - user has full quota
  if (!entry || entry.resetAt < now) {
    return {
      allowed: true,
      remaining: MAX_REGENERATIONS_PER_DAY,
      resetAt: new Date(getMidnightUTC()),
    };
  }

  const remaining = MAX_REGENERATIONS_PER_DAY - entry.count;
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    resetAt: new Date(entry.resetAt),
  };
}

export function incrementAIRegenerationCount(userId: string): void {
  const now = Date.now();
  const entry = regenerationLimits.get(userId);

  // Reset if expired
  if (!entry || entry.resetAt < now) {
    regenerationLimits.set(userId, {
      count: 1,
      resetAt: getMidnightUTC(),
    });
    return;
  }

  // Increment existing
  entry.count++;
}

// Cleanup old entries every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [userId, entry] of regenerationLimits.entries()) {
      if (entry.resetAt < now) {
        regenerationLimits.delete(userId);
      }
    }
  }, 60 * 60 * 1000);
}
