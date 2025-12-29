import { z } from 'zod';

/**
 * Income stream validation schema
 */
export const incomeStreamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Income stream name is required'),
  type: z.enum(['social_security', 'pension', 'rental', 'annuity', 'part_time', 'other']),
  annualAmount: z.number().min(0, 'Amount cannot be negative'),
  startAge: z.number().min(0).max(120),
  endAge: z.number().min(0).max(120).optional(),
  inflationAdjusted: z.boolean(),
});

/**
 * Contribution allocation schema - percentages must sum to 100
 */
export const contributionAllocationSchema = z
  .object({
    taxDeferred: z.number().min(0).max(100),
    taxFree: z.number().min(0).max(100),
    taxable: z.number().min(0).max(100),
  })
  .refine(
    (data) => data.taxDeferred + data.taxFree + data.taxable === 100,
    { message: 'Contribution allocation percentages must sum to 100' }
  );

/**
 * Projection request schema - all fields optional (defaults from financial snapshot)
 */
export const projectionRequestSchema = z.object({
  // Return rate override (0-20%)
  expectedReturn: z
    .number()
    .min(0, 'Expected return cannot be negative')
    .max(0.20, 'Expected return cannot exceed 20%')
    .optional(),

  // Inflation rate override (0-15%)
  inflationRate: z
    .number()
    .min(0, 'Inflation rate cannot be negative')
    .max(0.15, 'Inflation rate cannot exceed 15%')
    .optional(),

  // Max age override (current age + 1 to 120)
  maxAge: z
    .number()
    .int()
    .min(50, 'Max age must be at least 50')
    .max(120, 'Max age cannot exceed 120')
    .optional(),

  // Contribution growth rate (0-10%, default 0%)
  contributionGrowthRate: z
    .number()
    .min(0, 'Contribution growth rate cannot be negative')
    .max(0.10, 'Contribution growth rate cannot exceed 10%')
    .optional(),

  // Retirement age override (30-80)
  retirementAge: z
    .number()
    .int()
    .min(30, 'Retirement age must be at least 30')
    .max(80, 'Retirement age cannot exceed 80')
    .optional(),

  // Legacy Social Security claiming age (62-70) - still supported for backward compatibility
  socialSecurityAge: z
    .number()
    .int()
    .min(62, 'Social Security age must be at least 62')
    .max(70, 'Social Security age cannot exceed 70')
    .optional(),

  // Legacy Monthly Social Security benefit - still supported for backward compatibility
  socialSecurityMonthly: z
    .number()
    .min(0, 'Social Security benefit cannot be negative')
    .max(10000, 'Social Security benefit cannot exceed $10,000/month')
    .optional(),

  // New income streams field
  incomeStreams: z.array(incomeStreamSchema).optional(),

  // Healthcare cost overrides
  annualHealthcareCosts: z
    .number()
    .min(0, 'Healthcare costs cannot be negative')
    .max(100000, 'Healthcare costs cannot exceed $100,000/year')
    .optional(),

  // Healthcare inflation rate override (0-15%)
  healthcareInflationRate: z
    .number()
    .min(0, 'Healthcare inflation rate cannot be negative')
    .max(0.15, 'Healthcare inflation rate cannot exceed 15%')
    .optional(),

  // Contribution allocation override
  contributionAllocation: contributionAllocationSchema.optional(),
});

export type ProjectionRequestInput = z.infer<typeof projectionRequestSchema>;