/**
 * Playwright Global Setup
 *
 * This file runs once before all tests to ensure test data exists.
 * It uses the Supabase Admin API to create/verify test users.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TEST_USERS, TEST_CONFIG } from './test-users';

async function globalSetup() {
  console.log('\n🔧 Setting up E2E test environment...\n');

  // Check for required environment variables
  if (!TEST_CONFIG.supabaseUrl) {
    console.warn('⚠️  NEXT_PUBLIC_SUPABASE_URL not set - skipping test user setup');
    console.warn('   E2E tests may fail if test users do not exist.\n');
    return;
  }

  if (!TEST_CONFIG.supabaseServiceKey) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set - skipping test user setup');
    console.warn('   E2E tests may fail if test users do not exist.');
    console.warn('   To enable automatic test user creation, set SUPABASE_SERVICE_ROLE_KEY\n');
    return;
  }

  // Create admin client with service role key
  const supabase = createClient(
    TEST_CONFIG.supabaseUrl,
    TEST_CONFIG.supabaseServiceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // Setup primary test user
  await ensureTestUser(supabase, TEST_USERS.primary);

  // Setup unverified test user
  await ensureTestUser(supabase, TEST_USERS.unverified);

  console.log('✅ E2E test environment ready\n');
}

async function ensureTestUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  user: { email: string; password: string; emailConfirmed: boolean }
) {
  try {
    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === user.email);

    if (existingUser) {
      console.log(`  ✓ Test user exists: ${user.email}`);

      // Update email confirmation status if needed
      if (user.emailConfirmed && !existingUser.email_confirmed_at) {
        await supabase.auth.admin.updateUserById(existingUser.id, {
          email_confirm: true,
        });
        console.log(`    → Email confirmed for ${user.email}`);
      }
      return;
    }

    // Create user
    const { error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: user.emailConfirmed,
    });

    if (error) {
      console.error(`  ✗ Failed to create ${user.email}: ${error.message}`);
      return;
    }

    console.log(`  ✓ Created test user: ${user.email}`);
  } catch (err) {
    console.error(`  ✗ Error setting up ${user.email}:`, err);
  }
}

export default globalSetup;
