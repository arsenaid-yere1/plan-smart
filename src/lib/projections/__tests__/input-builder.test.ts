import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { financialSnapshot } from '@/db/schema/financial-snapshot';
import {
  buildProjectionInputFromSnapshot,
  collectProjectionInputWarnings,
} from '../input-builder';
import { DEFAULT_CONTRIBUTION_ALLOCATION } from '../assumptions';

type Snapshot = typeof financialSnapshot.$inferSelect;

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    id: '8e3651b7-27c1-42aa-b959-f9a8d20b1400',
    userId: 'ad1741a6-3cb1-47c1-8ee2-e71b9173e282',
    birthYear: 1960,
    stateOfResidence: 'CA',
    targetRetirementAge: 67,
    filingStatus: 'single',
    annualIncome: '100000',
    savingsRate: '20',
    riskTolerance: 'moderate',
    investmentAccounts: [],
    primaryResidence: null,
    debts: [],
    incomeExpenses: null,
    incomeStreams: null,
    incomeSources: null,
    realEstateProperties: null,
    spendingPhases: null,
    depletionTarget: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('buildProjectionInputFromSnapshot', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-22T12:00:00Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('preserves balances and contribution dollars in account tax categories', () => {
    const input = buildProjectionInputFromSnapshot(makeSnapshot({
      investmentAccounts: [
        { id: '401k', label: '401(k)', type: '401k', balance: 100000, monthlyContribution: 1000 },
        { id: 'roth', label: 'Roth', type: 'Roth_IRA', balance: 40000, monthlyContribution: 500 },
        { id: 'brokerage', label: 'Brokerage', type: 'Brokerage', balance: 20000, monthlyContribution: 250 },
        { id: 'cash', label: 'Cash', type: 'Cash', balance: 5000 },
      ],
    }), {});

    expect(input.balancesByType).toEqual({
      taxDeferred: 100000,
      taxFree: 40000,
      taxable: 25000,
    });
    expect(input.annualContributionsByType).toEqual({
      taxDeferred: 12000,
      taxFree: 6000,
      taxable: 3000,
    });
    expect(input.annualContribution).toBe(21000);
    expect(input.contributionAllocation.taxDeferred).toBeCloseTo(12000 / 21000 * 100);
    expect(input.contributionAllocation.taxFree).toBeCloseTo(6000 / 21000 * 100);
    expect(input.contributionAllocation.taxable).toBeCloseTo(3000 / 21000 * 100);
  });

  it('uses an explicit contribution allocation and the legacy zero-contribution fallback', () => {
    const snapshot = makeSnapshot({
      investmentAccounts: [
        { id: 'roth', label: 'Roth', type: 'Roth_IRA', balance: 1000, monthlyContribution: 100 },
      ],
    });
    const allocation = { taxDeferred: 25, taxFree: 50, taxable: 25 };
    const overridden = buildProjectionInputFromSnapshot(snapshot, {
      contributionAllocation: allocation,
    });

    expect(overridden.contributionAllocation).toEqual(allocation);
    expect(overridden.annualContributionsByType).toEqual({
      taxDeferred: 300,
      taxFree: 600,
      taxable: 300,
    });

    const zero = buildProjectionInputFromSnapshot(makeSnapshot(), {});
    expect(zero.annualContributionsByType).toEqual({
      taxDeferred: 0,
      taxFree: 0,
      taxable: 0,
    });
    expect(zero.contributionAllocation).toEqual(DEFAULT_CONTRIBUTION_ALLOCATION);
  });

  it('preserves explicit zero expenses and otherwise uses variability-adjusted income', () => {
    const explicitZero = buildProjectionInputFromSnapshot(makeSnapshot({
      incomeExpenses: { monthlyEssential: 0, monthlyDiscretionary: 0 },
    }), {});
    expect(explicitZero.annualExpenses).toBe(0);

    const derived = buildProjectionInputFromSnapshot(makeSnapshot({
      savingsRate: '20',
      incomeSources: [
        {
          id: 'salary',
          type: 'w2_employment',
          label: 'Salary',
          annualAmount: 80000,
          variability: 'recurring',
          flexibility: { canDefer: false, canReduce: false, canRestructure: false },
          isPrimary: true,
        },
        {
          id: 'contract',
          type: 'contract_1099',
          label: 'Contract',
          annualAmount: 20000,
          variability: 'variable',
          flexibility: { canDefer: true, canReduce: true, canRestructure: true },
          isPrimary: false,
        },
      ],
    }), {});

    expect(derived.annualEssentialExpenses).toBe(77600);
    expect(derived.annualDiscretionaryExpenses).toBe(0);
  });

  it('estimates Social Security from earned income and excludes passive income', () => {
    const baseline = buildProjectionInputFromSnapshot(makeSnapshot({
      annualIncome: '250000',
      incomeSources: [
        {
          id: 'salary',
          type: 'w2_employment',
          label: 'Salary',
          annualAmount: 60000,
          variability: 'recurring',
          flexibility: { canDefer: false, canReduce: false, canRestructure: false },
          isPrimary: true,
        },
        {
          id: 'rental',
          type: 'rental_income',
          label: 'Rental',
          annualAmount: 190000,
          variability: 'recurring',
          flexibility: { canDefer: false, canReduce: false, canRestructure: true },
          isPrimary: false,
        },
      ],
    }), {});
    const earnedOnly = buildProjectionInputFromSnapshot(makeSnapshot({ annualIncome: '60000' }), {});

    expect(baseline.incomeStreams[0]?.annualAmount).toBe(earnedOnly.incomeStreams[0]?.annualAmount);
  });

  it('preserves legacy Social Security overrides and explicit stream precedence', () => {
    const legacy = buildProjectionInputFromSnapshot(makeSnapshot(), {
      socialSecurityAge: 70,
      socialSecurityMonthly: 2500,
    });
    expect(legacy.incomeStreams[0]).toMatchObject({ startAge: 70, annualAmount: 30000 });

    const explicit = buildProjectionInputFromSnapshot(makeSnapshot(), {
      socialSecurityAge: 70,
      socialSecurityMonthly: 2500,
      incomeStreams: [{
        id: 'pension',
        name: 'Pension',
        type: 'pension',
        annualAmount: 18000,
        startAge: 65,
        inflationAdjusted: false,
      }],
    });
    expect(explicit.incomeStreams).toEqual([expect.objectContaining({
      id: 'pension',
      isGuaranteed: true,
      isSpouse: false,
    })]);

    const disabled = buildProjectionInputFromSnapshot(makeSnapshot(), { incomeStreams: [] });
    expect(disabled.incomeStreams).toEqual([]);
  });

  it('classifies unknown accounts as taxable and reports a diagnostic warning', () => {
    const snapshot = makeSnapshot({
      investmentAccounts: [
        { id: 'crypto', label: 'Crypto', type: 'Crypto', balance: 5000, monthlyContribution: 25 },
      ],
    });
    const input = buildProjectionInputFromSnapshot(snapshot, {});

    expect(input.balancesByType.taxable).toBe(5000);
    expect(input.annualContributionsByType?.taxable).toBe(300);
    expect(collectProjectionInputWarnings(snapshot)).toEqual([
      'Unknown account type "Crypto" for "Crypto" - treating as taxable',
    ]);
  });

  it.each([
    [1950, 72],
    [1951, 73],
    [1959, 73],
    [1960, 75],
  ])('derives RMD age for birth year %i', (birthYear, startAge) => {
    const input = buildProjectionInputFromSnapshot(makeSnapshot({ birthYear }), {});

    expect(input.birthYear).toBe(birthYear);
    expect(input.rmdConfig).toEqual({ enabled: true, startAge });
  });

  it('preserves an explicit scenario RMD configuration', () => {
    const input = buildProjectionInputFromSnapshot(makeSnapshot({ birthYear: 1960 }), {
      rmdConfig: { enabled: false, startAge: 80 },
    });
    expect(input.rmdConfig).toEqual({ enabled: false, startAge: 80 });
  });

  it('propagates spending phases, depletion target, and reserve floor', () => {
    const input = buildProjectionInputFromSnapshot(makeSnapshot({
      investmentAccounts: [
        { id: 'brokerage', label: 'Brokerage', type: 'Brokerage', balance: 100000 },
      ],
      spendingPhases: {
        enabled: true,
        phases: [{
          id: 'go-go',
          name: 'Go-Go',
          startAge: 67,
          essentialMultiplier: 1,
          discretionaryMultiplier: 1.2,
        }],
      },
      depletionTarget: {
        enabled: true,
        targetPercentageSpent: 80,
        targetAge: 90,
        reserve: { type: 'derived' },
      },
    }), {});

    expect(input.spendingPhaseConfig?.enabled).toBe(true);
    expect(input.depletionTarget?.targetAge).toBe(90);
    expect(input.reserveFloor).toBeCloseTo(20000);
  });
});
