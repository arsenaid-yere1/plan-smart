import { z } from 'zod';
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step2SavingsSchema,
  step3IncomeExpensesSchema,
  step4AssetsDebtsSchema,
  stepIncomeStreamsSchema,
} from './onboarding';
import { spendingPhaseConfigSchema, depletionTargetWithReserveSchema } from './projections';

// Epic 9: Spending phases schema for profile updates
const spendingPhasesSchema = z.object({
  spendingPhases: spendingPhaseConfigSchema.optional(),
});

// Epic 10: Depletion target schema for profile updates (includes reserve config)
const depletionTargetUpdateSchema = z.object({
  depletionTarget: depletionTargetWithReserveSchema.optional(),
});

// Partial schema for profile updates - all fields optional
export const profileUpdateSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step2SavingsSchema)
  .merge(step3IncomeExpensesSchema)
  .merge(step4AssetsDebtsSchema)
  .merge(stepIncomeStreamsSchema)
  .merge(spendingPhasesSchema)
  .merge(depletionTargetUpdateSchema)
  .partial();

export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
