import type {
  AuthProvider,
  User,
  Session,
  SignUpParams,
  SignInParams,
} from './types';

/**
 * Auth0 adapter implementation (skeleton for future use).
 * This enables quick migration to Auth0 if needed.
 */
export class Auth0AuthProvider implements AuthProvider {
  constructor(
    private domain: string,
    private clientId: string,
    private clientSecret: string
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async signUp(params: SignUpParams): Promise<User> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async signIn(params: SignInParams): Promise<Session> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  async signOut(): Promise<void> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  async getSession(): Promise<Session | null> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async refreshSession(refreshToken: string): Promise<Session> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async resetPassword(email: string): Promise<void> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updatePassword(newPassword: string): Promise<void> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updatePasswordByUserId(userId: string, newPassword: string): Promise<void> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async verifyEmail(token: string): Promise<void> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async resendVerificationEmail(email: string): Promise<void> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  async getUser(): Promise<User | null> {
    throw new Error('Auth0 adapter not implemented yet');
  }
}
