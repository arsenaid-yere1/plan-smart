import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is not set');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

// TODO: Change back to 'Plan Smart <noreply@plansmart.app>' after domain verification
export const FROM_EMAIL = 'Plan Smart <onboarding@resend.dev>';
export const SUPPORT_EMAIL = 'support@plansmart.app';
