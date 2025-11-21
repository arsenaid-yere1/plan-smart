import { eq, and } from 'drizzle-orm';
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
      .where(and(eq(plans.id, planId), eq(plans.userId, this.userId))); // Double-check user_id
    return plan;
  }
}

/**
 * Factory function to create a secure query builder for a user.
 */
export function createSecureQuery(userId: string) {
  return new SecureQueryBuilder(userId);
}
