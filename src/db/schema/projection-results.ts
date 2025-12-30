import { pgTable, uuid, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
import { plans } from './plans';
import { userProfile } from './user-profile';
import type {
  ProjectionInput,
  ProjectionAssumptions,
  ProjectionRecord,
  ProjectionSummary,
} from '@/lib/projections/types';

export const projectionResults = pgTable('projection_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id')
    .notNull()
    .unique() // Enforces one-to-one relationship
    .references(() => plans.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => userProfile.id, { onDelete: 'cascade' }),

  // Stored inputs (for re-rendering and staleness detection)
  inputs: jsonb('inputs').notNull().$type<ProjectionInput>(),

  // Stored assumptions (human-readable snapshot for AI narrative)
  assumptions: jsonb('assumptions').notNull().$type<ProjectionAssumptions>(),

  // Projection results
  records: jsonb('records').notNull().$type<ProjectionRecord[]>(),
  summary: jsonb('summary').notNull().$type<ProjectionSummary>(),

  // Metadata
  calculationTimeMs: integer('calculation_time_ms'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Row-Level Security Policy (applied via migration SQL)
// CREATE POLICY "Users can only access their own projection results"
//   ON projection_results FOR ALL
//   USING (auth.uid() = user_id);
