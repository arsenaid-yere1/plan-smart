import { pgTable, uuid, varchar, jsonb, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { projectionResults } from './projection-results';
import { userProfile } from './user-profile';

// AI-generated narrative summaries for retirement projections
// Cached by input hash - same projection inputs return same narrative
export const aiSummaries = pgTable('ai_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Foreign key to projection this summary explains
  projectionResultId: uuid('projection_result_id')
    .notNull()
    .references(() => projectionResults.id, { onDelete: 'cascade' }),

  // User ownership for RLS
  userId: uuid('user_id')
    .notNull()
    .references(() => userProfile.id, { onDelete: 'cascade' }),

  // SHA-256 hash of projection inputs for cache invalidation
  inputHash: varchar('input_hash', { length: 64 }).notNull(),

  // The four narrative sections
  sections: jsonb('sections').$type<{
    whereYouStand: string;
    assumptions: string;
    lifestyle: string;
    disclaimer: string;
  }>().notNull(),

  // Metadata for debugging and cost tracking
  model: varchar('model', { length: 50 }).notNull(),
  tokensUsed: integer('tokens_used'),
  generationTimeMs: integer('generation_time_ms'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Unique constraint: one summary per projection + input hash combination
  projectionInputUnique: unique().on(table.projectionResultId, table.inputHash),
}));

// Type for the sections JSONB column
export type AISummarySections = {
  whereYouStand: string;
  assumptions: string;
  lifestyle: string;
  disclaimer: string;
};
