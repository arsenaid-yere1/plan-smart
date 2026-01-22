import { describe, it, expect } from 'vitest';
import {
  spendingPhaseSchema,
  spendingPhaseConfigSchema,
  incomeStreamSchema,
  contributionAllocationSchema,
  projectionRequestSchema,
} from '../projections';

describe('spendingPhaseSchema', () => {
  const validPhase = {
    id: 'go-go',
    name: 'Go-Go Years',
    startAge: 65,
    essentialMultiplier: 1.0,
    discretionaryMultiplier: 1.5,
  };

  it('should accept valid phase', () => {
    const result = spendingPhaseSchema.safeParse(validPhase);
    expect(result.success).toBe(true);
  });

  it('should accept phase with optional endAge', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      endAge: 75,
    });
    expect(result.success).toBe(true);
  });

  it('should accept phase with optional absolute amounts', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      absoluteEssential: 50000,
      absoluteDiscretionary: 30000,
    });
    expect(result.success).toBe(true);
  });

  it('should reject phase with empty id', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      id: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject phase with empty name', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject phase with name too long', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      name: 'A'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('should reject startAge below 50', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      startAge: 49,
    });
    expect(result.success).toBe(false);
  });

  it('should reject startAge above 100', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      startAge: 101,
    });
    expect(result.success).toBe(false);
  });

  it('should reject essentialMultiplier below 0.1', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      essentialMultiplier: 0.05,
    });
    expect(result.success).toBe(false);
  });

  it('should reject essentialMultiplier above 2.0', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      essentialMultiplier: 2.5,
    });
    expect(result.success).toBe(false);
  });

  it('should accept discretionaryMultiplier of 0 (no discretionary spending)', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      discretionaryMultiplier: 0,
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative discretionaryMultiplier', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      discretionaryMultiplier: -0.1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject discretionaryMultiplier above 3.0', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      discretionaryMultiplier: 3.5,
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative absoluteEssential', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      absoluteEssential: -1000,
    });
    expect(result.success).toBe(false);
  });

  it('should reject absoluteEssential above 500000', () => {
    const result = spendingPhaseSchema.safeParse({
      ...validPhase,
      absoluteEssential: 600000,
    });
    expect(result.success).toBe(false);
  });
});

describe('spendingPhaseConfigSchema', () => {
  const validConfig = {
    enabled: true,
    phases: [
      {
        id: 'go-go',
        name: 'Go-Go Years',
        startAge: 65,
        essentialMultiplier: 1.0,
        discretionaryMultiplier: 1.5,
      },
    ],
  };

  it('should accept valid enabled config with one phase', () => {
    const result = spendingPhaseConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should accept valid config with multiple ordered phases', () => {
    const result = spendingPhaseConfigSchema.safeParse({
      enabled: true,
      phases: [
        {
          id: 'go-go',
          name: 'Go-Go',
          startAge: 65,
          essentialMultiplier: 1.0,
          discretionaryMultiplier: 1.5,
        },
        {
          id: 'slow-go',
          name: 'Slow-Go',
          startAge: 75,
          essentialMultiplier: 1.0,
          discretionaryMultiplier: 1.0,
        },
        {
          id: 'no-go',
          name: 'No-Go',
          startAge: 85,
          essentialMultiplier: 1.0,
          discretionaryMultiplier: 0.5,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept disabled config even with invalid phase data', () => {
    // When disabled, the refinement check is skipped
    const result = spendingPhaseConfigSchema.safeParse({
      enabled: false,
      phases: [
        {
          id: 'go-go',
          name: 'Go-Go',
          startAge: 65,
          essentialMultiplier: 1.0,
          discretionaryMultiplier: 1.5,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty phases array', () => {
    const result = spendingPhaseConfigSchema.safeParse({
      enabled: true,
      phases: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject more than 4 phases', () => {
    const result = spendingPhaseConfigSchema.safeParse({
      enabled: true,
      phases: [
        { id: '1', name: 'Phase 1', startAge: 65, essentialMultiplier: 1.0, discretionaryMultiplier: 1.0 },
        { id: '2', name: 'Phase 2', startAge: 70, essentialMultiplier: 1.0, discretionaryMultiplier: 1.0 },
        { id: '3', name: 'Phase 3', startAge: 75, essentialMultiplier: 1.0, discretionaryMultiplier: 1.0 },
        { id: '4', name: 'Phase 4', startAge: 80, essentialMultiplier: 1.0, discretionaryMultiplier: 1.0 },
        { id: '5', name: 'Phase 5', startAge: 85, essentialMultiplier: 1.0, discretionaryMultiplier: 1.0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should reject phases with duplicate start ages when enabled', () => {
    const result = spendingPhaseConfigSchema.safeParse({
      enabled: true,
      phases: [
        { id: '1', name: 'Phase 1', startAge: 65, essentialMultiplier: 1.0, discretionaryMultiplier: 1.0 },
        { id: '2', name: 'Phase 2', startAge: 65, essentialMultiplier: 1.0, discretionaryMultiplier: 1.0 }, // Duplicate
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should accept phases in any order (sorted internally)', () => {
    // The schema sorts phases internally, so out-of-order input is valid
    // as long as start ages are unique
    const result = spendingPhaseConfigSchema.safeParse({
      enabled: true,
      phases: [
        { id: '1', name: 'Phase 1', startAge: 75, essentialMultiplier: 1.0, discretionaryMultiplier: 1.0 },
        { id: '2', name: 'Phase 2', startAge: 65, essentialMultiplier: 1.0, discretionaryMultiplier: 1.0 },
      ],
    });
    // Should succeed - phases are sorted internally and have unique start ages
    expect(result.success).toBe(true);
  });

  it('should allow out of order phases when disabled', () => {
    // The refinement skips validation when disabled
    const result = spendingPhaseConfigSchema.safeParse({
      enabled: false,
      phases: [
        { id: '1', name: 'Phase 1', startAge: 75, essentialMultiplier: 1.0, discretionaryMultiplier: 1.0 },
        { id: '2', name: 'Phase 2', startAge: 65, essentialMultiplier: 1.0, discretionaryMultiplier: 1.0 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('incomeStreamSchema', () => {
  const validStream = {
    id: 'ss',
    name: 'Social Security',
    type: 'social_security',
    annualAmount: 24000,
    startAge: 67,
    inflationAdjusted: true,
  };

  it('should accept valid income stream', () => {
    const result = incomeStreamSchema.safeParse(validStream);
    expect(result.success).toBe(true);
  });

  it('should accept stream with optional endAge', () => {
    const result = incomeStreamSchema.safeParse({
      ...validStream,
      endAge: 75,
    });
    expect(result.success).toBe(true);
  });

  it('should accept all valid income types', () => {
    const types = ['social_security', 'pension', 'rental', 'annuity', 'part_time', 'other'];
    for (const type of types) {
      const result = incomeStreamSchema.safeParse({
        ...validStream,
        type,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid income type', () => {
    const result = incomeStreamSchema.safeParse({
      ...validStream,
      type: 'invalid_type',
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative annual amount', () => {
    const result = incomeStreamSchema.safeParse({
      ...validStream,
      annualAmount: -1000,
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = incomeStreamSchema.safeParse({
      ...validStream,
      name: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('contributionAllocationSchema', () => {
  it('should accept valid allocation summing to 100', () => {
    const result = contributionAllocationSchema.safeParse({
      taxDeferred: 60,
      taxFree: 20,
      taxable: 20,
    });
    expect(result.success).toBe(true);
  });

  it('should accept 100% in one category', () => {
    const result = contributionAllocationSchema.safeParse({
      taxDeferred: 100,
      taxFree: 0,
      taxable: 0,
    });
    expect(result.success).toBe(true);
  });

  it('should reject allocation not summing to 100', () => {
    const result = contributionAllocationSchema.safeParse({
      taxDeferred: 50,
      taxFree: 20,
      taxable: 20,
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative values', () => {
    const result = contributionAllocationSchema.safeParse({
      taxDeferred: 110,
      taxFree: -10,
      taxable: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject values over 100', () => {
    const result = contributionAllocationSchema.safeParse({
      taxDeferred: 120,
      taxFree: -10,
      taxable: -10,
    });
    expect(result.success).toBe(false);
  });
});

describe('projectionRequestSchema', () => {
  it('should accept empty request (all defaults)', () => {
    const result = projectionRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid expectedReturn', () => {
    const result = projectionRequestSchema.safeParse({
      expectedReturn: 0.07,
    });
    expect(result.success).toBe(true);
  });

  it('should reject expectedReturn above 30%', () => {
    const result = projectionRequestSchema.safeParse({
      expectedReturn: 0.35,
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative expectedReturn', () => {
    const result = projectionRequestSchema.safeParse({
      expectedReturn: -0.05,
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid inflationRate', () => {
    const result = projectionRequestSchema.safeParse({
      inflationRate: 0.025,
    });
    expect(result.success).toBe(true);
  });

  it('should reject inflationRate above 10%', () => {
    const result = projectionRequestSchema.safeParse({
      inflationRate: 0.15,
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid retirementAge', () => {
    const result = projectionRequestSchema.safeParse({
      retirementAge: 67,
    });
    expect(result.success).toBe(true);
  });

  it('should reject retirementAge below 30', () => {
    const result = projectionRequestSchema.safeParse({
      retirementAge: 25,
    });
    expect(result.success).toBe(false);
  });

  it('should reject retirementAge above 80', () => {
    const result = projectionRequestSchema.safeParse({
      retirementAge: 85,
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid spendingPhaseConfig', () => {
    const result = projectionRequestSchema.safeParse({
      spendingPhaseConfig: {
        enabled: true,
        phases: [
          {
            id: 'go-go',
            name: 'Go-Go',
            startAge: 65,
            essentialMultiplier: 1.0,
            discretionaryMultiplier: 1.5,
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept complete projection request', () => {
    const result = projectionRequestSchema.safeParse({
      expectedReturn: 0.06,
      inflationRate: 0.03,
      retirementAge: 67,
      maxAge: 95,
      contributionGrowthRate: 0.02,
      incomeStreams: [
        {
          id: 'ss',
          name: 'Social Security',
          type: 'social_security',
          annualAmount: 24000,
          startAge: 67,
          inflationAdjusted: true,
        },
      ],
      spendingPhaseConfig: {
        enabled: true,
        phases: [
          {
            id: 'go-go',
            name: 'Go-Go Years',
            startAge: 65,
            essentialMultiplier: 1.0,
            discretionaryMultiplier: 1.5,
          },
          {
            id: 'slow-go',
            name: 'Slow-Go Years',
            startAge: 75,
            essentialMultiplier: 1.0,
            discretionaryMultiplier: 1.0,
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });
});
