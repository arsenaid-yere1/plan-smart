import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { User, Session } from './types';

/**
 * Get the current session from server components.
 */
export async function getServerSession(): Promise<Session | null> {
  const cookieStore = cookies();

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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email!,
      emailVerified: session.user.email_confirmed_at !== null,
      createdAt: new Date(session.user.created_at),
      metadata: session.user.user_metadata,
    },
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: new Date(session.expires_at! * 1000),
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
