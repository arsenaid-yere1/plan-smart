import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkEmailRateLimit,
  getRemainingEmails,
  getTimeUntilReset,
  RATE_LIMIT_CONFIG,
} from '../queue';

describe('Email Rate Limiting', () => {
  beforeEach(() => {
    // Reset time mocking between tests
    vi.useRealTimers();
  });

  describe('checkEmailRateLimit', () => {
    it('should allow first email', async () => {
      const email = `test-${Date.now()}@example.com`;
      const result = await checkEmailRateLimit(email);
      expect(result).toBe(true);
    });

    it('should allow up to MAX_EMAILS_PER_HOUR emails', async () => {
      const email = `test-${Date.now()}-multi@example.com`;

      // Should allow MAX_EMAILS_PER_HOUR emails
      for (let i = 0; i < RATE_LIMIT_CONFIG.MAX_EMAILS_PER_HOUR; i++) {
        const result = await checkEmailRateLimit(email);
        expect(result).toBe(true);
      }
    });

    it('should block after exceeding MAX_EMAILS_PER_HOUR', async () => {
      const email = `test-${Date.now()}-exceed@example.com`;

      // Exhaust the limit
      for (let i = 0; i < RATE_LIMIT_CONFIG.MAX_EMAILS_PER_HOUR; i++) {
        await checkEmailRateLimit(email);
      }

      // Next one should be blocked
      const result = await checkEmailRateLimit(email);
      expect(result).toBe(false);
    });

    it('should use separate limits for different emails', async () => {
      const email1 = `test-${Date.now()}-1@example.com`;
      const email2 = `test-${Date.now()}-2@example.com`;

      // Exhaust limit for email1
      for (let i = 0; i < RATE_LIMIT_CONFIG.MAX_EMAILS_PER_HOUR; i++) {
        await checkEmailRateLimit(email1);
      }

      // email2 should still be allowed
      const result = await checkEmailRateLimit(email2);
      expect(result).toBe(true);
    });
  });

  describe('getRemainingEmails', () => {
    it('should return MAX_EMAILS_PER_HOUR for new email', async () => {
      const email = `test-${Date.now()}-remaining@example.com`;
      const remaining = await getRemainingEmails(email);
      expect(remaining).toBe(RATE_LIMIT_CONFIG.MAX_EMAILS_PER_HOUR);
    });

    it('should decrement remaining count after each email', async () => {
      const email = `test-${Date.now()}-decrement@example.com`;

      await checkEmailRateLimit(email);
      const remaining = await getRemainingEmails(email);

      expect(remaining).toBe(RATE_LIMIT_CONFIG.MAX_EMAILS_PER_HOUR - 1);
    });

    it('should return 0 when limit is exhausted', async () => {
      const email = `test-${Date.now()}-exhaust@example.com`;

      // Exhaust the limit
      for (let i = 0; i < RATE_LIMIT_CONFIG.MAX_EMAILS_PER_HOUR; i++) {
        await checkEmailRateLimit(email);
      }

      const remaining = await getRemainingEmails(email);
      expect(remaining).toBe(0);
    });
  });

  describe('getTimeUntilReset', () => {
    it('should return 0 for new email', async () => {
      const email = `test-${Date.now()}-reset@example.com`;
      const time = await getTimeUntilReset(email);
      expect(time).toBe(0);
    });

    it('should return positive time after sending an email', async () => {
      const email = `test-${Date.now()}-time@example.com`;

      await checkEmailRateLimit(email);
      const time = await getTimeUntilReset(email);

      // Should be close to 1 hour (3600 seconds) but slightly less
      expect(time).toBeGreaterThan(3500);
      expect(time).toBeLessThanOrEqual(3600);
    });
  });

  describe('rate limit constants', () => {
    it('should have correct MAX_EMAILS_PER_HOUR', () => {
      expect(RATE_LIMIT_CONFIG.MAX_EMAILS_PER_HOUR).toBe(5);
    });

    it('should have correct RATE_LIMIT_WINDOW (1 hour)', () => {
      expect(RATE_LIMIT_CONFIG.RATE_LIMIT_WINDOW).toBe(60 * 60 * 1000);
    });
  });
});
