import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseAuthProvider } from '../supabase-adapter';
import { InvalidCredentialsError, UserAlreadyExistsError } from '../errors';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  })),
}));

describe('SupabaseAuthProvider', () => {
  let provider: SupabaseAuthProvider;

  beforeEach(() => {
    provider = new SupabaseAuthProvider('https://test.supabase.co', 'test-key');
  });

  describe('signUp', () => {
    it('should create a new user', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        email_confirmed_at: null,
        created_at: new Date().toISOString(),
        user_metadata: {},
        app_metadata: {},
        aud: 'authenticated',
      };

      vi.mocked(provider['client'].auth.signUp).mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      } as any);

      const user = await provider.signUp({
        email: 'test@example.com',
        password: 'SecurePassword123!',
      });

      expect(user.email).toBe('test@example.com');
      expect(user.emailVerified).toBe(false);
    });

    it('should throw UserAlreadyExistsError if user exists', async () => {
      vi.mocked(provider['client'].auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: {
          message: 'User already registered',
          name: 'AuthError',
          status: 400,
        } as any,
      } as any);

      await expect(
        provider.signUp({
          email: 'existing@example.com',
          password: 'SecurePassword123!',
        })
      ).rejects.toThrow(UserAlreadyExistsError);
    });
  });

  describe('signIn', () => {
    it('should throw InvalidCredentialsError for wrong password', async () => {
      vi.mocked(provider['client'].auth.signInWithPassword).mockResolvedValue({
        data: { session: null, user: null },
        error: {
          message: 'Invalid login credentials',
          name: 'AuthError',
          status: 400,
        } as any,
      } as any);

      await expect(
        provider.signIn({
          email: 'test@example.com',
          password: 'WrongPassword',
        })
      ).rejects.toThrow(InvalidCredentialsError);
    });
  });
});
