import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const userProfile = pgTable('user_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  // Password hash stored by Supabase Auth
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),

  // Demographics (collected during onboarding)
  birthYear: text('birth_year'), // YYYY format
  filingStatus: text('filing_status'), // 'single' | 'married' | 'head_of_household'
});

// Row-Level Security Policy (applied via migration SQL)
// CREATE POLICY "Users can only access their own profile"
//   ON user_profile FOR ALL
//   USING (auth.uid() = id);
