import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import * as dbClient from '@/db/client';
import * as emailSend from '@/lib/email/send';
import * as emailQueue from '@/lib/email/queue';

vi.mock('@/db/client');
vi.mock('@/lib/email/send');
vi.mock('@/lib/email/queue');

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit is OK
    vi.mocked(emailQueue.checkEmailRateLimit).mockResolvedValue(true);
    // Default: email sending succeeds
    vi.mocked(emailSend.sendPasswordResetEmail).mockResolvedValue(undefined);
  });

  it('should send password reset email successfully', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
    };

    // Mock db.select().from().where().limit()
    const mockSelectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUser]),
        }),
      }),
    };

    // Mock db.update().set().where()
    const mockUpdateChain = {
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    };

    vi.mocked(dbClient.db).select = vi.fn().mockReturnValue(mockSelectChain) as any;
    vi.mocked(dbClient.db).update = vi.fn().mockReturnValue(mockUpdateChain) as any;

    const request = new NextRequest(
      'http://localhost:3000/api/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe(
      'If an account exists, a reset email has been sent'
    );
    expect(emailSend.sendPasswordResetEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.any(String) // reset token
    );
  });

  it('should not reveal if email does not exist', async () => {
    // Mock: no user found
    const mockSelectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    vi.mocked(dbClient.db).select = vi.fn().mockReturnValue(mockSelectChain) as any;

    const request = new NextRequest(
      'http://localhost:3000/api/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'nonexistent@example.com',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe(
      'If an account exists, a reset email has been sent'
    );
    // Email should NOT be sent if user doesn't exist
    expect(emailSend.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('should return 429 when rate limited', async () => {
    vi.mocked(emailQueue.checkEmailRateLimit).mockResolvedValue(false);

    const request = new NextRequest(
      'http://localhost:3000/api/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.message).toBe('Too many requests. Please try again later.');
  });

  it('should return 400 for invalid email format', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
        }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
