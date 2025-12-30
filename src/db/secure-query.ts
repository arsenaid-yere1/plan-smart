import { eq, and } from 'drizzle-orm';
import { db } from './client';
import { userProfile, financialSnapshot, plans, projectionResults } from './schema';

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

  // Projection Results queries
  async getProjectionForPlan(planId: string) {
    const [result] = await db
      .select()
      .from(projectionResults)
      .where(and(
        eq(projectionResults.planId, planId),
        eq(projectionResults.userId, this.userId)
      ));
    return result ?? null;
  }

  async saveProjectionResult(
    planId: string,
    data: {
      inputs: typeof projectionResults.$inferInsert['inputs'];
      assumptions: typeof projectionResults.$inferInsert['assumptions'];
      records: typeof projectionResults.$inferInsert['records'];
      summary: typeof projectionResults.$inferInsert['summary'];
      calculationTimeMs?: number;
    }
  ) {
    const [result] = await db
      .insert(projectionResults)
      .values({
        planId,
        userId: this.userId,
        ...data,
      })
      .onConflictDoUpdate({
        target: projectionResults.planId,
        set: {
          inputs: data.inputs,
          assumptions: data.assumptions,
          records: data.records,
          summary: data.summary,
          calculationTimeMs: data.calculationTimeMs,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result;
  }

  async deleteProjectionForPlan(planId: string) {
    await db
      .delete(projectionResults)
      .where(and(
        eq(projectionResults.planId, planId),
        eq(projectionResults.userId, this.userId)
      ));
  }
}

/**
 * Factory function to create a secure query builder for a user.
 */
export function createSecureQuery(userId: string) {
  return new SecureQueryBuilder(userId);
}
