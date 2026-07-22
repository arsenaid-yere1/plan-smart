import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const mockUser = vi.fn();
const mockPlan = vi.fn();
const mockProjection = vi.fn();
const mockSnapshot = vi.fn();
vi.mock('@/lib/auth/server', () => ({ getServerUser: () => mockUser() }));
vi.mock('@/db/secure-query', () => ({ createSecureQuery: () => ({
  getPlanById: mockPlan, getProjectionForPlan: mockProjection, getFinancialSnapshot: mockSnapshot,
}) }));

describe('GET projection staleness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockResolvedValue({ id: 'user' });
    mockPlan.mockResolvedValue({ id: 'plan' });
    mockProjection.mockResolvedValue(null);
  });

  it('reports missing results with explicit version metadata', async () => {
    const response = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ planId: 'plan' }) });
    expect(await response.json()).toEqual(expect.objectContaining({
      isStale: true, storedCalculationVersion: null, currentCalculationVersion: 2,
    }));
  });

  it('enforces authentication and ownership', async () => {
    mockUser.mockResolvedValue(null);
    expect((await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ planId: 'plan' }) })).status).toBe(401);
    mockUser.mockResolvedValue({ id: 'user' });
    mockPlan.mockResolvedValue(null);
    expect((await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ planId: 'plan' }) })).status).toBe(404);
  });
});
