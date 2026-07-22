import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { buildProjectionInputFromSnapshot } from '@/lib/projections/input-builder';
import { POST } from './route';

const PROJECTION_ID = '8e3651b7-27c1-42aa-b959-f9a8d20b1400';
const mockUser = vi.fn();
const mockProjection = vi.fn();
const mockSnapshot = vi.fn();
const mockCache = vi.fn();

vi.mock('@/lib/auth/server', () => ({ getServerUser: () => mockUser() }));
vi.mock('@/db/secure-query', () => ({ createSecureQuery: () => ({
  getProjectionById: mockProjection,
  getFinancialSnapshot: mockSnapshot,
  getAISummaryForProjection: mockCache,
}) }));

const snapshot = {
  birthYear: 1960, targetRetirementAge: 67, annualIncome: '100000', savingsRate: '20',
  riskTolerance: 'moderate', investmentAccounts: [], debts: [], incomeExpenses: null,
  incomeStreams: [], incomeSources: null, spendingPhases: null, depletionTarget: null,
};

function request() {
  return new NextRequest('http://localhost/api/ai/plan-summary', {
    method: 'POST', body: JSON.stringify({ projectionResultId: PROJECTION_ID }),
  });
}

describe('POST /api/ai/plan-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockResolvedValue({ id: 'user' });
    mockSnapshot.mockResolvedValue(snapshot);
    mockProjection.mockResolvedValue({
      id: PROJECTION_ID,
      inputs: buildProjectionInputFromSnapshot(snapshot as never, {}),
      assumptions: {},
      calculationVersion: 2,
      summary: {},
    });
    mockCache.mockResolvedValue({
      sections: { whereYouStand: 'a', assumptions: 'b', lifestyle: 'c', disclaimer: 'd' },
      createdAt: new Date('2026-01-01T00:00:00Z'), model: 'test-model',
    });
  });

  it('enforces authentication and projection ownership', async () => {
    mockUser.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    mockUser.mockResolvedValue({ id: 'user' });
    mockProjection.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);
  });

  it('returns 409 before cache lookup for legacy or input-stale projections', async () => {
    const freshInputs = buildProjectionInputFromSnapshot(snapshot as never, {});
    mockProjection.mockResolvedValue({
      id: PROJECTION_ID, inputs: freshInputs, assumptions: {}, calculationVersion: 1, summary: {},
    });
    expect((await POST(request())).status).toBe(409);
    expect(mockCache).not.toHaveBeenCalled();

    mockProjection.mockResolvedValue({
      id: PROJECTION_ID,
      inputs: { ...freshInputs, expectedReturn: 0.01 },
      assumptions: {}, calculationVersion: 2, summary: {},
    });
    expect((await POST(request())).status).toBe(409);
    expect(mockCache).not.toHaveBeenCalled();
  });

  it('returns version and fingerprint separately for a fresh cached summary', async () => {
    const response = await POST(request());
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.meta).toEqual(expect.objectContaining({
      cached: true,
      calculationVersion: 2,
      projectionFingerprint: expect.stringMatching(/^[a-f0-9]{8}$/),
    }));
  });
});
