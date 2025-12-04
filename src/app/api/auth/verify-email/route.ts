import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { userProfile } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isTokenExpired } from '@/lib/auth/tokens';
import { sendWelcomeEmail } from '@/lib/email/send';

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = verifyEmailSchema.parse(body);

    // Find user by verification token
    const users = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.verificationToken, token))
      .limit(1);

    if (users.length === 0) {
      return NextResponse.json(
        { message: 'Invalid verification token' },
        { status: 400 }
      );
    }

    const user = users[0];

    // Check if token has expired
    if (isTokenExpired(user.verificationTokenExpiresAt)) {
      return NextResponse.json(
        { message: 'Verification link has expired. Please request a new one.' },
        { status: 401 }
      );
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({
        message: 'Email already verified',
      });
    }

    // Mark email as verified and clear token
    await db
      .update(userProfile)
      .set({
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(userProfile.id, user.id));

    // Send welcome email (non-blocking, doesn't throw on failure)
    await sendWelcomeEmail(user.email, user.email.split('@')[0]);

    return NextResponse.json({
      message: 'Email verified successfully',
    });
  } catch (error: any) {
    console.error('Verify email error:', error);

    return NextResponse.json(
      { message: error.message || 'Email verification failed' },
      { status: 400 }
    );
  }
}
