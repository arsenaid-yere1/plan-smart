/**
 * E2E Test User Configuration
 *
 * These are the test users that need to exist in Supabase for E2E tests to pass.
 * Run the seed script before running E2E tests.
 */

export const TEST_USERS = {
  // Primary test user for login/dashboard tests
  primary: {
    email: 'test@example.com',
    password: 'SecurePassword123!',
    emailConfirmed: true,
  },
  // User for signup tests (will be created during test)
  signup: {
    emailPrefix: 'test+signup',
    password: 'SecurePassword123!',
  },
  // User with unverified email
  unverified: {
    email: 'unverified@example.com',
    password: 'SecurePassword123!',
    emailConfirmed: false,
  },
} as const;

export const TEST_CONFIG = {
  baseUrl: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
