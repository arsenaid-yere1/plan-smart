import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthProvider,
  User,
  Session,
  SignUpParams,
  SignInParams,
} from './types';
import {
  AuthError,
  InvalidCredentialsError,
  UserAlreadyExistsError,
  TokenExpiredError,
} from './errors';

export class SupabaseAuthProvider implements AuthProvider {
  private client: SupabaseClient;
  private adminClient: SupabaseClient | null = null;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });

    // Initialize admin client if service role key is available
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      this.adminClient = createClient(url, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }

  async signUp(params: SignUpParams): Promise<User> {
    const { email, password, rememberMe } = params;

    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: {
          rememberMe: rememberMe ?? false,
        },
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new UserAlreadyExistsError();
      }
      throw new AuthError(error.message, 'signup_failed');
    }

    if (!data.user) {
      throw new AuthError('User creation failed', 'signup_failed');
    }

    return this.mapUser(data.user);
  }

  async signIn(params: SignInParams): Promise<Session> {
    const { email, password } = params;

    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid')) {
        throw new InvalidCredentialsError();
      }
      throw new AuthError(error.message, 'signin_failed');
    }

    if (!data.session) {
      throw new AuthError('Session creation failed', 'signin_failed');
    }

    return this.mapSession(data.session, data.user);
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();

    if (error) {
      throw new AuthError(error.message, 'signout_failed');
    }
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession();

    if (error) {
      throw new AuthError(error.message, 'get_session_failed');
    }

    if (!data.session) {
      return null;
    }

    return this.mapSession(data.session, data.session.user);
  }

  async refreshSession(refreshToken: string): Promise<Session> {
    const { data, error } = await this.client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      if (error.message.includes('expired')) {
        throw new TokenExpiredError();
      }
      throw new AuthError(error.message, 'refresh_failed');
    }

    if (!data.session) {
      throw new AuthError('Session refresh failed', 'refresh_failed');
    }

    return this.mapSession(data.session, data.user);
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    });

    if (error) {
      throw new AuthError(error.message, 'reset_password_failed');
    }
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new AuthError(error.message, 'update_password_failed');
    }
  }

  async updatePasswordByUserId(
    userId: string,
    newPassword: string
  ): Promise<void> {
    if (!this.adminClient) {
      throw new AuthError(
        'Admin client not configured. SUPABASE_SERVICE_ROLE_KEY is required.',
        'admin_not_configured'
      );
    }

    const { error } = await this.adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      throw new AuthError(error.message, 'update_password_failed');
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const { error } = await this.client.auth.verifyOtp({
      token_hash: token,
      type: 'email',
    });

    if (error) {
      if (error.message.includes('expired')) {
        throw new TokenExpiredError();
      }
      throw new AuthError(error.message, 'verify_email_failed');
    }
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const { error } = await this.client.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      throw new AuthError(error.message, 'resend_verification_failed');
    }
  }

  async getUser(): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser();

    if (error) {
      throw new AuthError(error.message, 'get_user_failed');
    }

    if (!data.user) {
      return null;
    }

    return this.mapUser(data.user);
  }

  // Helper methods
  private mapUser(supabaseUser: any): User {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      emailVerified: supabaseUser.email_confirmed_at !== null,
      createdAt: new Date(supabaseUser.created_at),
      metadata: supabaseUser.user_metadata,
    };
  }

  private mapSession(supabaseSession: any, supabaseUser: any): Session {
    return {
      user: this.mapUser(supabaseUser),
      accessToken: supabaseSession.access_token,
      refreshToken: supabaseSession.refresh_token,
      expiresAt: new Date(supabaseSession.expires_at * 1000),
    };
  }
}
