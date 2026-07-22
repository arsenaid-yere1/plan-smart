import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const USER_ID = 'ad1741a6-3cb1-47c1-8ee2-e71b9173e282';
const PLAN_ID = '8e3651b7-27c1-42aa-b959-f9a8d20b1400';
const mockGetServerUser = vi.fn();
const mockGetPlanById = vi.fn();
const mockGetProjectionForPlan = vi.fn();
const mockSaveProjectionResult = vi.fn();
let snapshotRows: unknown[] = [];

vi.mock('@/lib/auth/server', () => ({
  getServerUser: () => mockGetServerUser(),
}));

vi.mock('@/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(snapshotRows) }),
      }),
    }),
  },
}));

vi.mock('@/db/secure-query', () => ({
  createSecureQuery: () => ({
    getPlanById: mockGetPlanById,
    getProjectionForPlan: mockGetProjectionForPlan,
    saveProjectionResult: mockSaveProjectionResult,
  }),
}));

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    userId: USER_ID,
    birthYear: 1960,
    stateOfResidence: 'CA',
    targetRetirementAge: 67,
    filingStatus: 'single',
    annualIncome: '100000',
    savingsRate: '20',
    riskTolerance: 'moderate',
    investmentAccounts: [
      { id: 'roth', label: 'Roth IRA', type: 'Roth_IRA', balance: 50000, monthlyContribution: 500 },
    ],
    primaryResidence: null,
    debts: [],
    incomeExpenses: { monthlyEssential: 4000, monthlyDiscretionary: 1000 },
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

function request(body: unknown) {
  return new NextRequest('http://localhost/api/projections/calculate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/projections/calculate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerUser.mockResolvedValue({ id: USER_ID });
    mockGetPlanById.mockResolvedValue({ id: PLAN_ID, userId: USER_ID });
    mockGetProjectionForPlan.mockResolvedValue(null);
    mockSaveProjectionResult.mockResolvedValue({ id: 'projection-id' });
    snapshotRows = [makeSnapshot()];
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetServerUser.mockResolvedValue(null);
    expect((await POST(request({}))).status).toBe(401);
  });

  it('rejects invalid overrides and plan identifiers before querying', async () => {
    expect((await POST(request({ expectedReturn: -0.5 }))).status).toBe(400);
    expect((await POST(request({ planId: 'not-a-uuid' }))).status).toBe(400);
  });

  it('returns 404 when the snapshot is missing', async () => {
    snapshotRows = [];
    const response = await POST(request({}));
    expect(response.status).toBe(404);
  });

  it('allows an already-retired user and returns cohort RMD and routed contributions', async () => {
    snapshotRows = [makeSnapshot({ birthYear: 1950, targetRetirementAge: 65 })];
    const response = await POST(request({}));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.inputs.currentAge).toBeGreaterThan(data.inputs.retirementAge);
    expect(data.inputs.rmdConfig.startAge).toBe(72);
    expect(data.inputs.annualContributionsByType).toEqual({
      taxDeferred: 0,
      taxFree: 6000,
      taxable: 0,
    });
  });

  it('rejects a horizon at or before current age', async () => {
    snapshotRows = [makeSnapshot({ birthYear: 1940, targetRetirementAge: 65 })];
    const response = await POST(request({ maxAge: 80 }));
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain('must be greater than your current age');
  });

  it('does not calculate or save for an unowned plan', async () => {
    mockGetPlanById.mockResolvedValue(null);
    const response = await POST(request({ planId: PLAN_ID }));
    expect(response.status).toBe(404);
    expect(mockSaveProjectionResult).not.toHaveBeenCalled();
  });

  it('merges partial plan overrides and saves as current version', async () => {
    mockGetProjectionForPlan.mockResolvedValue({
      assumptions: {
        overrides: {
          expectedReturn: 0.04,
          inflationRate: 0.03,
          annualHealthcareCosts: 12345,
          socialSecurityAge: 70,
          socialSecurityMonthly: 2500,
        },
      },
    });

    const response = await POST(request({ planId: PLAN_ID, expectedReturn: 0.06 }));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.inputs.expectedReturn).toBe(0.06);
    expect(data.inputs.inflationRate).toBe(0.03);
    expect(data.inputs.incomeStreams[0].startAge).toBe(70);
    expect(data.meta.calculationVersion).toBe(2);
    expect(mockSaveProjectionResult).toHaveBeenCalledWith(
      PLAN_ID,
      expect.objectContaining({
        calculationVersion: 2,
        assumptions: expect.objectContaining({
          overrides: expect.objectContaining({ annualHealthcareCosts: 12345 }),
        }),
      })
    );
  });

  it('retains unknown-account warnings and legacy Social Security overrides', async () => {
    snapshotRows = [makeSnapshot({
      investmentAccounts: [
        { id: 'mystery', label: 'Mystery', type: 'mystery', balance: 1000 },
      ],
    })];
    const response = await POST(request({ socialSecurityAge: 69, socialSecurityMonthly: 2000 }));
    const data = await response.json();
    expect(data.inputs.incomeStreams[0].startAge).toBe(69);
    expect(data.meta.warnings[0]).toContain('Unknown account type');
  });
});
