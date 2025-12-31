import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock auth
const mockGetServerUser = vi.fn();
vi.mock('@/lib/auth/server', () => ({
  getServerUser: () => mockGetServerUser(),
}));

// Mock database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      mockSelect();
      return {
        from: (table: unknown) => {
          mockFrom(table);
          return {
            where: (condition: unknown) => {
              mockWhere(condition);
              return {
                limit: (n: number) => {
                  mockLimit(n);
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
  },
}));

vi.mock('@/db/schema', () => ({
  financialSnapshot: { userId: 'user_id' },
}));

describe('POST /api/projections/calculate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockGetServerUser.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/projections/calculate', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe('Unauthorized');
  });

  it('should return 404 when no financial snapshot exists', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'test-user-id' });
    mockLimit.mockResolvedValue([]); // No snapshot

    const request = new NextRequest('http://localhost:3000/api/projections/calculate', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain('Financial snapshot not found');
  });

  it('should return 400 for invalid override values', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'test-user-id' });

    const request = new NextRequest('http://localhost:3000/api/projections/calculate', {
      method: 'POST',
      body: JSON.stringify({
        expectedReturn: -0.5, // Invalid: negative
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should validate contribution allocation sums to 100', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'test-user-id' });

    const request = new NextRequest('http://localhost:3000/api/projections/calculate', {
      method: 'POST',
      body: JSON.stringify({
        contributionAllocation: {
          taxDeferred: 50,
          taxFree: 30,
          taxable: 10, // Sum = 90, not 100
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should accept valid incomeStreams override in POST request', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'test-user-id' });

    const request = new NextRequest('http://localhost:3000/api/projections/calculate', {
      method: 'POST',
      body: JSON.stringify({
        incomeStreams: [
          {
            id: 'ss-override',
            name: 'Social Security',
            type: 'social_security',
            annualAmount: 30000,
            startAge: 67,
            inflationAdjusted: true,
          },
          {
            id: 'pension-override',
            name: 'Pension',
            type: 'pension',
            annualAmount: 20000,
            startAge: 65,
            endAge: 80,
            inflationAdjusted: false,
          },
        ],
      }),
    });

    const response = await POST(request);

    // Should not fail validation (though will 404 due to no snapshot)
    expect(response.status).toBe(404);
  });

  it('should reject invalid incomeStreams with missing required fields', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'test-user-id' });

    const request = new NextRequest('http://localhost:3000/api/projections/calculate', {
      method: 'POST',
      body: JSON.stringify({
        incomeStreams: [
          {
            id: 'ss',
            // Missing name, type, annualAmount, startAge, inflationAdjusted
          },
        ],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should reject incomeStreams with invalid type', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'test-user-id' });

    const request = new NextRequest('http://localhost:3000/api/projections/calculate', {
      method: 'POST',
      body: JSON.stringify({
        incomeStreams: [
          {
            id: 'invalid',
            name: 'Invalid Stream',
            type: 'invalid_type', // Not a valid type
            annualAmount: 10000,
            startAge: 65,
            inflationAdjusted: true,
          },
        ],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should reject incomeStreams with negative annualAmount', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'test-user-id' });

    const request = new NextRequest('http://localhost:3000/api/projections/calculate', {
      method: 'POST',
      body: JSON.stringify({
        incomeStreams: [
          {
            id: 'ss',
            name: 'Social Security',
            type: 'social_security',
            annualAmount: -5000, // Negative amount
            startAge: 67,
            inflationAdjusted: true,
          },
        ],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
