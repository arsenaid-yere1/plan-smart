import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

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

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error);

      if (error.message.includes('Invalid')) {
        return NextResponse.json(
          { message: 'Invalid email or password' },
          { status: 401 }
        );
      }

      if (error.message.includes('not confirmed')) {
        return NextResponse.json(
          { message: 'Please verify your email before logging in' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { message: error.message || 'Login failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        emailVerified: data.user.email_confirmed_at !== null,
      },
    });
  } catch (error: unknown) {
    console.error('Login error:', error);

    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Login failed' },
      { status: 400 }
    );
  }
}
