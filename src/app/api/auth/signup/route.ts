import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthProvider } from '@/lib/auth';
import { validatePassword } from '@/lib/auth/password-validator';
import {
  generateToken,
  getVerificationTokenExpiry,
} from '@/lib/auth/tokens';
import { db } from '@/db/client';
import { userProfile } from '@/db/schema';
import { sendVerificationEmail } from '@/lib/email/send';
import { checkEmailRateLimit } from '@/lib/email/queue';

const signupSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .refine(
      (password) => validatePassword(password).isValid,
      'Password does not meet requirements'
    ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = signupSchema.parse(body);

    // Check email rate limit before proceeding
    const withinRateLimit = await checkEmailRateLimit(email);
    if (!withinRateLimit) {
      return NextResponse.json(
        { message: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const auth = getAuthProvider();

    // Create user in Supabase Auth (email confirmation disabled in Supabase dashboard)
    const user = await auth.signUp({ email, password });

    // Generate verification token
    const verificationToken = generateToken();
    const verificationTokenExpiresAt = getVerificationTokenExpiry();

    // Create user profile in database with verification token
    await db.insert(userProfile).values({
      id: user.id,
      email: user.email,
      emailVerified: false,
      onboardingCompleted: false,
      verificationToken,
      verificationTokenExpiresAt,
    });

    // Send verification email via Resend
    await sendVerificationEmail(email, verificationToken);

    return NextResponse.json(
      {
        message: 'Account created. Please check your email to verify.',
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Signup error:', error);

    if (error.code === 'user_exists') {
      return NextResponse.json(
        { message: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: error.message || 'Signup failed' },
      { status: 400 }
    );
  }
}
