import {
  pgTable,
  uuid,
  integer,
  numeric,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { userProfile } from './user-profile';

export const financialSnapshot = pgTable('financial_snapshot', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => userProfile.id, { onDelete: 'cascade' }),

  // Financial data from onboarding
  birthYear: integer('birth_year').notNull(), // e.g., 1985
  targetRetirementAge: integer('target_retirement_age').notNull(), // e.g., 65
  filingStatus: text('filing_status').notNull(), // 'single' | 'married' | 'head_of_household'
  annualIncome: numeric('annual_income', { precision: 12, scale: 2 }).notNull(), // e.g., 75000.00
  savingsRate: numeric('savings_rate', { precision: 5, scale: 2 }).notNull(), // Percentage, e.g., 15.00
  riskTolerance: text('risk_tolerance').notNull(), // 'conservative' | 'moderate' | 'aggressive'

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Row-Level Security Policy (applied via migration SQL)
// CREATE POLICY "Users can only access their own financial data"
//   ON financial_snapshot FOR ALL
//   USING (auth.uid() = user_id);
