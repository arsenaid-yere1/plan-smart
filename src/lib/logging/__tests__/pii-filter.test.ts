import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { filterPII, filterPIIFromObject, logger } from '../pii-filter';

describe('PII Filter', () => {
  describe('filterPII', () => {
    it('should redact email addresses', () => {
      const input = 'User email is john.doe@example.com';
      const result = filterPII(input);
      expect(result).toBe('User email is [EMAIL_REDACTED]');
    });

    it('should redact multiple email addresses', () => {
      const input = 'Contact user@example.com or admin@company.org';
      const result = filterPII(input);
      expect(result).toBe('Contact [EMAIL_REDACTED] or [EMAIL_REDACTED]');
    });

    it('should redact phone numbers', () => {
      const input = 'Call me at 555-123-4567';
      const result = filterPII(input);
      expect(result).toBe('Call me at [PHONE_REDACTED]');
    });

    it('should redact phone numbers with country code', () => {
      const input = 'International: +1-555-123-4567';
      const result = filterPII(input);
      expect(result).toBe('International: [PHONE_REDACTED]');
    });

    it('should redact SSN', () => {
      const input = 'SSN is 123-45-6789';
      const result = filterPII(input);
      expect(result).toBe('SSN is [SSN_REDACTED]');
    });

    it('should redact credit card numbers', () => {
      const input = 'Card: 1234-5678-9012-3456';
      const result = filterPII(input);
      expect(result).toBe('Card: [CARD_REDACTED]');
    });

    it('should redact credit card numbers with spaces', () => {
      const input = 'Card: 1234 5678 9012 3456';
      const result = filterPII(input);
      expect(result).toBe('Card: [CARD_REDACTED]');
    });

    it('should not modify non-PII content', () => {
      const input = 'Hello world, this is a test message';
      const result = filterPII(input);
      expect(result).toBe(input);
    });
  });

  describe('filterPIIFromObject', () => {
    it('should redact email fields', () => {
      const input = { email: 'test@example.com', name: 'John' };
      const result = filterPIIFromObject(input);
      expect(result).toEqual({ email: '[EMAIL_REDACTED]', name: 'John' });
    });

    it('should redact password fields', () => {
      const input = { password: 'secret123', username: 'john' };
      const result = filterPIIFromObject(input);
      expect(result).toEqual({ password: '[REDACTED]', username: 'john' });
    });

    it('should redact token fields', () => {
      const input = { token: 'abc123', data: 'safe' };
      const result = filterPIIFromObject(input);
      expect(result).toEqual({ token: '[REDACTED]', data: 'safe' });
    });

    it('should redact secret fields', () => {
      const input = { secret: 'mysecret', info: 'public' };
      const result = filterPIIFromObject(input);
      expect(result).toEqual({ secret: '[REDACTED]', info: 'public' });
    });

    it('should redact apiKey fields', () => {
      const input = { apiKey: 'key123', endpoint: '/api' };
      const result = filterPIIFromObject(input);
      expect(result).toEqual({ apiKey: '[REDACTED]', endpoint: '/api' });
    });

    it('should handle nested objects', () => {
      const input = {
        user: { email: 'test@example.com', password: 'secret' },
        data: 'safe',
      };
      const result = filterPIIFromObject(input);
      expect(result).toEqual({
        user: { email: '[EMAIL_REDACTED]', password: '[REDACTED]' },
        data: 'safe',
      });
    });

    it('should handle arrays', () => {
      const input = ['test@example.com', 'hello'];
      const result = filterPIIFromObject(input);
      expect(result).toEqual(['[EMAIL_REDACTED]', 'hello']);
    });

    it('should handle null', () => {
      const result = filterPIIFromObject(null);
      expect(result).toBeNull();
    });

    it('should handle non-string primitives', () => {
      expect(filterPIIFromObject(123)).toBe(123);
      expect(filterPIIFromObject(true)).toBe(true);
    });

    it('should filter PII in string values', () => {
      const input = { message: 'Contact user@example.com for info' };
      const result = filterPIIFromObject(input);
      expect(result).toEqual({
        message: 'Contact [EMAIL_REDACTED] for info',
      });
    });
  });

  describe('logger', () => {
    let consoleSpy: {
      log: ReturnType<typeof vi.spyOn>;
      error: ReturnType<typeof vi.spyOn>;
      warn: ReturnType<typeof vi.spyOn>;
    };

    beforeEach(() => {
      consoleSpy = {
        log: vi.spyOn(console, 'log').mockImplementation(() => {}),
        error: vi.spyOn(console, 'error').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      };
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should log info messages with PII filtered', () => {
      logger.info('User test@example.com logged in');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL_REDACTED]')
      );
    });

    it('should log error messages with PII filtered', () => {
      logger.error('Failed for user@example.com');
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL_REDACTED]')
      );
    });

    it('should log warn messages with PII filtered', () => {
      logger.warn('Warning for 555-123-4567');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[PHONE_REDACTED]')
      );
    });

    it('should filter PII from metadata', () => {
      logger.info('Login attempt', { email: 'test@example.com' });
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL_REDACTED]')
      );
    });
  });
});
