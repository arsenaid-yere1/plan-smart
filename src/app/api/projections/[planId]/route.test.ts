import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { buildProjectionInputFromSnapshot } from '@/lib/projections/input-builder';

const mockUser = vi.fn();
const mockPlan = vi.fn();
const mockProjection = vi.fn();
const mockSnapshot = vi.fn();
vi.mock('@/lib/auth/server', () => ({ getServerUser: () => mockUser() }));
vi.mock('@/db/secure-query', () => ({ createSecureQuery: () => ({
  getPlanById: mockPlan,
  getProjectionForPlan: mockProjection,
  getFinancialSnapshot: mockSnapshot,
}) }));

const snapshot = {
  birthYear: 1960, targetRetirementAge: 67, annualIncome: '100000', savingsRate: '20',
  riskTolerance: 'moderate', investmentAccounts: [], debts: [], incomeExpenses: null,
  incomeStreams: [], incomeSources: null, spendingPhases: null, depletionTarget: null,
};
const input = buildProjectionInputFromSnapshot(snapshot as never, {});

describe('GET /api/projections/[planId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockResolvedValue({ id: 'user' });
    mockPlan.mockResolvedValue({ id: 'plan' });
    mockSnapshot.mockResolvedValue(snapshot);
    mockProjection.mockResolvedValue({
      id: 'projection', inputs: input, assumptions: {}, calculationVersion: 2,
    });
  });

  it('enforces authentication and plan ownership', async () => {
    mockUser.mockResolvedValue(null);
    expect((await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ planId: 'plan' }) })).status).toBe(401);
    mockUser.mockResolvedValue({ id: 'user' });
    mockPlan.mockResolvedValue(null);
    expect((await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ planId: 'plan' }) })).status).toBe(404);
  });

  it('reports freshness without mutating the saved result', async () => {
    const response = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ planId: 'plan' }) });
    const data = await response.json();
    expect(data.isStale).toBe(false);
    expect(data.storedCalculationVersion).toBe(2);
    expect(data.currentCalculationVersion).toBe(2);
  });

  it('reports a legacy version as stale', async () => {
    mockProjection.mockResolvedValue({ id: 'projection', inputs: input, assumptions: {}, calculationVersion: 1 });
    const data = await (await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ planId: 'plan' }) })).json();
    expect(data.isStale).toBe(true);
    expect(data.changedFields).toContain('calculationVersion');
  });
});
