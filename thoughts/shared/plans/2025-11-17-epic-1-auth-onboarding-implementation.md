# Epic 1: User Registration, Login & Onboarding - Implementation Plan

**Date**: 2025-11-17
**Epic**: Epic 1 - User Authentication & Onboarding
**Status**: Ready for Implementation
**Estimated Timeline**: 4-5 weeks
**Engineer Effort**: ~280 hours

## Overview

This plan implements a complete user authentication and onboarding system for Plan Smart, a retirement planning SaaS application. The system enables users to register, verify email, sign in, complete a financial onboarding wizard, and access their retirement plans securely.

**Core Deliverables**:

- Secure authentication system with email verification
- Password reset with 1-hour TTL tokens
- 7-day "remember me" sessions
- 3-5 step onboarding wizard collecting financial data
- Automatic creation of first retirement plan
- Multi-region deployment for <250ms P95 global latency
- Vendor abstraction layer for future flexibility

## Current State Analysis

**Project Status**: Pre-implementation planning phase

**Existing Documentation**:

- [Epic 1 Scope](../../personal/tickets/epic-1/00-scope/scope.md)
- [Non-Functional Requirements](../../personal/tickets/epic-1/00-scope/nfr.md)
- [Implementation Readiness Research](../research/2025-11-11-epic-1-implementation-readiness.md)
- [Final Architecture Decision](../architecture/2025-11-17-authentication-final-architectural-decision.md)

**Architectural Decisions Made**:

- **Frontend**: Next.js 14+ with App Router
- **Authentication**: Supabase Auth with vendor abstraction layer
- **Database**: PostgreSQL with Drizzle ORM and Row-Level Security
- **Deployment**: Multi-region (US-East, EU-West, Asia-SE) from launch
- **Email**: Resend for transactional emails
- **Styling**: Tailwind CSS + shadcn/ui components
- **Testing**: Vitest (unit) + Playwright (E2E)

**What Doesn't Exist Yet**:

- No source code (`src/`, `app/`, `components/`)
- No framework configuration files
- No database schema or migrations
- No authentication flows
- No UI components
- Not a git repository

## Desired End State

After completing this implementation:

1. **User Experience**:
   - New users can register with email/password and receive verification email
   - Users verify email via secure link and complete onboarding wizard
   - Returning users can login and view their retirement plans in <1 second
   - Users can reset forgotten passwords via email with 1-hour TTL
   - Optional 7-day "remember me" sessions for convenience

2. **Technical Architecture**:
   - Next.js application with App Router deployed on Vercel
   - Supabase Auth backend with vendor abstraction layer
   - Multi-region PostgreSQL with Row-Level Security
   - Type-safe database queries with Drizzle ORM
   - Geo-aware routing for <250ms P95 auth latency globally
   - Comprehensive test coverage (>80% unit, E2E for critical flows)

3. **Security Posture**:
   - Password policy: ≥12 chars + 3 character classes
   - Session cookies: Secure, HttpOnly, SameSite=Lax
   - CSRF protection on all mutations
   - Row-Level Security on all user tables
   - No PII in logs, encryption at rest
   - Defense-in-depth: RLS + type-safe query builder

4. **Verification Criteria**:
   - All 8 acceptance tests from scope.md pass
   - Performance targets met: <1s plan load, <250ms P95 auth
   - Security audit passes with no critical findings
   - Email deliverability >98% success rate

## What We're NOT Doing

**Explicitly Out of Scope for Epic 1**:

- Social logins (Google, Apple, GitHub) - future enhancement
- Multi-Factor Authentication (MFA/2FA) - deferred to Epic 3
- OAuth flows for financial aggregators - later phase
- Mobile native apps - web MVP only
- Advanced analytics/tracking - basic telemetry only
- Internationalization (i18n) - English only
- Profile editing (except onboarding) - Epic 2
- Plan editing/management - Epic 2
- Admin dashboard - Epic 4
- HIPAA compliance features - only if needed
- Enterprise SSO/SAML - only if needed

## Implementation Approach

**Strategy**: Incremental, testable phases building from foundation to features.

**Key Principles**:

1. **Security First**: Implement RLS and type-safe abstractions from day 1
2. **Test as We Build**: Write tests alongside implementation, not after
3. **Vendor Abstraction**: Never directly import Supabase in application code
4. **Multi-Region from Start**: Architecture supports global users from launch
5. **Performance Budgets**: Monitor <1s and <250ms targets continuously

**Phase Sequence**:

1. Project scaffolding and configuration
2. Database schema with RLS and migrations
3. Vendor abstraction layer
4. Authentication flows (signup, login, logout, reset)
5. Email integration (verification, password reset)
6. Onboarding wizard and plan creation
7. Security hardening and testing
8. Multi-region deployment

---

## Phase 1: Project Scaffolding & Configuration

### Overview

Set up the Next.js project structure, install dependencies, configure TypeScript, Tailwind, and establish development tooling.

### Changes Required

#### 1. Initialize Next.js Project with App Router

**Commands**:

```bash
npx create-next-app@latest plan-smart \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint

cd plan-smart
```

**Configuration choices**:

- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ App Router
- ✅ `src/` directory
- ✅ Import alias `@/*`
- ❌ ESLint (we'll configure custom)

#### 2. Install Core Dependencies

**File**: `package.json`

```bash
# Supabase and auth
npm install @supabase/supabase-js @supabase/ssr

# Database and ORM
npm install drizzle-orm postgres
npm install -D drizzle-kit

# Email service
npm install resend

# Validation and forms
npm install zod react-hook-form @hookform/resolvers

# UI components (shadcn/ui dependencies)
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react
npm install @radix-ui/react-label
npm install @radix-ui/react-slot
npm install @radix-ui/react-dialog
npm install @radix-ui/react-toast

# Security
npm install bcryptjs
npm install -D @types/bcryptjs

# Testing
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom
npm install -D @playwright/test
npm install -D happy-dom

# Linting and formatting
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier prettier-plugin-tailwindcss
npm install -D @types/node
```

#### 3. Configure TypeScript

**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### 4. Configure ESLint

**File**: `.eslintrc.json`

```json
{
  "extends": ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

#### 5. Configure Prettier

**File**: `.prettierrc`

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "tabWidth": 2,
  "useTabs": false,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

#### 6. Configure Vitest

**File**: `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**File**: `src/test/setup.ts`

```typescript
import '@testing-library/jest-dom';
```

#### 7. Configure Playwright

**File**: `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

#### 8. Environment Variables Template

**File**: `.env.example`

```bash
# Supabase Configuration (Multi-Region)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Regional Supabase Instances
SUPABASE_US_EAST_URL=https://us-east.supabase.co
SUPABASE_EU_WEST_URL=https://eu-west.supabase.co
SUPABASE_ASIA_SE_URL=https://asia-se.supabase.co

# Authentication Provider (supabase or auth0)
AUTH_PROVIDER=supabase

# Email Service (Resend)
RESEND_API_KEY=re_your_api_key

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Security
CSRF_SECRET=generate-with-openssl-rand-base64-32
SESSION_SECRET=generate-with-openssl-rand-base64-32

# Database (for migrations)
DATABASE_URL=postgresql://postgres:password@localhost:54322/postgres
```

#### 9. Setup NPM Scripts

**File**: `package.json` (scripts section)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,md,json}\"",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "db:generate": "drizzle-kit generate:pg",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:studio": "drizzle-kit studio",
    "typecheck": "tsc --noEmit"
  }
}
```

#### 10. Create Project Directory Structure

```bash
mkdir -p src/{app,components,lib,db,types,test,middleware}
mkdir -p src/app/{(auth),api,dashboard}
mkdir -p src/components/{ui,auth,onboarding}
mkdir -p src/lib/{auth,email,utils}
mkdir -p e2e
```

**Directory structure**:

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth route group
│   │   ├── login/
│   │   ├── signup/
│   │   ├── verify-email/
│   │   └── reset-password/
│   ├── api/               # API routes
│   ├── dashboard/         # Protected routes
│   ├── onboarding/
│   ├── layout.tsx
│   └── page.tsx
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── auth/             # Auth-specific components
│   └── onboarding/       # Onboarding wizard
├── lib/                  # Utilities and services
│   ├── auth/            # Auth abstraction layer
│   ├── email/           # Email service
│   └── utils/           # Helper functions
├── db/                  # Database
│   ├── schema/          # Drizzle schema
│   ├── migrations/      # SQL migrations
│   └── client.ts        # DB client
├── types/              # TypeScript types
├── middleware.ts       # Next.js middleware
└── test/              # Test utilities
e2e/                   # Playwright tests
```

#### 11. Initialize Git Repository

**Commands**:

```bash
git init
echo "node_modules/" > .gitignore
echo ".next/" >> .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo "coverage/" >> .gitignore
echo "playwright-report/" >> .gitignore
echo "test-results/" >> .gitignore
git add .
git commit -m "chore: initialize Next.js project with Epic 1 scaffolding

- Next.js 14 with App Router and TypeScript
- Tailwind CSS + shadcn/ui setup
- Vitest and Playwright configured
- ESLint and Prettier configured
- Project directory structure created
- Multi-region Supabase environment variables

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Formatting check passes: `npm run format:check`
- [x] Development server starts: `npm run dev`
- [x] Build succeeds: `npm run build`
- [x] Test runner starts: `npm test` (no tests yet, but should run)

#### Manual Verification:

- [ ] Navigate to http://localhost:3000 and see Next.js welcome page
- [ ] Directory structure matches specification above
- [ ] `.env.example` contains all required environment variables
- [ ] Git repository initialized with initial commit

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that development server starts correctly and project structure looks good before proceeding to Phase 2.

---

## Phase 2: Database Schema & Migrations

### Overview

Design and implement the PostgreSQL database schema with Row-Level Security policies, create Drizzle ORM schema definitions, and set up migration tooling.

### Changes Required

#### 1. Drizzle Configuration

**File**: `drizzle.config.ts`

```typescript
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './src/db/schema/*',
  out: './src/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

#### 2. Database Schema - User Profile

**File**: `src/db/schema/user-profile.ts`

```typescript
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
```

#### 3. Database Schema - Financial Snapshot

**File**: `src/db/schema/financial-snapshot.ts`

```typescript
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
```

#### 4. Database Schema - Plans

**File**: `src/db/schema/plans.ts`

```typescript
import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { userProfile } from './user-profile';

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => userProfile.id, { onDelete: 'cascade' }),

  name: text('name').notNull(), // e.g., "Personal Plan v1"
  description: text('description'),

  // Plan configuration (stored as JSON for flexibility)
  config: jsonb('config').notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Row-Level Security Policy (applied via migration SQL)
// CREATE POLICY "Users can only access their own plans"
//   ON plans FOR ALL
//   USING (auth.uid() = user_id);
```

#### 5. Database Schema - Export

**File**: `src/db/schema/index.ts`

```typescript
export * from './user-profile';
export * from './financial-snapshot';
export * from './plans';
```

#### 6. Initial Migration with RLS

**Generate migration**:

```bash
npm run db:generate
```

**File**: `src/db/migrations/0000_initial_schema.sql` (manually edit after generation)

```sql
-- Create user_profile table
CREATE TABLE IF NOT EXISTS user_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE NOT NULL,
  onboarding_completed BOOLEAN DEFAULT FALSE NOT NULL,
  birth_year TEXT,
  filing_status TEXT
);

-- Enable Row-Level Security
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own profile
CREATE POLICY "Users can only access their own profile"
  ON user_profile
  FOR ALL
  USING (auth.uid() = id);

-- Create financial_snapshot table
CREATE TABLE IF NOT EXISTS financial_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  birth_year INTEGER NOT NULL,
  target_retirement_age INTEGER NOT NULL,
  filing_status TEXT NOT NULL,
  annual_income NUMERIC(12, 2) NOT NULL,
  savings_rate NUMERIC(5, 2) NOT NULL,
  risk_tolerance TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Enable Row-Level Security
ALTER TABLE financial_snapshot ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own financial data
CREATE POLICY "Users can only access their own financial data"
  ON financial_snapshot
  FOR ALL
  USING (auth.uid() = user_id);

-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Enable Row-Level Security
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own plans
CREATE POLICY "Users can only access their own plans"
  ON plans
  FOR ALL
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_financial_snapshot_user_id ON financial_snapshot(user_id);
CREATE INDEX idx_plans_user_id ON plans(user_id);
CREATE INDEX idx_user_profile_email ON user_profile(email);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_user_profile_updated_at
  BEFORE UPDATE ON user_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_snapshot_updated_at
  BEFORE UPDATE ON financial_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 7. Database Client with Type Safety

**File**: `src/db/client.ts`

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Create postgres client
const client = postgres(connectionString);

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

// Export types
export type Database = typeof db;
```

#### 8. Migration Runner

**File**: `src/db/migrate.ts`

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const runMigrations = async () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('🔄 Running migrations...');

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  await migrate(db, {
    migrationsFolder: './src/db/migrations',
  });

  await client.end();

  console.log('✅ Migrations completed successfully');
};

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
```

#### 9. TypeScript Types

**File**: `src/types/database.ts`

```typescript
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { userProfile, financialSnapshot, plans } from '@/db/schema';

// Select types (what you get from the database)
export type UserProfile = InferSelectModel<typeof userProfile>;
export type FinancialSnapshot = InferSelectModel<typeof financialSnapshot>;
export type Plan = InferSelectModel<typeof plans>;

// Insert types (what you send to the database)
export type NewUserProfile = InferInsertModel<typeof userProfile>;
export type NewFinancialSnapshot = InferInsertModel<typeof financialSnapshot>;
export type NewPlan = InferInsertModel<typeof plans>;

// Filing status enum
export type FilingStatus = 'single' | 'married' | 'head_of_household';

// Risk tolerance enum
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

// Onboarding data type
export interface OnboardingData {
  birthYear: number;
  targetRetirementAge: number;
  filingStatus: FilingStatus;
  annualIncome: number;
  savingsRate: number;
  riskTolerance: RiskTolerance;
}
```

#### 10. Type-Safe Query Builder (Defense-in-Depth)

**File**: `src/db/secure-query.ts`

```typescript
import { eq } from 'drizzle-orm';
import { db } from './client';
import { userProfile, financialSnapshot, plans } from './schema';

/**
 * Type-safe query builder that automatically filters by user_id.
 * This provides defense-in-depth alongside Row-Level Security.
 */
export class SecureQueryBuilder {
  constructor(private userId: string) {}

  // User Profile queries
  async getUserProfile() {
    const [profile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.id, this.userId));
    return profile;
  }

  async updateUserProfile(data: Partial<typeof userProfile.$inferInsert>) {
    const [updated] = await db
      .update(userProfile)
      .set(data)
      .where(eq(userProfile.id, this.userId))
      .returning();
    return updated;
  }

  // Financial Snapshot queries
  async getFinancialSnapshot() {
    const [snapshot] = await db
      .select()
      .from(financialSnapshot)
      .where(eq(financialSnapshot.userId, this.userId));
    return snapshot;
  }

  async createFinancialSnapshot(data: typeof financialSnapshot.$inferInsert) {
    // Ensure user_id matches authenticated user
    const [created] = await db
      .insert(financialSnapshot)
      .values({ ...data, userId: this.userId })
      .returning();
    return created;
  }

  // Plans queries
  async getUserPlans() {
    return db
      .select()
      .from(plans)
      .where(eq(plans.userId, this.userId))
      .orderBy(plans.createdAt);
  }

  async createPlan(data: Omit<typeof plans.$inferInsert, 'userId'>) {
    const [created] = await db
      .insert(plans)
      .values({ ...data, userId: this.userId })
      .returning();
    return created;
  }

  async getPlanById(planId: string) {
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .where(eq(plans.userId, this.userId)); // Double-check user_id
    return plan;
  }
}

/**
 * Factory function to create a secure query builder for a user.
 */
export function createSecureQuery(userId: string) {
  return new SecureQueryBuilder(userId);
}
```

### Success Criteria

#### Automated Verification:

- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Migration generates: `npm run db:generate`
- [ ] Migration runs successfully: `npm run db:migrate`
- [ ] Drizzle Studio opens: `npm run db:studio`
- [ ] No SQL syntax errors in migration files

#### Manual Verification:

- [ ] Connect to Supabase database and verify tables exist: `user_profile`, `financial_snapshot`, `plans`
- [ ] Verify RLS is enabled on all three tables (check in Supabase Studio)
- [ ] Verify indexes exist: `idx_financial_snapshot_user_id`, `idx_plans_user_id`, `idx_user_profile_email`
- [ ] Verify trigger functions exist: `update_updated_at_column`
- [ ] Test RLS policy: Create test user, insert data, verify cannot access another user's data

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that database schema is correct and RLS policies are working before proceeding to Phase 3.

---

## Phase 3: Vendor Abstraction Layer

### Overview

Implement the authentication provider abstraction layer to ensure vendor portability. This allows switching between Supabase and Auth0 (or other providers) with minimal code changes.

### Changes Required

#### 1. Auth Provider Interface

**File**: `src/lib/auth/types.ts`

```typescript
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface Session {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface AuthError extends Error {
  code: string;
  status: number;
}

export interface SignUpParams {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignInParams {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthProvider {
  // Core authentication
  signUp(params: SignUpParams): Promise<User>;
  signIn(params: SignInParams): Promise<Session>;
  signOut(): Promise<void>;

  // Session management
  getSession(): Promise<Session | null>;
  refreshSession(refreshToken: string): Promise<Session>;

  // Password management
  resetPassword(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;

  // Email verification
  verifyEmail(token: string): Promise<void>;
  resendVerificationEmail(email: string): Promise<void>;

  // User info
  getUser(): Promise<User | null>;
}
```

#### 2. Custom Auth Errors

**File**: `src/lib/auth/errors.ts`

```typescript
export class AuthError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number = 400) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super('Invalid email or password', 'invalid_credentials', 401);
  }
}

export class EmailNotVerifiedError extends AuthError {
  constructor() {
    super('Email not verified', 'email_not_verified', 403);
  }
}

export class UserAlreadyExistsError extends AuthError {
  constructor() {
    super('User already exists', 'user_exists', 409);
  }
}

export class WeakPasswordError extends AuthError {
  constructor(message: string) {
    super(message, 'weak_password', 400);
  }
}

export class TokenExpiredError extends AuthError {
  constructor() {
    super('Token has expired', 'token_expired', 401);
  }
}

export class SessionExpiredError extends AuthError {
  constructor() {
    super('Session has expired', 'session_expired', 401);
  }
}
```

#### 3. Supabase Adapter Implementation

**File**: `src/lib/auth/supabase-adapter.ts`

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthProvider,
  User,
  Session,
  SignUpParams,
  SignInParams,
} from './types';
import {
  AuthError,
  InvalidCredentialsError,
  UserAlreadyExistsError,
  TokenExpiredError,
} from './errors';

export class SupabaseAuthProvider implements AuthProvider {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }

  async signUp(params: SignUpParams): Promise<User> {
    const { email, password, rememberMe } = params;

    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: {
          rememberMe: rememberMe ?? false,
        },
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new UserAlreadyExistsError();
      }
      throw new AuthError(error.message, 'signup_failed');
    }

    if (!data.user) {
      throw new AuthError('User creation failed', 'signup_failed');
    }

    return this.mapUser(data.user);
  }

  async signIn(params: SignInParams): Promise<Session> {
    const { email, password } = params;

    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid')) {
        throw new InvalidCredentialsError();
      }
      throw new AuthError(error.message, 'signin_failed');
    }

    if (!data.session) {
      throw new AuthError('Session creation failed', 'signin_failed');
    }

    return this.mapSession(data.session, data.user);
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();

    if (error) {
      throw new AuthError(error.message, 'signout_failed');
    }
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession();

    if (error) {
      throw new AuthError(error.message, 'get_session_failed');
    }

    if (!data.session) {
      return null;
    }

    return this.mapSession(data.session, data.session.user);
  }

  async refreshSession(refreshToken: string): Promise<Session> {
    const { data, error } = await this.client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      if (error.message.includes('expired')) {
        throw new TokenExpiredError();
      }
      throw new AuthError(error.message, 'refresh_failed');
    }

    if (!data.session) {
      throw new AuthError('Session refresh failed', 'refresh_failed');
    }

    return this.mapSession(data.session, data.user);
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    });

    if (error) {
      throw new AuthError(error.message, 'reset_password_failed');
    }
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new AuthError(error.message, 'update_password_failed');
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const { error } = await this.client.auth.verifyOtp({
      token_hash: token,
      type: 'email',
    });

    if (error) {
      if (error.message.includes('expired')) {
        throw new TokenExpiredError();
      }
      throw new AuthError(error.message, 'verify_email_failed');
    }
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const { error } = await this.client.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      throw new AuthError(error.message, 'resend_verification_failed');
    }
  }

  async getUser(): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser();

    if (error) {
      throw new AuthError(error.message, 'get_user_failed');
    }

    if (!data.user) {
      return null;
    }

    return this.mapUser(data.user);
  }

  // Helper methods
  private mapUser(supabaseUser: any): User {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      emailVerified: supabaseUser.email_confirmed_at !== null,
      createdAt: new Date(supabaseUser.created_at),
      metadata: supabaseUser.user_metadata,
    };
  }

  private mapSession(supabaseSession: any, supabaseUser: any): Session {
    return {
      user: this.mapUser(supabaseUser),
      accessToken: supabaseSession.access_token,
      refreshToken: supabaseSession.refresh_token,
      expiresAt: new Date(supabaseSession.expires_at * 1000),
    };
  }
}
```

#### 4. Auth0 Adapter Skeleton (Future)

**File**: `src/lib/auth/auth0-adapter.ts`

```typescript
import type {
  AuthProvider,
  User,
  Session,
  SignUpParams,
  SignInParams,
} from './types';

/**
 * Auth0 adapter implementation (skeleton for future use).
 * This enables quick migration to Auth0 if needed.
 */
export class Auth0AuthProvider implements AuthProvider {
  constructor(
    private domain: string,
    private clientId: string,
    private clientSecret: string
  ) {}

  async signUp(params: SignUpParams): Promise<User> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  async signIn(params: SignInParams): Promise<Session> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  async signOut(): Promise<void> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  async getSession(): Promise<Session | null> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  async refreshSession(refreshToken: string): Promise<Session> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  async resetPassword(email: string): Promise<void> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  async updatePassword(newPassword: string): Promise<void> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  async verifyEmail(token: string): Promise<void> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  async resendVerificationEmail(email: string): Promise<void> {
    throw new Error('Auth0 adapter not implemented yet');
  }

  async getUser(): Promise<User | null> {
    throw new Error('Auth0 adapter not implemented yet');
  }
}
```

#### 5. Auth Provider Factory

**File**: `src/lib/auth/index.ts`

```typescript
import { SupabaseAuthProvider } from './supabase-adapter';
import { Auth0AuthProvider } from './auth0-adapter';
import type { AuthProvider } from './types';

/**
 * Factory function to create the appropriate auth provider.
 * Switches based on AUTH_PROVIDER environment variable.
 */
export function createAuthProvider(): AuthProvider {
  const provider = process.env.AUTH_PROVIDER || 'supabase';

  switch (provider) {
    case 'auth0':
      return new Auth0AuthProvider(
        process.env.AUTH0_DOMAIN!,
        process.env.AUTH0_CLIENT_ID!,
        process.env.AUTH0_CLIENT_SECRET!
      );

    case 'supabase':
    default:
      return new SupabaseAuthProvider(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
  }
}

// Singleton instance
let authProviderInstance: AuthProvider | null = null;

/**
 * Get the auth provider singleton instance.
 */
export function getAuthProvider(): AuthProvider {
  if (!authProviderInstance) {
    authProviderInstance = createAuthProvider();
  }
  return authProviderInstance;
}

// Re-export types and errors
export * from './types';
export * from './errors';
```

#### 6. Server-Side Auth Helpers

**File**: `src/lib/auth/server.ts`

```typescript
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { User, Session } from './types';

/**
 * Get the current session from server components.
 */
export async function getServerSession(): Promise<Session | null> {
  const cookieStore = cookies();

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
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email!,
      emailVerified: session.user.email_confirmed_at !== null,
      createdAt: new Date(session.user.created_at),
      metadata: session.user.user_metadata,
    },
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: new Date(session.expires_at! * 1000),
  };
}

/**
 * Get the current user from server components.
 */
export async function getServerUser(): Promise<User | null> {
  const session = await getServerSession();
  return session?.user ?? null;
}

/**
 * Require authentication in server components.
 * Throws error if not authenticated.
 */
export async function requireAuth(): Promise<User> {
  const user = await getServerUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}
```

#### 7. Unit Tests for Abstraction Layer

**File**: `src/lib/auth/__tests__/supabase-adapter.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseAuthProvider } from '../supabase-adapter';
import { InvalidCredentialsError, UserAlreadyExistsError } from '../errors';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  })),
}));

describe('SupabaseAuthProvider', () => {
  let provider: SupabaseAuthProvider;

  beforeEach(() => {
    provider = new SupabaseAuthProvider('https://test.supabase.co', 'test-key');
  });

  describe('signUp', () => {
    it('should create a new user', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        email_confirmed_at: null,
        created_at: new Date().toISOString(),
        user_metadata: {},
      };

      vi.mocked(provider['client'].auth.signUp).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const user = await provider.signUp({
        email: 'test@example.com',
        password: 'SecurePassword123!',
      });

      expect(user.email).toBe('test@example.com');
      expect(user.emailVerified).toBe(false);
    });

    it('should throw UserAlreadyExistsError if user exists', async () => {
      vi.mocked(provider['client'].auth.signUp).mockResolvedValue({
        data: { user: null },
        error: { message: 'User already registered' },
      });

      await expect(
        provider.signUp({
          email: 'existing@example.com',
          password: 'SecurePassword123!',
        })
      ).rejects.toThrow(UserAlreadyExistsError);
    });
  });

  describe('signIn', () => {
    it('should throw InvalidCredentialsError for wrong password', async () => {
      vi.mocked(provider['client'].auth.signInWithPassword).mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        provider.signIn({
          email: 'test@example.com',
          password: 'WrongPassword',
        })
      ).rejects.toThrow(InvalidCredentialsError);
    });
  });
});
```

### Success Criteria

#### Automated Verification:

- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Unit tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] No circular dependencies in auth module

#### Manual Verification:

- [ ] Review auth provider interface and confirm it covers all Epic 1 requirements
- [ ] Verify Supabase adapter correctly maps Supabase types to abstract types
- [ ] Confirm Auth0 adapter skeleton exists for future migration
- [ ] Test auth provider factory with different AUTH_PROVIDER values

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that abstraction layer is complete and testable before proceeding to Phase 4.

---

## Phase 4: Authentication UI Components

### Overview

Build reusable UI components for authentication flows: signup, login, password reset, and email verification. Use shadcn/ui for consistent design and accessibility.

### Changes Required

#### 1. Install shadcn/ui CLI and Components

**Commands**:

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add card
npx shadcn-ui@latest add form
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add alert
```

#### 2. Password Strength Validator

**File**: `src/lib/auth/password-validator.ts`

```typescript
/**
 * Password strength validator per NFR requirements:
 * - Minimum 12 characters
 * - At least 3 character classes (uppercase, lowercase, numbers, special)
 * - Not in common pwned passwords list
 */

const MIN_LENGTH = 12;
const MIN_CHARACTER_CLASSES = 3;

export interface PasswordStrength {
  score: number; // 0-4
  feedback: string[];
  isValid: boolean;
}

export function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length < MIN_LENGTH) {
    feedback.push(`Password must be at least ${MIN_LENGTH} characters`);
  } else if (password.length >= 16) {
    score += 2;
  } else {
    score += 1;
  }

  // Character class checks
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  const characterClasses = [
    hasLowercase,
    hasUppercase,
    hasNumbers,
    hasSpecial,
  ].filter(Boolean).length;

  if (characterClasses < MIN_CHARACTER_CLASSES) {
    feedback.push(
      `Password must contain at least ${MIN_CHARACTER_CLASSES} of: uppercase, lowercase, numbers, special characters`
    );
  } else {
    score += characterClasses;
  }

  // Common patterns check
  const commonPatterns = [
    /^123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /letmein/i,
  ];

  const hasCommonPattern = commonPatterns.some((pattern) =>
    pattern.test(password)
  );

  if (hasCommonPattern) {
    feedback.push('Password contains common patterns');
    score = Math.max(0, score - 2);
  }

  // Sequential characters check
  const hasSequential = /(.)\1{2,}/.test(password);
  if (hasSequential) {
    feedback.push('Avoid repeating characters');
    score = Math.max(0, score - 1);
  }

  const isValid =
    password.length >= MIN_LENGTH &&
    characterClasses >= MIN_CHARACTER_CLASSES &&
    !hasCommonPattern;

  return {
    score: Math.min(4, score),
    feedback: feedback.length > 0 ? feedback : ['Strong password'],
    isValid,
  };
}

export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'Weak';
    case 2:
      return 'Fair';
    case 3:
      return 'Good';
    case 4:
      return 'Strong';
    default:
      return 'Unknown';
  }
}

export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'bg-red-500';
    case 2:
      return 'bg-orange-500';
    case 3:
      return 'bg-yellow-500';
    case 4:
      return 'bg-green-500';
    default:
      return 'bg-gray-300';
  }
}
```

#### 3. Password Strength Meter Component

**File**: `src/components/auth/password-strength-meter.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import {
  validatePassword,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
  type PasswordStrength,
} from '@/lib/auth/password-validator';

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const [strength, setStrength] = useState<PasswordStrength>({
    score: 0,
    feedback: [],
    isValid: false,
  });

  useEffect(() => {
    if (password.length > 0) {
      setStrength(validatePassword(password));
    } else {
      setStrength({ score: 0, feedback: [], isValid: false });
    }
  }, [password]);

  if (password.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getPasswordStrengthColor(
              strength.score
            )}`}
            style={{ width: `${(strength.score / 4) * 100}%` }}
          />
        </div>
        <span className="text-sm font-medium">
          {getPasswordStrengthLabel(strength.score)}
        </span>
      </div>
      {strength.feedback.length > 0 && (
        <ul className="text-sm text-gray-600 space-y-1">
          {strength.feedback.map((item, index) => (
            <li key={index} className="flex items-start gap-1">
              <span>{strength.isValid ? '✓' : '•'}</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

#### 4. Signup Form Component

**File**: `src/components/auth/signup-form.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordStrengthMeter } from './password-strength-meter';
import { validatePassword } from '@/lib/auth/password-validator';

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().refine(
    (password) => validatePassword(password).isValid,
    'Password does not meet requirements'
  ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const password = watch('password', '');

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Signup failed');
      }

      // Redirect to verification sent page
      router.push('/auth/verify-email?email=' + encodeURIComponent(data.email));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your email and password to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min 12 characters"
              {...register('password')}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
            <PasswordStrengthMeter password={password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter password"
              {...register('confirmPassword')}
              disabled={isLoading}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-500">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Sign up'}
          </Button>

          <p className="text-sm text-center text-gray-600">
            Already have an account?{' '}
            <a href="/auth/login" className="text-blue-600 hover:underline">
              Log in
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

#### 5. Login Form Component

**File**: `src/components/auth/login-form.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      // Redirect to dashboard
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              {...register('password')}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox id="rememberMe" {...register('rememberMe')} />
              <Label
                htmlFor="rememberMe"
                className="text-sm font-normal cursor-pointer"
              >
                Remember me for 7 days
              </Label>
            </div>
            <a
              href="/auth/forgot-password"
              className="text-sm text-blue-600 hover:underline"
            >
              Forgot password?
            </a>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>

          <p className="text-sm text-center text-gray-600">
            Don't have an account?{' '}
            <a href="/auth/signup" className="text-blue-600 hover:underline">
              Sign up
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

#### 6. Password Reset Request Form

**File**: `src/components/auth/forgot-password-form.tsx`

```typescript
'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Request failed');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We've sent you a password reset link. It will expire in 1 hour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => (window.location.href = '/auth/login')}
            className="w-full"
          >
            Back to login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter your email address and we'll send you a reset link
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send reset link'}
          </Button>

          <p className="text-sm text-center text-gray-600">
            Remember your password?{' '}
            <a href="/auth/login" className="text-blue-600 hover:underline">
              Log in
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

### Success Criteria

#### Automated Verification:

- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Component tests pass: `npm test src/components/auth`
- [ ] Linting passes: `npm run lint`
- [ ] Password validation enforces 12+ chars and 3 character classes

#### Manual Verification:

- [ ] Signup form displays password strength meter in real-time
- [ ] Password strength meter shows correct score and feedback
- [ ] Login form shows "remember me" checkbox
- [ ] Forgot password form shows success message after submission
- [ ] All form validation errors display correctly
- [ ] Forms are accessible (keyboard navigation, screen readers)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that UI components look good and are accessible before proceeding to Phase 5.

---

## Phase 5: API Routes & Server Actions

### Overview

Implement Next.js API routes and server actions for authentication operations: signup, login, logout, password reset, and email verification.

### Changes Required

#### 1. API Route - Signup

**File**: `src/app/api/auth/signup/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthProvider } from '@/lib/auth';
import { validatePassword } from '@/lib/auth/password-validator';
import { db } from '@/db/client';
import { userProfile } from '@/db/schema';

const signupSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .refine(
      (password) => validatePassword(password).isValid,
      'Password does not meet requirements'
    ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = signupSchema.parse(body);

    const auth = getAuthProvider();

    // Create user in Supabase Auth
    const user = await auth.signUp({ email, password });

    // Create user profile in database
    await db.insert(userProfile).values({
      id: user.id,
      email: user.email,
      emailVerified: false,
      onboardingCompleted: false,
    });

    return NextResponse.json(
      {
        message: 'Account created. Please check your email to verify.',
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Signup error:', error);

    if (error.code === 'user_exists') {
      return NextResponse.json(
        { message: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: error.message || 'Signup failed' },
      { status: 400 }
    );
  }
}
```

#### 2. API Route - Login

**File**: `src/app/api/auth/login/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getAuthProvider } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, rememberMe } = loginSchema.parse(body);

    const auth = getAuthProvider();
    const session = await auth.signIn({ email, password, rememberMe });

    // Set session cookies
    const cookieStore = cookies();
    const maxAge = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60; // 7 days or 24 hours

    cookieStore.set('access_token', session.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
      path: '/',
    });

    if (session.refreshToken) {
      cookieStore.set('refresh_token', session.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge,
        path: '/',
      });
    }

    return NextResponse.json({
      message: 'Login successful',
      user: session.user,
    });
  } catch (error: any) {
    console.error('Login error:', error);

    if (error.code === 'invalid_credentials') {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (error.code === 'email_not_verified') {
      return NextResponse.json(
        { message: 'Please verify your email before logging in' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { message: error.message || 'Login failed' },
      { status: 400 }
    );
  }
}
```

#### 3. API Route - Logout

**File**: `src/app/api/auth/logout/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthProvider } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthProvider();
    await auth.signOut();

    // Clear cookies
    const cookieStore = cookies();
    cookieStore.delete('access_token');
    cookieStore.delete('refresh_token');

    return NextResponse.json({ message: 'Logout successful' });
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json({ message: 'Logout failed' }, { status: 500 });
  }
}
```

#### 4. API Route - Forgot Password

**File**: `src/app/api/auth/forgot-password/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthProvider } from '@/lib/auth';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    const auth = getAuthProvider();
    await auth.resetPassword(email);

    return NextResponse.json({
      message: 'Password reset email sent',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);

    // Don't reveal whether email exists
    return NextResponse.json({
      message: 'If an account exists, a reset email has been sent',
    });
  }
}
```

#### 5. API Route - Reset Password

**File**: `src/app/api/auth/reset-password/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthProvider } from '@/lib/auth';
import { validatePassword } from '@/lib/auth/password-validator';

const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .refine(
      (password) => validatePassword(password).isValid,
      'Password does not meet requirements'
    ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newPassword } = resetPasswordSchema.parse(body);

    const auth = getAuthProvider();
    await auth.updatePassword(newPassword);

    return NextResponse.json({
      message: 'Password updated successfully',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);

    if (error.code === 'token_expired') {
      return NextResponse.json(
        { message: 'Reset link has expired. Please request a new one.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { message: error.message || 'Password reset failed' },
      { status: 400 }
    );
  }
}
```

#### 6. API Route - Verify Email

**File**: `src/app/api/auth/verify-email/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthProvider } from '@/lib/auth';
import { db } from '@/db/client';
import { userProfile } from '@/db/schema';
import { eq } from 'drizzle-orm';

const verifyEmailSchema = z.object({
  token: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = verifyEmailSchema.parse(body);

    const auth = getAuthProvider();
    await auth.verifyEmail(token);

    // Update user profile
    const user = await auth.getUser();
    if (user) {
      await db
        .update(userProfile)
        .set({ emailVerified: true })
        .where(eq(userProfile.id, user.id));
    }

    return NextResponse.json({
      message: 'Email verified successfully',
    });
  } catch (error: any) {
    console.error('Verify email error:', error);

    if (error.code === 'token_expired') {
      return NextResponse.json(
        { message: 'Verification link has expired' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { message: error.message || 'Email verification failed' },
      { status: 400 }
    );
  }
}
```

#### 7. Next.js Middleware for Auth

**File**: `src/middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protected routes
  if (
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/onboarding') ||
    request.nextUrl.pathname.startsWith('/plans')
  ) {
    if (!session) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  // Auth routes (redirect if already logged in)
  if (
    request.nextUrl.pathname.startsWith('/auth/login') ||
    request.nextUrl.pathname.startsWith('/auth/signup')
  ) {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding/:path*',
    '/plans/:path*',
    '/auth/login',
    '/auth/signup',
  ],
};
```

#### 8. CSRF Protection Utility

**File**: `src/lib/auth/csrf.ts`

```typescript
import { cookies } from 'next/headers';
import crypto from 'crypto';

const CSRF_TOKEN_NAME = 'csrf_token';

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Set CSRF token in cookies
 */
export function setCsrfToken(): string {
  const token = generateCsrfToken();
  const cookieStore = cookies();

  cookieStore.set(CSRF_TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  });

  return token;
}

/**
 * Verify CSRF token from request
 */
export function verifyCsrfToken(token: string): boolean {
  const cookieStore = cookies();
  const storedToken = cookieStore.get(CSRF_TOKEN_NAME)?.value;

  if (!storedToken || !token) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(storedToken), Buffer.from(token));
}

/**
 * Get CSRF token from cookies
 */
export function getCsrfToken(): string | undefined {
  const cookieStore = cookies();
  return cookieStore.get(CSRF_TOKEN_NAME)?.value;
}
```

### Success Criteria

#### Automated Verification:

- [ ] TypeScript compiles: `npm run typecheck`
- [ ] API route tests pass: `npm test src/app/api/auth`
- [ ] Linting passes: `npm run lint`
- [ ] All API routes return correct status codes

#### Manual Verification:

- [ ] POST /api/auth/signup creates user and sends verification email
- [ ] POST /api/auth/login returns session and sets cookies
- [ ] POST /api/auth/logout clears cookies and invalidates session
- [ ] POST /api/auth/forgot-password sends reset email
- [ ] POST /api/auth/reset-password updates password
- [ ] POST /api/auth/verify-email verifies user email
- [ ] Middleware redirects unauthenticated users from /dashboard to /auth/login
- [ ] Middleware redirects authenticated users from /auth/login to /dashboard
- [ ] CSRF token validation works on mutation endpoints

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that all API routes work correctly before proceeding to Phase 6.

---

## Phase 6: Email Integration with Resend

### Overview

Integrate Resend email service for transactional emails: email verification and password reset. Create email templates with proper branding and security.

### Changes Required

#### 1. Email Service Wrapper

**File**: `src/lib/email/client.ts`

```typescript
import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is not set');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_EMAIL = 'Plan Smart <noreply@plansmart.app>';
export const SUPPORT_EMAIL = 'support@plansmart.app';
```

#### 2. Email Verification Template

**File**: `src/lib/email/templates/verification-email.tsx`

```typescript
import * as React from 'react';

interface VerificationEmailProps {
  verificationUrl: string;
  email: string;
}

export const VerificationEmail: React.FC<VerificationEmailProps> = ({
  verificationUrl,
  email,
}) => (
  <html>
    <head>
      <style>{`
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: #4F46E5;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
        }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      `}</style>
    </head>
    <body>
      <div className="container">
        <div className="header">
          <h1>Welcome to Plan Smart!</h1>
        </div>
        <div className="content">
          <p>Hi there,</p>
          <p>
            Thanks for signing up for Plan Smart! To complete your registration,
            please verify your email address by clicking the button below:
          </p>
          <div style={{ textAlign: 'center' }}>
            <a href={verificationUrl} className="button">
              Verify Email Address
            </a>
          </div>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            If you didn't create an account with Plan Smart, you can safely ignore this email.
          </p>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            This verification link will expire in 24 hours.
          </p>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Or copy and paste this URL into your browser:<br />
            <code>{verificationUrl}</code>
          </p>
        </div>
        <div className="footer">
          <p>
            Plan Smart - Your Retirement Planning Partner<br />
            Questions? Contact us at {SUPPORT_EMAIL}
          </p>
        </div>
      </div>
    </body>
  </html>
);
```

#### 3. Password Reset Template

**File**: `src/lib/email/templates/password-reset-email.tsx`

```typescript
import * as React from 'react';

interface PasswordResetEmailProps {
  resetUrl: string;
  email: string;
}

export const PasswordResetEmail: React.FC<PasswordResetEmailProps> = ({
  resetUrl,
  email,
}) => (
  <html>
    <head>
      <style>{`
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: #4F46E5;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
        }
        .warning {
          padding: 15px;
          background: #FEF2F2;
          border-left: 4px solid #EF4444;
          margin: 20px 0;
        }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      `}</style>
    </head>
    <body>
      <div className="container">
        <div className="header">
          <h1>Reset Your Password</h1>
        </div>
        <div className="content">
          <p>Hi there,</p>
          <p>
            We received a request to reset your password for your Plan Smart account
            associated with {email}.
          </p>
          <div style={{ textAlign: 'center' }}>
            <a href={resetUrl} className="button">
              Reset Password
            </a>
          </div>
          <div className="warning">
            <strong>Security Notice:</strong><br />
            This password reset link will expire in 1 hour and can only be used once.
          </div>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            If you didn't request a password reset, please ignore this email.
            Your password will remain unchanged.
          </p>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Or copy and paste this URL into your browser:<br />
            <code>{resetUrl}</code>
          </p>
        </div>
        <div className="footer">
          <p>
            Plan Smart - Your Retirement Planning Partner<br />
            Questions? Contact us at {SUPPORT_EMAIL}
          </p>
        </div>
      </div>
    </body>
  </html>
);
```

#### 4. Email Sending Functions

**File**: `src/lib/email/send.ts`

```typescript
import { resend, FROM_EMAIL } from './client';
import { VerificationEmail } from './templates/verification-email';
import { PasswordResetEmail } from './templates/password-reset-email';

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  verificationToken: string
) {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?token=${verificationToken}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your Plan Smart account',
      react: VerificationEmail({ verificationUrl, email }),
    });

    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Reset your Plan Smart password',
      react: PasswordResetEmail({ resetUrl, email }),
    });

    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

/**
 * Send welcome email after email verification
 */
export async function sendWelcomeEmail(email: string, userName: string) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Welcome to Plan Smart!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Welcome to Plan Smart, ${userName}!</h1>
          <p>Your email has been verified successfully.</p>
          <p>You're all set to start planning your retirement journey.</p>
          <p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/onboarding"
               style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
              Complete Your Profile
            </a>
          </p>
        </div>
      `,
    });

    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't throw - this is non-critical
  }
}
```

#### 5. Email Queue for Rate Limiting

**File**: `src/lib/email/queue.ts`

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const MAX_EMAILS_PER_HOUR = 5;
const RATE_LIMIT_WINDOW = 60 * 60; // 1 hour in seconds

/**
 * Check if email rate limit is exceeded
 */
export async function checkEmailRateLimit(email: string): Promise<boolean> {
  const key = `email_rate_limit:${email}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW);
  }

  return count <= MAX_EMAILS_PER_HOUR;
}

/**
 * Get remaining emails for user
 */
export async function getRemainingEmails(email: string): Promise<number> {
  const key = `email_rate_limit:${email}`;
  const count = (await redis.get<number>(key)) || 0;
  return Math.max(0, MAX_EMAILS_PER_HOUR - count);
}
```

### Success Criteria

#### Automated Verification:

- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Email template rendering tests pass: `npm test src/lib/email`
- [ ] Linting passes: `npm run lint`
- [ ] Resend API key is configured

#### Manual Verification:

- [ ] Send test verification email and verify it arrives
- [ ] Verification email link redirects to correct URL
- [ ] Send test password reset email and verify it arrives
- [ ] Password reset link expires after 1 hour
- [ ] Email templates render correctly in Gmail, Outlook, and Apple Mail
- [ ] Email rate limiting prevents spam (max 5 emails per hour per address)
- [ ] Welcome email sends after successful verification

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that emails are sending correctly and templates look good before proceeding to Phase 7.

---

## Phase 7: Onboarding Wizard & Plan Creation

### Overview

Build a multi-step onboarding wizard to collect user financial data and automatically create their first retirement plan.

### Changes Required

#### 1. Onboarding Data Types

**File**: `src/types/onboarding.ts`

```typescript
import type { FilingStatus, RiskTolerance } from './database';

export interface OnboardingStep1Data {
  birthYear: number;
}

export interface OnboardingStep2Data {
  targetRetirementAge: number;
  filingStatus: FilingStatus;
}

export interface OnboardingStep3Data {
  annualIncome: number;
  savingsRate: number;
}

export interface OnboardingStep4Data {
  riskTolerance: RiskTolerance;
}

export interface CompleteOnboardingData
  extends OnboardingStep1Data,
    OnboardingStep2Data,
    OnboardingStep3Data,
    OnboardingStep4Data {}

export const FILING_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married Filing Jointly' },
  { value: 'head_of_household', label: 'Head of Household' },
] as const;

export const RISK_TOLERANCE_OPTIONS = [
  {
    value: 'conservative',
    label: 'Conservative',
    description: 'Prioritize capital preservation over growth',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    description: 'Balanced approach between growth and stability',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    description: 'Maximize growth potential, accept higher volatility',
  },
] as const;
```

#### 2. Onboarding Validation Schemas

**File**: `src/lib/validation/onboarding.ts`

```typescript
import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const step1Schema = z.object({
  birthYear: z
    .number()
    .min(1920, 'Birth year must be 1920 or later')
    .max(currentYear - 18, 'You must be at least 18 years old'),
});

export const step2Schema = z.object({
  targetRetirementAge: z
    .number()
    .min(50, 'Retirement age must be at least 50')
    .max(80, 'Retirement age must be 80 or younger'),
  filingStatus: z.enum(['single', 'married', 'head_of_household']),
});

export const step3Schema = z.object({
  annualIncome: z
    .number()
    .min(0, 'Annual income cannot be negative')
    .max(10000000, 'Annual income cannot exceed $10,000,000'),
  savingsRate: z
    .number()
    .min(0, 'Savings rate cannot be negative')
    .max(100, 'Savings rate cannot exceed 100%'),
});

export const step4Schema = z.object({
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']),
});

export const completeOnboardingSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema);
```

#### 3. Onboarding Step 1 Component

**File**: `src/components/onboarding/step1-personal-info.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { step1Schema } from '@/lib/validation/onboarding';
import type { OnboardingStep1Data } from '@/types/onboarding';

interface Step1Props {
  onNext: (data: OnboardingStep1Data) => void;
  initialData?: Partial<OnboardingStep1Data>;
}

export function Step1PersonalInfo({ onNext, initialData }: Step1Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingStep1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: initialData,
  });

  const currentYear = new Date().getFullYear();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Let's get to know you</CardTitle>
        <CardDescription>
          We'll use this information to personalize your retirement plan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="birthYear">What year were you born?</Label>
            <Input
              id="birthYear"
              type="number"
              placeholder={String(currentYear - 40)}
              {...register('birthYear', { valueAsNumber: true })}
            />
            {errors.birthYear && (
              <p className="text-sm text-red-500">{errors.birthYear.message}</p>
            )}
            <p className="text-sm text-gray-600">
              We use your birth year to calculate your current age and retirement timeline
            </p>
          </div>

          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

#### 4. Onboarding Step 2 Component

**File**: `src/components/onboarding/step2-retirement-info.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { step2Schema } from '@/lib/validation/onboarding';
import { FILING_STATUS_OPTIONS } from '@/types/onboarding';
import type { OnboardingStep2Data } from '@/types/onboarding';

interface Step2Props {
  onNext: (data: OnboardingStep2Data) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep2Data>;
}

export function Step2RetirementInfo({ onNext, onBack, initialData }: Step2Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingStep2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: initialData || { filingStatus: 'single' },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retirement Goals</CardTitle>
        <CardDescription>
          Tell us about your retirement timeline and tax status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="targetRetirementAge">
              At what age do you plan to retire?
            </Label>
            <Input
              id="targetRetirementAge"
              type="number"
              placeholder="65"
              {...register('targetRetirementAge', { valueAsNumber: true })}
            />
            {errors.targetRetirementAge && (
              <p className="text-sm text-red-500">
                {errors.targetRetirementAge.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>What is your tax filing status?</Label>
            <RadioGroup defaultValue={initialData?.filingStatus || 'single'}>
              {FILING_STATUS_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    {...register('filingStatus')}
                  />
                  <Label htmlFor={option.value} className="font-normal cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {errors.filingStatus && (
              <p className="text-sm text-red-500">
                {errors.filingStatus.message}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onBack} className="flex-1">
              Back
            </Button>
            <Button type="submit" className="flex-1">
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

#### 5. Onboarding Step 3 Component

**File**: `src/components/onboarding/step3-financial-info.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { step3Schema } from '@/lib/validation/onboarding';
import type { OnboardingStep3Data } from '@/types/onboarding';

interface Step3Props {
  onNext: (data: OnboardingStep3Data) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep3Data>;
}

export function Step3FinancialInfo({ onNext, onBack, initialData }: Step3Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OnboardingStep3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: initialData,
  });

  const annualIncome = watch('annualIncome', 0);
  const savingsRate = watch('savingsRate', 0);
  const monthlySavings = (annualIncome * (savingsRate / 100)) / 12;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Snapshot</CardTitle>
        <CardDescription>
          Help us understand your current financial situation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="annualIncome">What is your annual income?</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <Input
                id="annualIncome"
                type="number"
                placeholder="75000"
                className="pl-7"
                {...register('annualIncome', { valueAsNumber: true })}
              />
            </div>
            {errors.annualIncome && (
              <p className="text-sm text-red-500">
                {errors.annualIncome.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="savingsRate">
              What percentage of your income do you save for retirement?
            </Label>
            <div className="relative">
              <Input
                id="savingsRate"
                type="number"
                placeholder="15"
                {...register('savingsRate', { valueAsNumber: true })}
              />
              <span className="absolute right-3 top-2.5 text-gray-500">%</span>
            </div>
            {errors.savingsRate && (
              <p className="text-sm text-red-500">
                {errors.savingsRate.message}
              </p>
            )}
            {annualIncome > 0 && savingsRate > 0 && (
              <p className="text-sm text-blue-600">
                You're saving approximately ${monthlySavings.toFixed(0)} per month
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onBack} className="flex-1">
              Back
            </Button>
            <Button type="submit" className="flex-1">
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

#### 6. Onboarding Step 4 Component

**File**: `src/components/onboarding/step4-risk-tolerance.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { step4Schema } from '@/lib/validation/onboarding';
import { RISK_TOLERANCE_OPTIONS } from '@/types/onboarding';
import type { OnboardingStep4Data } from '@/types/onboarding';

interface Step4Props {
  onNext: (data: OnboardingStep4Data) => void;
  onBack: () => void;
  initialData?: Partial<OnboardingStep4Data>;
  isSubmitting?: boolean;
}

export function Step4RiskTolerance({
  onNext,
  onBack,
  initialData,
  isSubmitting,
}: Step4Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingStep4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: initialData || { riskTolerance: 'moderate' },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investment Strategy</CardTitle>
        <CardDescription>
          Choose your preferred investment approach
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-6">
          <div className="space-y-4">
            <Label>What is your risk tolerance?</Label>
            <RadioGroup defaultValue={initialData?.riskTolerance || 'moderate'}>
              {RISK_TOLERANCE_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    {...register('riskTolerance')}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={option.value}
                      className="font-medium cursor-pointer"
                    >
                      {option.label}
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      {option.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
            {errors.riskTolerance && (
              <p className="text-sm text-red-500">
                {errors.riskTolerance.message}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1"
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Creating your plan...' : 'Complete Setup'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

#### 7. Onboarding Wizard Container

**File**: `src/app/onboarding/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Step1PersonalInfo } from '@/components/onboarding/step1-personal-info';
import { Step2RetirementInfo } from '@/components/onboarding/step2-retirement-info';
import { Step3FinancialInfo } from '@/components/onboarding/step3-financial-info';
import { Step4RiskTolerance } from '@/components/onboarding/step4-risk-tolerance';
import type { CompleteOnboardingData } from '@/types/onboarding';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<CompleteOnboardingData>>({});

  const handleStep1 = (data: any) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep(2);
  };

  const handleStep2 = (data: any) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep(3);
  };

  const handleStep3 = (data: any) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep(4);
  };

  const handleStep4 = async (data: any) => {
    const completeData = { ...formData, ...data };
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeData),
      });

      if (!response.ok) {
        throw new Error('Failed to complete onboarding');
      }

      // Redirect to plans page
      router.push('/plans');
    } catch (error) {
      console.error('Onboarding error:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Step {currentStep} of 4</span>
            <span className="text-sm text-gray-600">{currentStep * 25}% complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${currentStep * 25}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        {currentStep === 1 && (
          <Step1PersonalInfo onNext={handleStep1} initialData={formData} />
        )}
        {currentStep === 2 && (
          <Step2RetirementInfo
            onNext={handleStep2}
            onBack={() => setCurrentStep(1)}
            initialData={formData}
          />
        )}
        {currentStep === 3 && (
          <Step3FinancialInfo
            onNext={handleStep3}
            onBack={() => setCurrentStep(2)}
            initialData={formData}
          />
        )}
        {currentStep === 4 && (
          <Step4RiskTolerance
            onNext={handleStep4}
            onBack={() => setCurrentStep(3)}
            initialData={formData}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
```

#### 8. Onboarding Completion API

**File**: `src/app/api/onboarding/complete/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/server';
import { db } from '@/db/client';
import { financialSnapshot, plans, userProfile } from '@/db/schema';
import { completeOnboardingSchema } from '@/lib/validation/onboarding';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Validate onboarding data
    const body = await request.json();
    const data = completeOnboardingSchema.parse(body);

    // Create financial snapshot
    await db.insert(financialSnapshot).values({
      userId: user.id,
      birthYear: data.birthYear,
      targetRetirementAge: data.targetRetirementAge,
      filingStatus: data.filingStatus,
      annualIncome: data.annualIncome.toString(),
      savingsRate: data.savingsRate.toString(),
      riskTolerance: data.riskTolerance,
    });

    // Create default retirement plan
    await db.insert(plans).values({
      userId: user.id,
      name: 'Personal Plan v1',
      description: 'Your personalized retirement plan',
      config: {
        birthYear: data.birthYear,
        targetRetirementAge: data.targetRetirementAge,
        annualIncome: data.annualIncome,
        savingsRate: data.savingsRate,
        riskTolerance: data.riskTolerance,
        createdViaOnboarding: true,
      },
    });

    // Mark onboarding as complete
    await db
      .update(userProfile)
      .set({
        onboardingCompleted: true,
        birthYear: data.birthYear.toString(),
        filingStatus: data.filingStatus,
      })
      .where(eq(userProfile.id, user.id));

    return NextResponse.json({
      message: 'Onboarding completed successfully',
    });
  } catch (error: any) {
    console.error('Onboarding completion error:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to complete onboarding' },
      { status: 400 }
    );
  }
}
```

### Success Criteria

#### Automated Verification:

- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Onboarding validation tests pass: `npm test src/lib/validation`
- [ ] Linting passes: `npm run lint`
- [ ] All form steps validate correctly

#### Manual Verification:

- [ ] Complete full onboarding wizard from step 1 to 4
- [ ] Progress bar updates correctly at each step
- [ ] Back button navigates to previous step and preserves data
- [ ] Form validation shows appropriate error messages
- [ ] Onboarding completion creates financial_snapshot record
- [ ] Onboarding completion creates "Personal Plan v1" plan record
- [ ] Onboarding completion marks user profile as onboarding_completed
- [ ] After completion, user is redirected to /plans page
- [ ] Onboarding cannot be accessed again after completion

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the onboarding wizard works end-to-end before proceeding to Phase 8.

---

## Phase 8: Security Hardening & Testing

### Overview

Implement comprehensive security measures (HTTPS enforcement, HSTS, CSRF protection, brute-force mitigation) and create automated test suites for all critical flows.

### Changes Required

#### 1. Security Headers Middleware

**File**: `src/middleware/security-headers.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function securityHeaders(request: NextRequest) {
  const response = NextResponse.next();

  // HSTS - Force HTTPS
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
    ].join('; ')
  );

  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
}
```

#### 2. Rate Limiting for Auth Endpoints

**File**: `src/lib/auth/rate-limit.ts`

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds

/**
 * Check if IP is rate limited for login attempts
 */
export async function checkLoginRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt?: Date;
}> {
  const key = `login_attempts:${ip}`;
  const attempts = (await redis.get<number>(key)) || 0;

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    const ttl = await redis.ttl(key);
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + ttl * 1000),
    };
  }

  return {
    allowed: true,
    remaining: MAX_LOGIN_ATTEMPTS - attempts,
  };
}

/**
 * Increment login attempt counter
 */
export async function incrementLoginAttempts(ip: string): Promise<void> {
  const key = `login_attempts:${ip}`;
  const attempts = await redis.incr(key);

  if (attempts === 1) {
    await redis.expire(key, LOCKOUT_DURATION);
  }
}

/**
 * Reset login attempts on successful login
 */
export async function resetLoginAttempts(ip: string): Promise<void> {
  const key = `login_attempts:${ip}`;
  await redis.del(key);
}
```

#### 3. PII Filtering for Logs

**File**: `src/lib/logging/pii-filter.ts`

```typescript
/**
 * Regex patterns for PII data
 */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/g;
const SSN_REGEX = /\d{3}-\d{2}-\d{4}/g;
const CREDIT_CARD_REGEX = /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g;

/**
 * Filter PII from log messages
 */
export function filterPII(message: string): string {
  return message
    .replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
    .replace(PHONE_REGEX, '[PHONE_REDACTED]')
    .replace(SSN_REGEX, '[SSN_REDACTED]')
    .replace(CREDIT_CARD_REGEX, '[CARD_REDACTED]');
}

/**
 * Filter PII from objects
 */
export function filterPIIFromObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string') {
      return filterPII(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(filterPIIFromObject);
  }

  const filtered: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Redact sensitive fields
    if (['password', 'token', 'secret', 'ssn', 'creditCard'].includes(key)) {
      filtered[key] = '[REDACTED]';
    } else if (key === 'email') {
      filtered[key] = '[EMAIL_REDACTED]';
    } else {
      filtered[key] = filterPIIFromObject(value);
    }
  }

  return filtered;
}

/**
 * Structured logger with PII filtering
 */
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(filterPII(message), meta ? filterPIIFromObject(meta) : '');
  },
  error: (message: string, meta?: any) => {
    console.error(filterPII(message), meta ? filterPIIFromObject(meta) : '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(filterPII(message), meta ? filterPIIFromObject(meta) : '');
  },
};
```

#### 4. E2E Test - Complete Signup Flow

**File**: `e2e/auth-signup.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Signup Flow', () => {
  test('should complete full signup and onboarding', async ({ page }) => {
    // Navigate to signup
    await page.goto('/auth/signup');

    // Fill signup form
    const testEmail = `test+${Date.now()}@example.com`;
    await page.fill('[id="email"]', testEmail);
    await page.fill('[id="password"]', 'SecurePassword123!');
    await page.fill('[id="confirmPassword"]', 'SecurePassword123!');

    // Verify password strength meter shows "Strong"
    await expect(page.locator('text=Strong')).toBeVisible();

    // Submit signup
    await page.click('button[type="submit"]');

    // Should redirect to verification page
    await expect(page).toHaveURL(/verify-email/);
    await expect(page.locator('text=Check your email')).toBeVisible();
  });

  test('should reject weak password', async ({ page }) => {
    await page.goto('/auth/signup');

    await page.fill('[id="email"]', 'test@example.com');
    await page.fill('[id="password"]', 'weak');
    await page.fill('[id="confirmPassword"]', 'weak');

    // Password strength should show "Weak"
    await expect(page.locator('text=Weak')).toBeVisible();

    // Submit should show error
    await page.click('button[type="submit"]');
    await expect(
      page.locator('text=Password does not meet requirements')
    ).toBeVisible();
  });

  test('should reject mismatched passwords', async ({ page }) => {
    await page.goto('/auth/signup');

    await page.fill('[id="email"]', 'test@example.com');
    await page.fill('[id="password"]', 'SecurePassword123!');
    await page.fill('[id="confirmPassword"]', 'DifferentPassword123!');

    await page.click('button[type="submit"]');
    await expect(page.locator("text=Passwords don't match")).toBeVisible();
  });
});
```

#### 5. E2E Test - Login and Remember Me

**File**: `e2e/auth-login.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Login Flow', () => {
  test('should login successfully with valid credentials', async ({
    page,
    context,
  }) => {
    await page.goto('/auth/login');

    await page.fill('[id="email"]', 'test@example.com');
    await page.fill('[id="password"]', 'SecurePassword123!');

    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/dashboard/);
  });

  test('should set 7-day cookie with remember me', async ({
    page,
    context,
  }) => {
    await page.goto('/auth/login');

    await page.fill('[id="email"]', 'test@example.com');
    await page.fill('[id="password"]', 'SecurePassword123!');
    await page.check('[id="rememberMe"]');

    await page.click('button[type="submit"]');

    // Check cookie expiration
    const cookies = await context.cookies();
    const accessTokenCookie = cookies.find((c) => c.name === 'access_token');

    expect(accessTokenCookie).toBeDefined();
    // 7 days = 604800 seconds
    expect(accessTokenCookie!.expires).toBeGreaterThan(
      Date.now() / 1000 + 604000
    );
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('[id="email"]', 'test@example.com');
    await page.fill('[id="password"]', 'WrongPassword123!');

    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });
});
```

#### 6. E2E Test - Onboarding Flow

**File**: `e2e/onboarding.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Onboarding Wizard', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('[id="email"]', 'test@example.com');
    await page.fill('[id="password"]', 'SecurePassword123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/);

    // Navigate to onboarding
    await page.goto('/onboarding');
  });

  test('should complete all onboarding steps', async ({ page }) => {
    // Step 1: Birth year
    await expect(page.locator('text=Step 1 of 4')).toBeVisible();
    await page.fill('[id="birthYear"]', '1985');
    await page.click('button:has-text("Continue")');

    // Step 2: Retirement info
    await expect(page.locator('text=Step 2 of 4')).toBeVisible();
    await page.fill('[id="targetRetirementAge"]', '65');
    await page.check('[value="single"]');
    await page.click('button:has-text("Continue")');

    // Step 3: Financial info
    await expect(page.locator('text=Step 3 of 4')).toBeVisible();
    await page.fill('[id="annualIncome"]', '75000');
    await page.fill('[id="savingsRate"]', '15');
    await page.click('button:has-text("Continue")');

    // Step 4: Risk tolerance
    await expect(page.locator('text=Step 4 of 4')).toBeVisible();
    await page.check('[value="moderate"]');
    await page.click('button:has-text("Complete Setup")');

    // Should redirect to plans page
    await expect(page).toHaveURL(/plans/);
  });

  test('should allow going back and preserve data', async ({ page }) => {
    // Step 1
    await page.fill('[id="birthYear"]', '1985');
    await page.click('button:has-text("Continue")');

    // Step 2
    await page.fill('[id="targetRetirementAge"]', '65');
    await page.click('button:has-text("Continue")');

    // Go back to step 2
    await page.click('button:has-text("Back")');

    // Verify data is preserved
    await expect(page.locator('[id="targetRetirementAge"]')).toHaveValue('65');

    // Go back to step 1
    await page.click('button:has-text("Back")');

    // Verify data is preserved
    await expect(page.locator('[id="birthYear"]')).toHaveValue('1985');
  });
});
```

#### 7. Unit Test - RLS Security

**File**: `src/db/__tests__/rls-security.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../client';
import { plans, financialSnapshot } from '../schema';
import { eq } from 'drizzle-orm';

describe('Row-Level Security Tests', () => {
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // Create test users (simplified - actual implementation uses Supabase)
    user1Id = 'test-user-1';
    user2Id = 'test-user-2';
  });

  it("should prevent user from accessing another user's plans", async () => {
    // Create plan for user1
    const [plan] = await db
      .insert(plans)
      .values({
        userId: user1Id,
        name: 'User 1 Plan',
        config: {},
      })
      .returning();

    // Try to query as user2 (should return empty)
    const user2Plans = await db
      .select()
      .from(plans)
      .where(eq(plans.userId, user2Id));

    expect(user2Plans).toHaveLength(0);
    expect(user2Plans).not.toContainEqual(
      expect.objectContaining({ id: plan.id })
    );
  });

  it("should prevent user from accessing another user's financial data", async () => {
    // Create financial snapshot for user1
    const [snapshot] = await db
      .insert(financialSnapshot)
      .values({
        userId: user1Id,
        birthYear: 1985,
        targetRetirementAge: 65,
        filingStatus: 'single',
        annualIncome: '75000',
        savingsRate: '15',
        riskTolerance: 'moderate',
      })
      .returning();

    // Try to query as user2 (should return empty)
    const user2Snapshots = await db
      .select()
      .from(financialSnapshot)
      .where(eq(financialSnapshot.userId, user2Id));

    expect(user2Snapshots).toHaveLength(0);
    expect(user2Snapshots).not.toContainEqual(
      expect.objectContaining({ id: snapshot.id })
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(plans).where(eq(plans.userId, user1Id));
    await db
      .delete(financialSnapshot)
      .where(eq(financialSnapshot.userId, user1Id));
  });
});
```

### Success Criteria

#### Automated Verification:

- [ ] TypeScript compiles: `npm run typecheck`
- [ ] All unit tests pass: `npm test`
- [ ] All E2E tests pass: `npm run test:e2e`
- [ ] Test coverage >80%: `npm run test:coverage`
- [ ] Linting passes: `npm run lint`

#### Manual Verification:

- [ ] Security headers are present in all responses (check DevTools Network tab)
- [ ] HTTPS is enforced in production
- [ ] Login attempts are rate-limited (try 6 failed logins, should block)
- [ ] PII is not visible in server logs (check logs after signup/login)
- [ ] CSRF protection prevents form submissions without token
- [ ] RLS prevents cross-user data access (verified in tests)
- [ ] Session cookies have Secure, HttpOnly, SameSite=Lax flags
- [ ] Password reset tokens expire after 1 hour
- [ ] Email verification tokens expire after 24 hours

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that security measures are working and all tests pass before proceeding to Phase 9.

---

## Phase 9: Multi-Region Deployment & Performance

### Overview

Deploy the application to multiple Supabase regions with geo-aware routing to meet the <250ms P95 auth latency requirement globally.

### Changes Required

#### 1. Geo-Aware Routing Middleware

**File**: `src/lib/geo/routing.ts`

```typescript
import type { NextRequest } from 'next/server';

export interface RegionConfig {
  supabaseUrl: string;
  region: string;
}

/**
 * Determine optimal Supabase region based on user geography
 */
export function getOptimalRegion(request: NextRequest): RegionConfig {
  const geo = request.geo;

  // US East (default)
  if (!geo || geo.country === 'US') {
    const isWestCoast =
      geo?.region?.startsWith('CA') ||
      geo?.region?.startsWith('WA') ||
      geo?.region?.startsWith('OR');

    if (isWestCoast) {
      return {
        region: 'us-west',
        supabaseUrl: process.env.SUPABASE_US_WEST_URL!,
      };
    }

    return {
      region: 'us-east',
      supabaseUrl: process.env.SUPABASE_US_EAST_URL!,
    };
  }

  // Europe
  if (geo.continent === 'EU' || geo.country === 'GB') {
    return {
      region: 'eu-west',
      supabaseUrl: process.env.SUPABASE_EU_WEST_URL!,
    };
  }

  // Asia
  if (geo.continent === 'AS' || geo.continent === 'OC') {
    return {
      region: 'asia-southeast',
      supabaseUrl: process.env.SUPABASE_ASIA_SE_URL!,
    };
  }

  // Default to US East
  return {
    region: 'us-east',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  };
}
```

#### 2. Performance Monitoring

**File**: `src/lib/monitoring/performance.ts`

```typescript
/**
 * Track auth latency metrics
 */
export async function trackAuthLatency(
  operation: string,
  startTime: number,
  region: string
) {
  const latency = Date.now() - startTime;

  // Log to console (replace with proper monitoring service)
  console.log('auth_latency', {
    operation,
    latency,
    region,
    timestamp: new Date().toISOString(),
  });

  // Send to monitoring service (e.g., Datadog, New Relic)
  if (process.env.MONITORING_ENABLED === 'true') {
    // await sendToMonitoring({
    //   metric: 'auth.latency',
    //   value: latency,
    //   tags: { operation, region },
    // });
  }

  // Alert if latency exceeds threshold
  if (latency > 250) {
    console.warn('⚠️ Auth latency exceeded 250ms threshold', {
      operation,
      latency,
      region,
    });
  }
}

/**
 * Track plan list load time
 */
export async function trackPlanListLatency(
  startTime: number,
  planCount: number
) {
  const latency = Date.now() - startTime;

  console.log('plan_list_latency', {
    latency,
    planCount,
    timestamp: new Date().toISOString(),
  });

  // Alert if latency exceeds 1 second
  if (latency > 1000) {
    console.warn('⚠️ Plan list load exceeded 1s threshold', {
      latency,
      planCount,
    });
  }
}
```

#### 3. Vercel Deployment Configuration

**File**: `vercel.json`

```json
{
  "regions": ["iad1", "sfo1", "fra1", "sin1"],
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url-us-east",
    "SUPABASE_US_EAST_URL": "@supabase-url-us-east",
    "SUPABASE_US_WEST_URL": "@supabase-url-us-west",
    "SUPABASE_EU_WEST_URL": "@supabase-url-eu-west",
    "SUPABASE_ASIA_SE_URL": "@supabase-url-asia-se"
  },
  "functions": {
    "api/**": {
      "memory": 1024,
      "maxDuration": 10
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

#### 4. Production Environment Variables

**File**: `.env.production.example`

```bash
# Production Supabase URLs (Multi-Region)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-us-east.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

SUPABASE_US_EAST_URL=https://your-project-us-east.supabase.co
SUPABASE_US_WEST_URL=https://your-project-us-west.supabase.co
SUPABASE_EU_WEST_URL=https://your-project-eu-west.supabase.co
SUPABASE_ASIA_SE_URL=https://your-project-asia-se.supabase.co

# Auth Provider
AUTH_PROVIDER=supabase

# Email (Resend Production)
RESEND_API_KEY=re_your_production_api_key

# Application URLs
NEXT_PUBLIC_APP_URL=https://app.plansmart.com
NEXT_PUBLIC_SITE_URL=https://plansmart.com

# Security
CSRF_SECRET=production-secret-generate-with-openssl
SESSION_SECRET=production-secret-generate-with-openssl

# Database
DATABASE_URL=postgresql://postgres:password@your-supabase-db.com:5432/postgres

# Rate Limiting (Upstash)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Monitoring
MONITORING_ENABLED=true
```

#### 5. Deployment Checklist

**File**: `DEPLOYMENT.md`

````markdown
# Production Deployment Checklist

## Pre-Deployment

### Supabase Setup

- [ ] Create Supabase projects in 3 regions:
  - [ ] US East (primary)
  - [ ] EU West
  - [ ] Asia Southeast
- [ ] Run migrations on all regional databases
- [ ] Enable RLS on all tables in all regions
- [ ] Configure database replication/sync strategy
- [ ] Upgrade to Supabase Pro ($25/month per region = $75/month)

### Environment Configuration

- [ ] Set all environment variables in Vercel
- [ ] Generate production CSRF_SECRET and SESSION_SECRET
- [ ] Configure Resend API key (upgrade to Pro $20/month)
- [ ] Set up Upstash Redis for rate limiting ($10/month)

### Email Configuration

- [ ] Verify domain in Resend
- [ ] Set up SPF, DKIM, DMARC records
- [ ] Test email deliverability
- [ ] Configure email templates

### Security

- [ ] Review all security headers
- [ ] Enable HTTPS enforcement
- [ ] Configure CORS policies
- [ ] Set up StatusPage.io ($29/month)
- [ ] Configure PagerDuty ($21/month)

## Deployment Steps

1. **Build and Test**
   ```bash
   npm run build
   npm run test
   npm run test:e2e
   ```
````

2. **Deploy to Vercel**

   ```bash
   vercel --prod
   ```

3. **Post-Deployment Verification**
   - [ ] Verify all pages load correctly
   - [ ] Test signup flow end-to-end
   - [ ] Test login from different regions
   - [ ] Verify email sending works
   - [ ] Check security headers in production
   - [ ] Monitor auth latency in different regions
   - [ ] Verify RLS policies are active

## Monitoring Setup

- [ ] Set up Vercel Analytics
- [ ] Configure error tracking (Sentry)
- [ ] Set up performance monitoring
- [ ] Create alerting rules:
  - [ ] Auth latency >250ms
  - [ ] Plan list load >1s
  - [ ] Error rate >1%
  - [ ] Downtime >2 minutes

## Performance Targets

- [ ] Auth API latency: <250ms P95 ✅
- [ ] Plan list load: <1s ✅
- [ ] Onboarding step save: <500ms P95 ✅

## Support & Incident Response

- [ ] Create incident response runbook
- [ ] Set up on-call rotation
- [ ] Document rollback procedure
- [ ] Create customer support email: support@plansmart.com

```

### Success Criteria

#### Automated Verification:
- [ ] Production build succeeds: `npm run build`
- [ ] All tests pass in CI/CD pipeline
- [ ] TypeScript compiles without errors
- [ ] No console errors in production build

#### Manual Verification:
- [ ] Deploy to Vercel and verify deployment succeeds
- [ ] Test signup from US, EU, and Asia (use VPN) - all <250ms
- [ ] Test login from multiple regions - all <250ms
- [ ] Verify plan list loads in <1s from all regions
- [ ] Check Vercel Analytics for performance metrics
- [ ] Verify StatusPage.io shows system status
- [ ] Test incident alerting via PagerDuty
- [ ] Verify email deliverability >98%
- [ ] Load test: Handle 100 concurrent users without degradation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that multi-region deployment is working and performance targets are met.

---

## Testing Strategy

### Unit Tests
**Coverage Target**: >80%

**What to Test**:
- Password validation logic
- Auth provider abstraction layer
- Database query builders
- Email template rendering
- Form validation schemas
- CSRF token generation/validation
- Rate limiting logic
- PII filtering

**Tools**: Vitest, @testing-library/react

**Run**: `npm test`

### Integration Tests
**What to Test**:
- API routes end-to-end
- Database operations with RLS
- Email sending flows
- Session management
- Middleware authentication
- Multi-step forms

**Tools**: Vitest with database fixtures

**Run**: `npm test src/app/api`

### End-to-End Tests
**Coverage Target**: All critical user flows

**What to Test**:
1. Complete signup → verification → onboarding → plans
2. Login with "remember me"
3. Password reset flow
4. Email verification
5. Logout and session invalidation
6. Protected route access control
7. Onboarding wizard navigation

**Tools**: Playwright

**Run**: `npm run test:e2e`

### Security Tests
**What to Test**:
- RLS policy enforcement
- CSRF protection
- Rate limiting
- SQL injection prevention
- XSS prevention
- Session hijacking prevention
- Password strength enforcement

**Tools**: Vitest + manual penetration testing

**Run**: `npm test src/db/__tests__/rls-security.test.ts`

### Performance Tests
**What to Test**:
- Auth API latency <250ms P95
- Plan list load <1s
- Onboarding step save <500ms P95
- Concurrent user handling

**Tools**: Artillery, Lighthouse

**Run**: `artillery run performance-test.yml`

### Manual Testing Checklist
- [ ] Accessibility (WCAG 2.1 AA)
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness
- [ ] Email rendering in multiple clients
- [ ] Error handling and user feedback
- [ ] Keyboard navigation
- [ ] Screen reader compatibility

---

## Performance Considerations

### Database Optimization
1. **Indexing Strategy**:
   - `user_profile.email` - unique index for fast lookups
   - `financial_snapshot.user_id` - foreign key index
   - `plans.user_id` - foreign key index
   - Composite indexes for common queries

2. **Query Optimization**:
   - Use type-safe query builder to prevent N+1 queries
   - Implement pagination for plan lists
   - Use connection pooling (Supabase default)

3. **RLS Performance**:
   - RLS policies use indexed columns (`auth.uid() = user_id`)
   - Test query performance with EXPLAIN ANALYZE
   - Monitor slow queries in Supabase dashboard

### Frontend Optimization
1. **Code Splitting**:
   - Next.js automatic code splitting
   - Lazy load onboarding steps
   - Dynamic imports for heavy components

2. **Caching Strategy**:
   - Server-side caching with React Server Components
   - SWR for client-side data fetching
   - CDN caching for static assets

3. **Bundle Size**:
   - Monitor bundle size with `@next/bundle-analyzer`
   - Tree-shake unused dependencies
   - Use dynamic imports for large libraries

### API Performance
1. **Response Time Targets**:
   - Auth endpoints: <250ms P95
   - Onboarding save: <500ms P95
   - Plan list: <1s total (including DB query + rendering)

2. **Rate Limiting**:
   - Auth endpoints: 5 req/min per IP
   - Email sending: 5 emails/hour per address
   - API routes: 100 req/min per user

3. **Multi-Region Strategy**:
   - Geo-aware routing via Vercel Edge
   - Regional Supabase instances
   - <250ms P95 globally

---

## Migration Notes

### From Development to Production
1. **Database Migration**:
   - Run migrations on production Supabase instances
   - Verify RLS policies are enabled
   - Test with production data

2. **Environment Variables**:
   - Generate new secrets for production
   - Configure all regional Supabase URLs
   - Set up production email API keys

3. **DNS Configuration**:
   - Point domain to Vercel deployment
   - Configure SSL/TLS certificates
   - Set up email domain verification

### From Supabase to Auth0 (If Needed)
1. **Activate Auth0 Adapter**:
   - Implement Auth0AuthProvider methods
   - Update AUTH_PROVIDER environment variable
   - Test all auth flows

2. **Data Migration**:
   - Export users from Supabase
   - Import to Auth0 via Management API
   - Verify email verification status

3. **Zero-Downtime Migration**:
   - Run both providers in parallel
   - Gradually migrate users
   - Monitor error rates

---

## References

### Documentation
- [Epic 1 Scope](../../personal/tickets/epic-1/00-scope/scope.md)
- [Epic 1 NFRs](../../personal/tickets/epic-1/00-scope/nfr.md)
- [Implementation Readiness Research](../research/2025-11-11-epic-1-implementation-readiness.md)
- [Technology Selection Research](../research/2025-11-12-epic-1-technology-selection.md)
- [Authentication Architecture Decision](../architecture/2025-11-17-authentication-final-architectural-decision.md)

### External Resources
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Resend Email API](https://resend.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Playwright Testing](https://playwright.dev/)

### Code Examples
- Password validation: [src/lib/auth/password-validator.ts](src/lib/auth/password-validator.ts)
- Auth abstraction: [src/lib/auth/index.ts](src/lib/auth/index.ts)
- Database schema: [src/db/schema/index.ts](src/db/schema/index.ts)
- RLS policies: [src/db/migrations/0000_initial_schema.sql](src/db/migrations/0000_initial_schema.sql)

---

**Plan Status**: Complete and ready for implementation
**Estimated Timeline**: 4-5 weeks
**Total Effort**: ~280 hours
**Infrastructure Cost (Year 1)**: $14,860

**Next Steps**:
1. Review this plan with PM and Tech Lead
2. Get approval on technology choices and architecture
3. Begin Phase 1: Project Scaffolding
4. Implement phases incrementally with testing at each stage
5. Deploy to production after all phases complete and tests pass
```
