import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    await supabase.auth.signOut();

    // Check if this is a form submission (Accept header includes text/html)
    // or a fetch request (Accept header is application/json)
    const acceptHeader = request.headers.get('accept') || '';

    if (acceptHeader.includes('text/html')) {
      // Form submission - redirect to login page
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // API request - return JSON
    return NextResponse.json({ message: 'Logout successful' });
  } catch (error: unknown) {
    console.error('Logout error:', error);

    // Check if this is a form submission
    const acceptHeader = request.headers.get('accept') || '';
    if (acceptHeader.includes('text/html')) {
      // Redirect to login even on error (session might already be invalid)
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    return NextResponse.json({ message: 'Logout failed' }, { status: 500 });
  }
}
