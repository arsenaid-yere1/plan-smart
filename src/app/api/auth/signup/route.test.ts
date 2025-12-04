import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import * as auth from '@/lib/auth';
import * as dbClient from '@/db/client';
import * as emailSend from '@/lib/email/send';
import * as emailQueue from '@/lib/email/queue';

vi.mock('@/lib/auth');
vi.mock('@/db/client');
vi.mock('@/lib/email/send');
vi.mock('@/lib/email/queue');

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit is OK
    vi.mocked(emailQueue.checkEmailRateLimit).mockResolvedValue(true);
    // Default: email sending succeeds
    vi.mocked(emailSend.sendVerificationEmail).mockResolvedValue(undefined);
  });

  it('should create a new user and return 201', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      emailVerified: false,
      createdAt: new Date(),
    };

    const mockAuthProvider = {
      signUp: vi.fn().mockResolvedValue(mockUser),
    };

    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };

    vi.mocked(auth.getAuthProvider).mockReturnValue(mockAuthProvider as any);
    vi.mocked(dbClient.db).insert = mockDb.insert as any;

    const request = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'SecurePass123!@#',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe(
      'Account created. Please check your email to verify.'
    );
    expect(data.userId).toBe('test-user-id');
    expect(mockAuthProvider.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'SecurePass123!@#',
    });
    expect(emailSend.sendVerificationEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.any(String) // verification token
    );
  });

  it('should return 429 when rate limited', async () => {
    vi.mocked(emailQueue.checkEmailRateLimit).mockResolvedValue(false);

    const request = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'SecurePass123!@#',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.message).toBe('Too many requests. Please try again later.');
  });

  it('should return 400 for invalid email', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'SecurePass123!@#',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 400 for weak password', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'weak',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 409 if user already exists', async () => {
    const mockAuthProvider = {
      signUp: vi.fn().mockRejectedValue({ code: 'user_exists' }),
    };

    vi.mocked(auth.getAuthProvider).mockReturnValue(mockAuthProvider as any);

    const request = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'SecurePass123!@#',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toBe('An account with this email already exists');
  });
});
