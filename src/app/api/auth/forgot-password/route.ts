import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { userProfile } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  generateToken,
  getPasswordResetTokenExpiry,
} from '@/lib/auth/tokens';
import { sendPasswordResetEmail } from '@/lib/email/send';
import { checkEmailRateLimit } from '@/lib/email/queue';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // Check email rate limit
    const withinRateLimit = await checkEmailRateLimit(email);
    if (!withinRateLimit) {
      return NextResponse.json(
        { message: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Find user by email
    const users = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.email, email))
      .limit(1);

    // Always return success message to prevent email enumeration
    const successResponse = NextResponse.json({
      message: 'If an account exists, a reset email has been sent',
    });

    // If no user found, still return success (don't reveal email existence)
    if (users.length === 0) {
      return successResponse;
    }

    const user = users[0];

    // Generate password reset token
    const passwordResetToken = generateToken();
    const passwordResetTokenExpiresAt = getPasswordResetTokenExpiry();

    // Store reset token in database
    await db
      .update(userProfile)
      .set({
        passwordResetToken,
        passwordResetTokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(userProfile.id, user.id));

    // Send password reset email via Resend
    await sendPasswordResetEmail(email, passwordResetToken);

    return successResponse;
  } catch (error: any) {
    console.error('Forgot password error:', error);

    // Return validation errors with 400 status
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { message: error.message || 'Invalid input' },
        { status: 400 }
      );
    }

    // Don't reveal internal errors - always return generic message
    return NextResponse.json({
      message: 'If an account exists, a reset email has been sent',
    });
  }
}
