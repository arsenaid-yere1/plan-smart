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
