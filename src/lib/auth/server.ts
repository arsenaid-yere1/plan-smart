import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { User, Session } from './types';

/**
 * Get the current session from server components.
 * Uses getUser() to securely verify the session with Supabase Auth server.
 */
export async function getServerSession(): Promise<Session | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Use getUser() instead of getSession() to securely verify the session
  // getSession() reads from cookies without verification, which is insecure
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // Get the session for tokens (only after user is verified)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    user: {
      id: user.id,
      email: user.email!,
      emailVerified: user.email_confirmed_at !== null,
      createdAt: new Date(user.created_at),
      metadata: user.user_metadata,
    },
    accessToken: session?.access_token ?? '',
    refreshToken: session?.refresh_token ?? '',
    expiresAt: session?.expires_at ? new Date(session.expires_at * 1000) : new Date(),
  };
}

/**
 * Get the current user from server components.
 */
export async function getServerUser(): Promise<User | null> {
  const session = await getServerSession();
  return session?.user ?? null;
}

/**
 * Require authentication in server components.
 * Throws error if not authenticated.
 */
export async function requireAuth(): Promise<User> {
  const user = await getServerUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}
