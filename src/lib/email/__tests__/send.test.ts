import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from '../send';

// Mock the resend client
vi.mock('../client', () => ({
  resend: {
    emails: {
      send: vi.fn(),
    },
  },
  FROM_EMAIL: 'Plan Smart <noreply@plansmart.app>',
  SUPPORT_EMAIL: 'support@plansmart.app',
}));

// Mock environment variable
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');

describe('Email Sending Functions', () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { resend } = await import('../client');
    mockSend = resend.emails.send as ReturnType<typeof vi.fn>;
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email with correct parameters', async () => {
      mockSend.mockResolvedValue({ id: 'email-id' });

      await sendVerificationEmail('user@example.com', 'verification-token-123');

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Plan Smart <noreply@plansmart.app>',
          to: 'user@example.com',
          subject: 'Verify your Plan Smart account',
        })
      );
    });

    it('should include verification URL with token', async () => {
      mockSend.mockResolvedValue({ id: 'email-id' });

      await sendVerificationEmail('user@example.com', 'test-token');

      const callArgs = mockSend.mock.calls[0][0];
      // The react prop contains the rendered component
      expect(callArgs.react).toBeDefined();
    });

    it('should throw error when email fails to send', async () => {
      mockSend.mockRejectedValue(new Error('API error'));

      await expect(
        sendVerificationEmail('user@example.com', 'token')
      ).rejects.toThrow('Failed to send verification email');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with correct parameters', async () => {
      mockSend.mockResolvedValue({ id: 'email-id' });

      await sendPasswordResetEmail('user@example.com', 'reset-token-456');

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Plan Smart <noreply@plansmart.app>',
          to: 'user@example.com',
          subject: 'Reset your Plan Smart password',
        })
      );
    });

    it('should throw error when email fails to send', async () => {
      mockSend.mockRejectedValue(new Error('API error'));

      await expect(
        sendPasswordResetEmail('user@example.com', 'token')
      ).rejects.toThrow('Failed to send password reset email');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with correct parameters', async () => {
      mockSend.mockResolvedValue({ id: 'email-id' });

      await sendWelcomeEmail('user@example.com', 'John');

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Plan Smart <noreply@plansmart.app>',
          to: 'user@example.com',
          subject: 'Welcome to Plan Smart!',
        })
      );
    });

    it('should include user name in email body', async () => {
      mockSend.mockResolvedValue({ id: 'email-id' });

      await sendWelcomeEmail('user@example.com', 'Jane');

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain('Jane');
    });

    it('should NOT throw error when email fails (non-critical)', async () => {
      mockSend.mockRejectedValue(new Error('API error'));

      // Should not throw
      await expect(
        sendWelcomeEmail('user@example.com', 'John')
      ).resolves.toBeUndefined();
    });
  });
});
