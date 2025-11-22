# Testing Row-Level Security (RLS) Policies

This guide explains how to test the Row-Level Security policies implemented in Phase 2 to ensure users can only access their own data.

## Prerequisites

1. ✅ Migrations have been run: `npm run db:migrate`
2. ✅ Database connection is working
3. ✅ `.env` file has correct `DATABASE_URL` (with `#` encoded as `%23` if present in password)

## What We're Testing

The RLS policies ensure:
- Users can only see their own `user_profile` record
- Users can only see their own `financial_snapshot` records
- Users can only see their own `plans` records
- Users CANNOT access another user's data, even with direct queries

## Method 1: Automated Test Script (Recommended)

Run the automated RLS test suite:

```bash
npm run db:test-rls
```

This script will:
1. Create two test users
2. Insert test data for both users
3. Verify each user can only see their own data
4. Attempt cross-user access (should fail)
5. Test the `updated_at` triggers
6. Clean up all test data

**Expected Output:**
```
🔒 Testing Row-Level Security Policies...

🧹 Cleaning up existing test data...
📝 Inserting test data for User 1 and User 2...
✅ Test data inserted

🔍 Test 1: Querying as User 1...
  User Profiles visible: 1 (expected: 1)
  Financial Snapshots visible: 1 (expected: 1)
  Plans visible: 1 (expected: 1)
  ✅ User 1 can see only their own profile

🔍 Test 2: Querying as User 2...
  User Profiles visible: 1 (expected: 1)
  Financial Snapshots visible: 1 (expected: 1)
  Plans visible: 1 (expected: 1)
  ✅ User 2 can see only their own profile

🔍 Test 3: User 1 trying to access User 2's data explicitly...
  ✅ RLS correctly blocked cross-user access

🔍 Test 4: Testing updated_at trigger...
  ✅ updated_at trigger is working correctly

🧹 Cleaning up test data...

✅ All RLS tests completed successfully!
```

## Method 2: Manual Testing via Supabase SQL Editor

### Step 1: Navigate to SQL Editor
Go to your Supabase project → **SQL Editor**

### Step 2: Create Test Users

First, check existing auth users:
```sql
SELECT id, email FROM auth.users LIMIT 5;
```

If you don't have any users yet, you can create them via Supabase Auth or insert test records directly.

### Step 3: Insert Test Data

Replace the UUIDs with actual user IDs from your `auth.users` table:

```sql
-- User 1 data
INSERT INTO user_profile (id, email, email_verified, onboarding_completed)
VALUES ('your-user-1-uuid-here', 'user1@test.com', true, false);

INSERT INTO financial_snapshot (user_id, birth_year, target_retirement_age, filing_status, annual_income, savings_rate, risk_tolerance)
VALUES ('your-user-1-uuid-here', 1985, 65, 'single', 75000.00, 15.00, 'moderate');

-- User 2 data
INSERT INTO user_profile (id, email, email_verified, onboarding_completed)
VALUES ('your-user-2-uuid-here', 'user2@test.com', true, false);

INSERT INTO financial_snapshot (user_id, birth_year, target_retirement_age, filing_status, annual_income, savings_rate, risk_tolerance)
VALUES ('your-user-2-uuid-here', 1990, 67, 'married', 95000.00, 20.00, 'aggressive');
```

### Step 4: Test RLS Policies

**Test as User 1:**
```sql
-- Set session context to User 1
SET request.jwt.claim.sub = 'your-user-1-uuid-here';

-- Should return only User 1's data
SELECT * FROM user_profile;
SELECT * FROM financial_snapshot;

-- Try to access User 2's data (should return EMPTY)
SELECT * FROM financial_snapshot
WHERE user_id = 'your-user-2-uuid-here';
```

**Test as User 2:**
```sql
-- Set session context to User 2
SET request.jwt.claim.sub = 'your-user-2-uuid-here';

-- Should return only User 2's data
SELECT * FROM user_profile;
SELECT * FROM financial_snapshot;

-- Try to access User 1's data (should return EMPTY)
SELECT * FROM financial_snapshot
WHERE user_id = 'your-user-1-uuid-here';
```

### Step 5: Verify Triggers

```sql
SET request.jwt.claim.sub = 'your-user-1-uuid-here';

-- Check current updated_at
SELECT id, email, updated_at FROM user_profile WHERE id = 'your-user-1-uuid-here';

-- Update the record
UPDATE user_profile
SET email_verified = true
WHERE id = 'your-user-1-uuid-here';

-- Verify updated_at changed
SELECT id, email, updated_at FROM user_profile WHERE id = 'your-user-1-uuid-here';
```

### Step 6: Clean Up

```sql
DELETE FROM user_profile WHERE email IN ('user1@test.com', 'user2@test.com');
```

## Method 3: Testing via Drizzle Studio

1. Start Drizzle Studio:
```bash
npm run db:studio
```

2. Open the browser at the displayed URL (usually `https://local.drizzle.studio`)

3. Browse the tables to verify:
   - ✅ Tables exist: `user_profile`, `financial_snapshot`, `plans`
   - ✅ Indexes exist: Check the schema view
   - ✅ Data structure matches schema definitions

**Note:** Drizzle Studio shows the raw database data without RLS filtering. For RLS testing, use Methods 1 or 2.

## Troubleshooting

### RLS Policies Not Working?

Check if RLS is enabled:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('user_profile', 'financial_snapshot', 'plans');
```

Should return `rowsecurity = true` for all three tables.

### Can't Connect to Database?

Verify your `DATABASE_URL` in `.env`:
- ✅ Special characters are URL-encoded (`#` → `%23`)
- ✅ Connection string is wrapped in quotes if it contains special characters
- ✅ Port is correct (usually `6543` for Supabase pooler)

Test connection:
```bash
npm run db:studio
```

### Policies Not Applying?

Check that policies exist:
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```

Should show policies like:
- `Users can only access their own profile`
- `Users can only access their own financial data`
- `Users can only access their own plans`

## Success Criteria

✅ Each user can see only their own records in all tables
✅ Cross-user queries return empty results (not errors)
✅ `updated_at` triggers update timestamps automatically
✅ Indexes exist and are being used
✅ Foreign key cascades work correctly

## Next Steps

Once all RLS tests pass, you can proceed to Phase 3: Vendor Abstraction Layer.
