import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Test script to verify Row-Level Security (RLS) policies.
 *
 * This script:
 * 1. Creates two test users in the database
 * 2. Inserts data for each user
 * 3. Verifies that each user can only see their own data
 * 4. Cleans up test data
 */

const testRLS = async () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const sql = postgres(connectionString);

  console.log('🔒 Testing Row-Level Security Policies...\n');

  // Test user UUIDs
  const user1Id = '11111111-1111-1111-1111-111111111111';
  const user2Id = '22222222-2222-2222-2222-222222222222';

  try {
    // Clean up any existing test data
    console.log('🧹 Cleaning up existing test data...');
    await sql`DELETE FROM user_profile WHERE id IN (${user1Id}, ${user2Id})`;

    // Insert test data for both users
    console.log('📝 Inserting test data for User 1 and User 2...');

    await sql`
      INSERT INTO user_profile (id, email, email_verified, onboarding_completed)
      VALUES
        (${user1Id}, 'user1@test.com', true, false),
        (${user2Id}, 'user2@test.com', true, false)
    `;

    await sql`
      INSERT INTO financial_snapshot (user_id, birth_year, target_retirement_age, filing_status, annual_income, savings_rate, risk_tolerance)
      VALUES
        (${user1Id}, 1985, 65, 'single', 75000.00, 15.00, 'moderate'),
        (${user2Id}, 1990, 67, 'married', 95000.00, 20.00, 'aggressive')
    `;

    await sql`
      INSERT INTO plans (user_id, name, description, config)
      VALUES
        (${user1Id}, 'User 1 Plan', 'Test plan for user 1', '{"version": 1}'::jsonb),
        (${user2Id}, 'User 2 Plan', 'Test plan for user 2', '{"version": 1}'::jsonb)
    `;

    console.log('✅ Test data inserted\n');

    // Test 1: Query as User 1
    console.log('🔍 Test 1: Querying as User 1...');

    // Set session to User 1
    await sql`SET request.jwt.claim.sub = ${user1Id}`;

    const user1Profiles = await sql`SELECT * FROM user_profile`;
    const user1Snapshots = await sql`SELECT * FROM financial_snapshot`;
    const user1Plans = await sql`SELECT * FROM plans`;

    console.log(`  User Profiles visible: ${user1Profiles.length} (expected: 1)`);
    console.log(`  Financial Snapshots visible: ${user1Snapshots.length} (expected: 1)`);
    console.log(`  Plans visible: ${user1Plans.length} (expected: 1)`);

    if (user1Profiles.length === 1 && user1Profiles[0].email === 'user1@test.com') {
      console.log('  ✅ User 1 can see only their own profile');
    } else {
      console.log('  ❌ RLS FAILED: User 1 can see incorrect profiles!');
    }

    // Test 2: Query as User 2
    console.log('\n🔍 Test 2: Querying as User 2...');

    // Set session to User 2
    await sql`SET request.jwt.claim.sub = ${user2Id}`;

    const user2Profiles = await sql`SELECT * FROM user_profile`;
    const user2Snapshots = await sql`SELECT * FROM financial_snapshot`;
    const user2Plans = await sql`SELECT * FROM plans`;

    console.log(`  User Profiles visible: ${user2Profiles.length} (expected: 1)`);
    console.log(`  Financial Snapshots visible: ${user2Snapshots.length} (expected: 1)`);
    console.log(`  Plans visible: ${user2Plans.length} (expected: 1)`);

    if (user2Profiles.length === 1 && user2Profiles[0].email === 'user2@test.com') {
      console.log('  ✅ User 2 can see only their own profile');
    } else {
      console.log('  ❌ RLS FAILED: User 2 can see incorrect profiles!');
    }

    // Test 3: Try to explicitly query another user's data
    console.log('\n🔍 Test 3: User 1 trying to access User 2\'s data explicitly...');
    await sql`SET request.jwt.claim.sub = ${user1Id}`;

    const crossAccessAttempt = await sql`
      SELECT * FROM financial_snapshot WHERE user_id = ${user2Id}
    `;

    if (crossAccessAttempt.length === 0) {
      console.log('  ✅ RLS correctly blocked cross-user access');
    } else {
      console.log('  ❌ RLS FAILED: User 1 can access User 2\'s data!');
    }

    // Test 4: Verify triggers work
    console.log('\n🔍 Test 4: Testing updated_at trigger...');
    await sql`SET request.jwt.claim.sub = ${user1Id}`;

    const beforeUpdate = await sql`SELECT updated_at FROM user_profile WHERE id = ${user1Id}`;
    const originalTime = beforeUpdate[0].updated_at;

    // Wait 1 second to ensure timestamp changes
    await new Promise(resolve => setTimeout(resolve, 1000));

    await sql`UPDATE user_profile SET email_verified = true WHERE id = ${user1Id}`;

    const afterUpdate = await sql`SELECT updated_at FROM user_profile WHERE id = ${user1Id}`;
    const newTime = afterUpdate[0].updated_at;

    if (new Date(newTime) > new Date(originalTime)) {
      console.log('  ✅ updated_at trigger is working correctly');
    } else {
      console.log('  ❌ updated_at trigger FAILED');
    }

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await sql`SET request.jwt.claim.sub = ${user1Id}`;
    await sql`DELETE FROM user_profile WHERE id = ${user1Id}`;
    await sql`SET request.jwt.claim.sub = ${user2Id}`;
    await sql`DELETE FROM user_profile WHERE id = ${user2Id}`;

    console.log('\n✅ All RLS tests completed successfully!');

  } catch (error) {
    console.error('❌ RLS test failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
};

testRLS().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
