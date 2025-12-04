import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import * as auth from '@/lib/auth';
import * as dbClient from '@/db/client';

vi.mock('@/lib/auth');
vi.mock('@/db/client');

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reset password successfully', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      passwordResetToken: 'valid-reset-token',
      passwordResetTokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    };

    const mockAuthProvider = {
      updatePasswordByUserId: vi.fn().mockResolvedValue(undefined),
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

    vi.mocked(auth.getAuthProvider).mockReturnValue(mockAuthProvider as any);
    vi.mocked(dbClient.db).select = vi.fn().mockReturnValue(mockSelectChain) as any;
    vi.mocked(dbClient.db).update = vi.fn().mockReturnValue(mockUpdateChain) as any;

    const request = new NextRequest(
      'http://localhost:3000/api/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({
          token: 'valid-reset-token',
          newPassword: 'NewSecurePass123!@#',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Password updated successfully');
    expect(mockAuthProvider.updatePasswordByUserId).toHaveBeenCalledWith(
      'test-user-id',
      'NewSecurePass123!@#'
    );
  });

  it('should return 401 if reset token is expired', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      passwordResetToken: 'expired-token',
      passwordResetTokenExpiresAt: new Date(Date.now() - 3600000), // 1 hour ago (expired)
    };

    // Mock db.select().from().where().limit()
    const mockSelectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUser]),
        }),
      }),
    };

    vi.mocked(dbClient.db).select = vi.fn().mockReturnValue(mockSelectChain) as any;

    const request = new NextRequest(
      'http://localhost:3000/api/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({
          token: 'expired-token',
          newPassword: 'NewSecurePass123!@#',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe(
      'Reset link has expired. Please request a new one.'
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
      'http://localhost:3000/api/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({
          token: 'invalid-token',
          newPassword: 'NewSecurePass123!@#',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid or expired reset token');
  });

  it('should return 400 for weak password', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({
          token: 'valid-token',
          newPassword: 'weak',
        }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 400 for missing token', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({
          newPassword: 'NewSecurePass123!@#',
        }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
