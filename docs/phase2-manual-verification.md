# Phase 2 Manual Verification Checklist

## Quick Start

After fixing your DATABASE_URL (encode `#` as `%23`), run these commands:

```bash
# 1. Run migrations
npm run db:migrate

# 2. Run automated RLS tests
npm run db:test-rls

# 3. Open Drizzle Studio to inspect the database
npm run db:studio
```

## Manual Verification Checklist

### ✅ Database Connection

- [ ] Fixed `DATABASE_URL` in `.env` (special characters URL-encoded)
- [ ] Migrations run successfully: `npm run db:migrate`
- [ ] Can connect to database

### ✅ Tables Exist

Connect to Supabase and verify these tables exist:

- [ ] `user_profile` table exists
- [ ] `financial_snapshot` table exists
- [ ] `plans` table exists

**Via SQL:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_profile', 'financial_snapshot', 'plans');
```

### ✅ Row-Level Security Enabled

Verify RLS is enabled on all tables:

- [ ] RLS enabled on `user_profile`
- [ ] RLS enabled on `financial_snapshot`
- [ ] RLS enabled on `plans`

**Via SQL:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('user_profile', 'financial_snapshot', 'plans');
```

### ✅ RLS Policies Exist

Verify all RLS policies are created:

- [ ] Policy: "Users can only access their own profile"
- [ ] Policy: "Users can only access their own financial data"
- [ ] Policy: "Users can only access their own plans"

**Via SQL:**
```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### ✅ Indexes Exist

Verify performance indexes are created:

- [ ] Index: `idx_financial_snapshot_user_id`
- [ ] Index: `idx_plans_user_id`
- [ ] Index: `idx_user_profile_email`
- [ ] Index: `user_profile_email_unique` (unique constraint)

**Via SQL:**
```sql
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('user_profile', 'financial_snapshot', 'plans')
ORDER BY tablename, indexname;
```

### ✅ Trigger Functions Exist

Verify the `updated_at` trigger function and triggers:

- [ ] Function: `update_updated_at_column()` exists
- [ ] Trigger: `update_user_profile_updated_at` on `user_profile`
- [ ] Trigger: `update_financial_snapshot_updated_at` on `financial_snapshot`
- [ ] Trigger: `update_plans_updated_at` on `plans`

**Via SQL:**
```sql
-- Check function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'update_updated_at_column';

-- Check triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table IN ('user_profile', 'financial_snapshot', 'plans')
ORDER BY event_object_table, trigger_name;
```

### ✅ RLS Policies Work Correctly

Test that users can only access their own data:

**Option 1: Run automated test**
```bash
npm run db:test-rls
```

**Option 2: Manual testing** - See [docs/testing-rls.md](./testing-rls.md)

- [ ] User 1 can see only their own `user_profile`
- [ ] User 1 can see only their own `financial_snapshot`
- [ ] User 1 can see only their own `plans`
- [ ] User 1 CANNOT see User 2's data (cross-access blocked)
- [ ] User 2 can see only their own data
- [ ] User 2 CANNOT see User 1's data (cross-access blocked)

### ✅ Triggers Work Correctly

- [ ] `updated_at` automatically updates when records are modified
- [ ] All three tables have working `updated_at` triggers

**Test:**
```sql
-- Insert a test record
INSERT INTO user_profile (id, email) VALUES (gen_random_uuid(), 'test@example.com');

-- Check created_at and updated_at
SELECT id, email, created_at, updated_at FROM user_profile WHERE email = 'test@example.com';

-- Wait a moment, then update
UPDATE user_profile SET email_verified = true WHERE email = 'test@example.com';

-- Verify updated_at changed
SELECT id, email, created_at, updated_at FROM user_profile WHERE email = 'test@example.com';

-- Clean up
DELETE FROM user_profile WHERE email = 'test@example.com';
```

### ✅ Foreign Keys and Cascades

Verify foreign key constraints and cascade deletes:

- [ ] `financial_snapshot.user_id` references `user_profile.id`
- [ ] `plans.user_id` references `user_profile.id`
- [ ] Deleting a user cascades to delete their financial snapshots
- [ ] Deleting a user cascades to delete their plans

**Test:**
```sql
-- Insert test user and related data
INSERT INTO user_profile (id, email) VALUES ('test-user-fk-cascade', 'fk-test@example.com');
INSERT INTO financial_snapshot (user_id, birth_year, target_retirement_age, filing_status, annual_income, savings_rate, risk_tolerance)
VALUES ('test-user-fk-cascade', 1990, 65, 'single', 50000, 10, 'moderate');
INSERT INTO plans (user_id, name, config)
VALUES ('test-user-fk-cascade', 'Test Plan', '{"test": true}');

-- Verify data exists
SELECT COUNT(*) FROM financial_snapshot WHERE user_id = 'test-user-fk-cascade';
SELECT COUNT(*) FROM plans WHERE user_id = 'test-user-fk-cascade';

-- Delete user (should cascade)
DELETE FROM user_profile WHERE id = 'test-user-fk-cascade';

-- Verify cascaded data is deleted
SELECT COUNT(*) FROM financial_snapshot WHERE user_id = 'test-user-fk-cascade'; -- Should be 0
SELECT COUNT(*) FROM plans WHERE user_id = 'test-user-fk-cascade'; -- Should be 0
```

## Summary

When all items above are checked ✅:

1. Update the plan file to mark manual verification items as complete
2. Commit any additional changes
3. Notify that Phase 2 is fully complete and ready for Phase 3

## Common Issues

### Issue: Migrations fail with "auth.uid() does not exist"

**Solution:** RLS policies use Supabase's `auth.uid()` function. This is available in Supabase but may not work in local Postgres. For local testing, you may need to modify the policies or use Supabase's hosted database.

### Issue: Cannot connect to database

**Solution:** Check your `DATABASE_URL`:
- Ensure special characters are URL-encoded
- Use the "connection pooling" URL from Supabase (port 6543)
- Verify the password is correct

### Issue: RLS tests show unexpected results

**Solution:**
- Verify RLS is enabled: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- Check policies exist: `SELECT * FROM pg_policies WHERE schemaname = 'public';`
- Ensure you're setting the session context correctly: `SET request.jwt.claim.sub = 'user-uuid';`

## Resources

- [Full RLS Testing Guide](./testing-rls.md)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
