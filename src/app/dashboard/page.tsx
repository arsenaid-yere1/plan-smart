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

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Check if user has completed onboarding
  const profiles = await db
    .select({ onboardingCompleted: userProfile.onboardingCompleted })
    .from(userProfile)
    .where(eq(userProfile.id, user.id))
    .limit(1);

  const profile = profiles[0];

  // Redirect to onboarding if not completed
  if (!profile || !profile.onboardingCompleted) {
    redirect('/onboarding');
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-8 shadow">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Welcome to Plan Smart
          </h1>
          <p className="mb-6 text-gray-600">
            Your dashboard is being built. Check back soon for your retirement
            planning tools.
          </p>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              Logged in as: {user.email}
            </p>
          </div>
          <form action="/api/auth/logout" method="POST" className="mt-6">
            <button
              type="submit"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
