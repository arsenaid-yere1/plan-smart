import { SupabaseAuthProvider } from './supabase-adapter';
import { Auth0AuthProvider } from './auth0-adapter';
import type { AuthProvider } from './types';

/**
 * Factory function to create the appropriate auth provider.
 * Switches based on AUTH_PROVIDER environment variable.
 */
export function createAuthProvider(): AuthProvider {
  const provider = process.env.AUTH_PROVIDER || 'supabase';

  switch (provider) {
    case 'auth0':
      return new Auth0AuthProvider(
        process.env.AUTH0_DOMAIN!,
        process.env.AUTH0_CLIENT_ID!,
        process.env.AUTH0_CLIENT_SECRET!
      );

    case 'supabase':
    default:
      return new SupabaseAuthProvider(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
  }
}

// Singleton instance
let authProviderInstance: AuthProvider | null = null;

/**
 * Get the auth provider singleton instance.
 */
export function getAuthProvider(): AuthProvider {
  if (!authProviderInstance) {
    authProviderInstance = createAuthProvider();
  }
  return authProviderInstance;
}

// Re-export types and errors
export * from './types';
export * from './errors';
