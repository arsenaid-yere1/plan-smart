import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkLoginRateLimit,
  incrementLoginAttempts,
  resetLoginAttempts,
  getRateLimitHeaders,
} from '../rate-limit';

describe('Rate Limiting', () => {
  const testIp = 'test-ip-' + Date.now();

  beforeEach(async () => {
    // Reset rate limit for test IP
    await resetLoginAttempts(testIp);
  });

  describe('checkLoginRateLimit', () => {
    it('should allow requests when no attempts have been made', async () => {
      const uniqueIp = 'fresh-ip-' + Date.now();
      const result = await checkLoginRateLimit(uniqueIp);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it('should allow requests up to the limit', async () => {
      const uniqueIp = 'limit-test-' + Date.now();

      // Make 4 attempts
      for (let i = 0; i < 4; i++) {
        await incrementLoginAttempts(uniqueIp);
      }

      const result = await checkLoginRateLimit(uniqueIp);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('should block requests after 5 failed attempts', async () => {
      const uniqueIp = 'blocked-ip-' + Date.now();

      // Make 5 attempts
      for (let i = 0; i < 5; i++) {
        await incrementLoginAttempts(uniqueIp);
      }

      const result = await checkLoginRateLimit(uniqueIp);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetAt).toBeDefined();
    });
  });

  describe('incrementLoginAttempts', () => {
    it('should increment attempt counter', async () => {
      const uniqueIp = 'increment-test-' + Date.now();

      await incrementLoginAttempts(uniqueIp);
      let result = await checkLoginRateLimit(uniqueIp);
      expect(result.remaining).toBe(4);

      await incrementLoginAttempts(uniqueIp);
      result = await checkLoginRateLimit(uniqueIp);
      expect(result.remaining).toBe(3);
    });
  });

  describe('resetLoginAttempts', () => {
    it('should reset the counter after successful login', async () => {
      const uniqueIp = 'reset-test-' + Date.now();

      // Make some attempts
      await incrementLoginAttempts(uniqueIp);
      await incrementLoginAttempts(uniqueIp);

      // Verify attempts were recorded
      let result = await checkLoginRateLimit(uniqueIp);
      expect(result.remaining).toBe(3);

      // Reset
      await resetLoginAttempts(uniqueIp);

      // Should be back to full
      result = await checkLoginRateLimit(uniqueIp);
      expect(result.remaining).toBe(5);
    });
  });

  describe('getRateLimitHeaders', () => {
    it('should return headers with limit and remaining', () => {
      const headers = getRateLimitHeaders(3);
      expect(headers['X-RateLimit-Limit']).toBe('5');
      expect(headers['X-RateLimit-Remaining']).toBe('3');
    });

    it('should include reset time when provided', () => {
      const resetAt = new Date(Date.now() + 60000);
      const headers = getRateLimitHeaders(0, resetAt);
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });

    it('should not include reset time when not provided', () => {
      const headers = getRateLimitHeaders(3);
      expect(headers['X-RateLimit-Reset']).toBeUndefined();
    });
  });
});
