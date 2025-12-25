import { z } from 'zod';
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step2SavingsSchema,
  step3IncomeExpensesSchema,
  step4AssetsDebtsSchema,
} from './onboarding';

// Partial schema for profile updates - all fields optional
export const profileUpdateSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step2SavingsSchema)
  .merge(step3IncomeExpensesSchema)
  .merge(step4AssetsDebtsSchema)
  .partial();

export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
