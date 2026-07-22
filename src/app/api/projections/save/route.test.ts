import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const PLAN_ID = '8e3651b7-27c1-42aa-b959-f9a8d20b1400';
const mockGetServerUser = vi.fn();
const mockGetPlanById = vi.fn();
const mockSaveProjectionResult = vi.fn();

vi.mock('@/lib/auth/server', () => ({ getServerUser: () => mockGetServerUser() }));
vi.mock('@/db/secure-query', () => ({
  createSecureQuery: () => ({
    getPlanById: mockGetPlanById,
    saveProjectionResult: mockSaveProjectionResult,
  }),
}));

function request() {
  return new NextRequest('http://localhost/api/projections/save', {
    method: 'POST',
    body: JSON.stringify({
      planId: PLAN_ID,
      inputs: {},
      assumptions: {
        expectedReturn: 0.06, inflationRate: 0.025, healthcareInflationRate: 0.05,
        contributionGrowthRate: 0.02, retirementAge: 67, maxAge: 95,
      },
      records: [],
      summary: {
        startingBalance: 1, endingBalance: 2, totalContributions: 3,
        totalWithdrawals: 4, yearsUntilDepletion: null, projectedRetirementBalance: 5,
      },
    }),
  });
}

describe('POST /api/projections/save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerUser.mockResolvedValue({ id: 'user-id' });
    mockGetPlanById.mockResolvedValue({ id: PLAN_ID });
    mockSaveProjectionResult.mockResolvedValue({ id: 'result-id' });
  });

  it('requires authentication and ownership', async () => {
    mockGetServerUser.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);

    mockGetServerUser.mockResolvedValue({ id: 'user-id' });
    mockGetPlanById.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);
    expect(mockSaveProjectionResult).not.toHaveBeenCalled();
  });

  it('marks caller-supplied results as legacy version 1', async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mockSaveProjectionResult).toHaveBeenCalledWith(
      PLAN_ID,
      expect.objectContaining({ calculationVersion: 1 })
    );
  });
});
