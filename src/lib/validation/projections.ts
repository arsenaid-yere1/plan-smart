import { z } from 'zod';

/**
 * Individual spending phase validation schema
 */
export const spendingPhaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Phase name is required').max(50),
  startAge: z.number().int().min(50, 'Start age must be at least 50').max(100),
  endAge: z.number().int().min(50).max(120).optional(),

  // Multipliers (0.1 to 2.0 = 10% to 200%)
  essentialMultiplier: z.number()
    .min(0.1, 'Multiplier must be at least 10%')
    .max(2.0, 'Multiplier cannot exceed 200%'),
  discretionaryMultiplier: z.number()
    .min(0.0, 'Multiplier cannot be negative')
    .max(3.0, 'Multiplier cannot exceed 300%'),

  // Optional absolute amounts
  absoluteEssential: z.number().min(0).max(500000).optional(),
  absoluteDiscretionary: z.number().min(0).max(500000).optional(),
});

/**
 * Spending phase config validation with cross-field rules
 */
export const spendingPhaseConfigSchema = z.object({
  enabled: z.boolean(),
  phases: z.array(spendingPhaseSchema)
    .min(1, 'At least one phase is required when enabled')
    .max(4, 'Maximum 4 phases allowed'),
}).refine(
  (data) => {
    if (!data.enabled) return true;

    // Validate phases are ordered by startAge with no gaps
    const sorted = [...data.phases].sort((a, b) => a.startAge - b.startAge);
    for (let i = 1; i < sorted.length; i++) {
      // Phases should be ordered (next startAge > previous startAge)
      if (sorted[i].startAge <= sorted[i - 1].startAge) {
        return false;
      }
    }
    return true;
  },
  { message: 'Phases must have unique, ascending start ages' }
);

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
  // Return rate override (0-30%)
  expectedReturn: z
    .number()
    .min(0, 'Expected return cannot be negative')
    .max(0.30, 'Expected return cannot exceed 30%')
    .optional(),

  // Inflation rate override (0-10%)
  inflationRate: z
    .number()
    .min(0, 'Inflation rate cannot be negative')
    .max(0.10, 'Inflation rate cannot exceed 10%')
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

  // Epic 9: Spending phase config override
  spendingPhaseConfig: spendingPhaseConfigSchema.optional(),
});

export type ProjectionRequestInput = z.infer<typeof projectionRequestSchema>;