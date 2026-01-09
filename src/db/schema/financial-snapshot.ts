import {
  pgTable,
  uuid,
  integer,
  numeric,
  text,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { userProfile } from './user-profile';

// Type definitions for JSONB columns
export type InvestmentAccountJson = {
  id: string;
  label: string;
  type: string;
  balance: number;
  monthlyContribution?: number;
};

export type DebtJson = {
  id: string;
  label: string;
  type: string;
  balance: number;
  interestRate?: number;
};

export type PrimaryResidenceJson = {
  estimatedValue?: number;
  mortgageBalance?: number;
  interestRate?: number;
};

export type IncomeExpensesJson = {
  monthlyEssential?: number;
  monthlyDiscretionary?: number;
};

export type IncomeStreamJson = {
  id: string;
  name: string;
  type: 'social_security' | 'pension' | 'rental' | 'annuity' | 'part_time' | 'other';
  annualAmount: number;
  startAge: number;
  endAge?: number;
  inflationAdjusted: boolean;
};

export type RealEstatePropertyJson = {
  id: string;
  name: string;
  type: 'primary' | 'rental' | 'vacation' | 'land';
  estimatedValue: number;
  mortgageBalance?: number;
  mortgageInterestRate?: number;
  // NOTE: Rental income is managed via Income Streams section, not here
};

export const financialSnapshot = pgTable('financial_snapshot', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => userProfile.id, { onDelete: 'cascade' }),

  // Financial data from onboarding (existing)
  birthYear: integer('birth_year').notNull(),
  stateOfResidence: text('state_of_residence'), // US state code (e.g., 'CA', 'TX')
  targetRetirementAge: integer('target_retirement_age').notNull(),
  filingStatus: text('filing_status').notNull(),
  annualIncome: numeric('annual_income', { precision: 12, scale: 2 }).notNull(),
  savingsRate: numeric('savings_rate', { precision: 5, scale: 2 }).notNull(),
  riskTolerance: text('risk_tolerance').notNull(),

  // Epic 2: New JSONB columns
  investmentAccounts: jsonb('investment_accounts').$type<InvestmentAccountJson[]>(),
  primaryResidence: jsonb('primary_residence').$type<PrimaryResidenceJson>(),
  debts: jsonb('debts').$type<DebtJson[]>(),
  incomeExpenses: jsonb('income_expenses').$type<IncomeExpensesJson>(),

  // Epic 3: Income streams for retirement
  incomeStreams: jsonb('income_streams').$type<IncomeStreamJson[]>(),

  // Real estate properties (multiple properties support)
  realEstateProperties: jsonb('real_estate_properties').$type<RealEstatePropertyJson[]>(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Row-Level Security Policy (applied via migration SQL)
// CREATE POLICY "Users can only access their own financial data"
//   ON financial_snapshot FOR ALL
//   USING (auth.uid() = user_id);
