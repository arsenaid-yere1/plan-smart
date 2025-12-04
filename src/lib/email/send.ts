import { resend, FROM_EMAIL } from './client';
import { VerificationEmail } from './templates/verification-email';
import { PasswordResetEmail } from './templates/password-reset-email';

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  verificationToken: string
) {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?token=${verificationToken}`;

  try {
    console.log('📧 Sending verification email to:', email);
    console.log('📧 From:', FROM_EMAIL);
    console.log('📧 Verification URL:', verificationUrl);

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your Plan Smart account',
      react: VerificationEmail({ verificationUrl, email }),
    });

    console.log('📧 Email sent successfully:', result);
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Reset your Plan Smart password',
      react: PasswordResetEmail({ resetUrl, email }),
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

/**
 * Send welcome email after email verification
 */
export async function sendWelcomeEmail(email: string, userName: string) {
  try {
    console.log('📧 Sending welcome email to:', email);

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Welcome to Plan Smart!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Welcome to Plan Smart, ${userName}!</h1>
          <p>Your email has been verified successfully.</p>
          <p>You're all set to start planning your retirement journey.</p>
          <p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/onboarding"
               style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
              Complete Your Profile
            </a>
          </p>
        </div>
      `,
    });

    console.log('📧 Welcome email sent successfully:', result);
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    // Don't throw - this is non-critical
  }
}
