import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthProvider } from '@/lib/auth';
import { validatePassword } from '@/lib/auth/password-validator';
import { db } from '@/db/client';
import { userProfile } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isTokenExpired } from '@/lib/auth/tokens';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z
    .string()
    .refine(
      (password) => validatePassword(password).isValid,
      'Password does not meet requirements'
    ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = resetPasswordSchema.parse(body);

    // Find user by reset token
    const users = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.passwordResetToken, token))
      .limit(1);

    if (users.length === 0) {
      return NextResponse.json(
        { message: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    const user = users[0];

    // Check if token has expired
    if (isTokenExpired(user.passwordResetTokenExpiresAt)) {
      return NextResponse.json(
        { message: 'Reset link has expired. Please request a new one.' },
        { status: 401 }
      );
    }

    // Update password in Supabase Auth using admin API
    const auth = getAuthProvider();
    await auth.updatePasswordByUserId(user.id, newPassword);

    // Clear the reset token
    await db
      .update(userProfile)
      .set({
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(userProfile.id, user.id));

    return NextResponse.json({
      message: 'Password updated successfully',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);

    return NextResponse.json(
      { message: error.message || 'Password reset failed' },
      { status: 400 }
    );
  }
}
