import { z } from 'zod';

export const incomeSourceTypeSchema = z.enum([
  'w2_employment',
  'self_employed',
  'business_owner',
  'contract_1099',
  'rental_income',
  'investment_income',
]);

export const incomeVariabilitySchema = z.enum(['recurring', 'variable', 'seasonal']);

export const taxFlexibilitySchema = z.object({
  canDefer: z.boolean(),
  canReduce: z.boolean(),
  canRestructure: z.boolean(),
});

export const incomeSourceSchema = z.object({
  id: z.string().min(1),
  type: incomeSourceTypeSchema,
  label: z.string().min(1),
  annualAmount: z.number().min(0).max(100_000_000),
  variability: incomeVariabilitySchema,
  flexibility: taxFlexibilitySchema,
  isPrimary: z.boolean(),
  notes: z.string().optional(),
});

export type IncomeSourceFormData = z.infer<typeof incomeSourceSchema>;
