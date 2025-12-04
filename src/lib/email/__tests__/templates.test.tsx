import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VerificationEmail } from '../templates/verification-email';
import { PasswordResetEmail } from '../templates/password-reset-email';

describe('Email Templates', () => {
  describe('VerificationEmail', () => {
    it('should render with verification URL', () => {
      const html = renderToStaticMarkup(
        <VerificationEmail
          verificationUrl="https://example.com/verify?token=abc123"
          email="user@example.com"
        />
      );

      expect(html).toContain('https://example.com/verify?token=abc123');
    });

    it('should include welcome message', () => {
      const html = renderToStaticMarkup(
        <VerificationEmail
          verificationUrl="https://example.com/verify"
          email="user@example.com"
        />
      );

      expect(html).toContain('Welcome to Plan Smart');
    });

    it('should include verify button', () => {
      const html = renderToStaticMarkup(
        <VerificationEmail
          verificationUrl="https://example.com/verify"
          email="user@example.com"
        />
      );

      expect(html).toContain('Verify Email Address');
    });

    it('should include expiration notice', () => {
      const html = renderToStaticMarkup(
        <VerificationEmail
          verificationUrl="https://example.com/verify"
          email="user@example.com"
        />
      );

      expect(html).toContain('expire in 24 hours');
    });

    it('should include support email', () => {
      const html = renderToStaticMarkup(
        <VerificationEmail
          verificationUrl="https://example.com/verify"
          email="user@example.com"
        />
      );

      expect(html).toContain('support@plansmart.app');
    });
  });

  describe('PasswordResetEmail', () => {
    it('should render with reset URL', () => {
      const html = renderToStaticMarkup(
        <PasswordResetEmail
          resetUrl="https://example.com/reset?token=xyz789"
          email="user@example.com"
        />
      );

      expect(html).toContain('https://example.com/reset?token=xyz789');
    });

    it('should include user email in message', () => {
      const html = renderToStaticMarkup(
        <PasswordResetEmail
          resetUrl="https://example.com/reset"
          email="user@example.com"
        />
      );

      expect(html).toContain('user@example.com');
    });

    it('should include reset button', () => {
      const html = renderToStaticMarkup(
        <PasswordResetEmail
          resetUrl="https://example.com/reset"
          email="user@example.com"
        />
      );

      expect(html).toContain('Reset Password');
    });

    it('should include security notice about expiration', () => {
      const html = renderToStaticMarkup(
        <PasswordResetEmail
          resetUrl="https://example.com/reset"
          email="user@example.com"
        />
      );

      expect(html).toContain('expire in 1 hour');
    });

    it('should include security warning', () => {
      const html = renderToStaticMarkup(
        <PasswordResetEmail
          resetUrl="https://example.com/reset"
          email="user@example.com"
        />
      );

      expect(html).toContain('Security Notice');
    });

    it('should include support email', () => {
      const html = renderToStaticMarkup(
        <PasswordResetEmail
          resetUrl="https://example.com/reset"
          email="user@example.com"
        />
      );

      expect(html).toContain('support@plansmart.app');
    });
  });
});
