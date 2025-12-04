import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import * as dbClient from '@/db/client';
import * as emailSend from '@/lib/email/send';

vi.mock('@/db/client');
vi.mock('@/lib/email/send');

describe('POST /api/auth/verify-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: welcome email succeeds (non-critical)
    vi.mocked(emailSend.sendWelcomeEmail).mockResolvedValue(undefined);
  });

  it('should verify email successfully', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      emailVerified: false,
      verificationToken: 'valid-verification-token',
      verificationTokenExpiresAt: new Date(Date.now() + 86400000), // 24 hours from now
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
      'http://localhost:3000/api/auth/verify-email',
      {
        method: 'POST',
        body: JSON.stringify({
          token: 'valid-verification-token',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Email verified successfully');
    expect(emailSend.sendWelcomeEmail).toHaveBeenCalledWith(
      'test@example.com',
      'test' // email prefix as username
    );
  });

  it('should return 401 if verification token is expired', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      emailVerified: false,
      verificationToken: 'expired-token',
      verificationTokenExpiresAt: new Date(Date.now() - 86400000), // 24 hours ago (expired)
    };

    const mockSelectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUser]),
        }),
      }),
    };

    vi.mocked(dbClient.db).select = vi.fn().mockReturnValue(mockSelectChain) as any;

    const request = new NextRequest(
      'http://localhost:3000/api/auth/verify-email',
      {
        method: 'POST',
        body: JSON.stringify({
          token: 'expired-token',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe(
      'Verification link has expired. Please request a new one.'
    );
  });

  it('should return 400 for invalid token', async () => {
    // Mock: no user found with this token
    const mockSelectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    vi.mocked(dbClient.db).select = vi.fn().mockReturnValue(mockSelectChain) as any;

    const request = new NextRequest(
      'http://localhost:3000/api/auth/verify-email',
      {
        method: 'POST',
        body: JSON.stringify({
          token: 'invalid-token',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid verification token');
  });

  it('should return 400 for missing token', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/auth/verify-email',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return success if email already verified', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      emailVerified: true, // Already verified
      verificationToken: 'valid-token',
      verificationTokenExpiresAt: new Date(Date.now() + 86400000),
    };

    const mockSelectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUser]),
        }),
      }),
    };

    vi.mocked(dbClient.db).select = vi.fn().mockReturnValue(mockSelectChain) as any;

    const request = new NextRequest(
      'http://localhost:3000/api/auth/verify-email',
      {
        method: 'POST',
        body: JSON.stringify({
          token: 'valid-token',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Email already verified');
    // Welcome email should not be sent for already verified users
    expect(emailSend.sendWelcomeEmail).not.toHaveBeenCalled();
  });
});
