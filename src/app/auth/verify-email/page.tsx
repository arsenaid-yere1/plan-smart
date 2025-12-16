'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [status, setStatus] = useState<'waiting' | 'loading' | 'success' | 'error'>(
    token ? 'loading' : 'waiting'
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    // If no token, we're in "waiting" mode - user just signed up
    if (!token) {
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.message || 'Verification failed. Please try again.');
        }
      } catch {
        setStatus('error');
        setMessage('An error occurred. Please try again.');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-8 text-center">
        {status === 'waiting' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-foreground">
              Check your email
            </h1>
            <p className="mb-6 text-muted-foreground">
              We&apos;ve sent a verification link to{' '}
              {email ? (
                <span className="font-medium text-foreground">{email}</span>
              ) : (
                'your email address'
              )}
              . Click the link in the email to verify your account.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Didn&apos;t receive the email? Check your spam folder.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/login">Back to Login</Link>
            </Button>
          </>
        )}

        {status === 'loading' && (
          <>
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <h1 className="mb-2 text-2xl font-bold text-foreground">
              Verifying your email...
            </h1>
            <p className="text-muted-foreground">
              Please wait while we verify your email address.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-foreground">
              Email Verified!
            </h1>
            <p className="mb-6 text-muted-foreground">{message}</p>
            <Button asChild className="w-full">
              <Link href="/auth/login">Continue to Login</Link>
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-foreground">
              Verification Failed
            </h1>
            <p className="mb-6 text-muted-foreground">{message}</p>
            <Button asChild className="w-full">
              <Link href="/auth/signup">Back to Sign Up</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
        <h1 className="mb-2 text-2xl font-bold text-foreground">Loading...</h1>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<LoadingFallback />}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
