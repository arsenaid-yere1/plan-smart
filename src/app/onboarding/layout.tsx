import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { db } from '@/db/client';
import { userProfile } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function getUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  // Middleware already handles unauthenticated users,
  // but we double-check here for safety
  if (!user) {
    redirect('/auth/login');
  }

  // Check if user has already completed onboarding
  const profiles = await db
    .select({ onboardingCompleted: userProfile.onboardingCompleted })
    .from(userProfile)
    .where(eq(userProfile.id, user.id))
    .limit(1);

  const profile = profiles[0];

  // If onboarding is already completed, redirect to plans page
  if (profile?.onboardingCompleted) {
    redirect('/plans');
  }

  return <>{children}</>;
}
