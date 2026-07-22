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

// Build the partial object before applying cross-field refinements. Zod 4 does
// not allow partial() or merge() on object schemas that already have checks.
const profileUpdateBaseSchema = z.object({
  ...step1Schema.shape,
  ...step2Schema.shape,
  ...step3Schema.shape,
  ...step4Schema.shape,
  ...step2SavingsSchema.shape,
  ...step3IncomeExpensesSchema.shape,
  ...step4AssetsDebtsSchema.shape,
  ...stepIncomeStreamsSchema.shape,
  ...spendingPhasesSchema.shape,
  ...depletionTargetUpdateSchema.shape,
}).partial();

export const profileUpdateSchema = profileUpdateBaseSchema
  .refine(
    (data) => {
      if (!data.incomeSources || data.incomeSources.length === 0) return true;
      if (data.annualIncome === undefined) return false;
      const total = data.incomeSources.reduce((sum, source) => sum + source.annualAmount, 0);
      return Math.abs(total - data.annualIncome) <= 1;
    },
    { message: 'Income sources must add up to your total annual income', path: ['incomeSources'] }
  )
  .refine(
    (data) => {
      if (!data.incomeSources || data.incomeSources.length === 0) return true;
      return data.incomeSources.filter((source) => source.isPrimary).length === 1;
    },
    { message: 'Please mark one income source as your primary source', path: ['incomeSources'] }
  );

export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
