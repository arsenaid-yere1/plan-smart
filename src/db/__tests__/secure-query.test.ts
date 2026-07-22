import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SecureQueryBuilder } from '../secure-query';

const mockValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockReturning = vi.fn();

vi.mock('../client', () => ({
  db: {
    insert: () => ({
      values: (value: unknown) => {
        mockValues(value);
        return {
          onConflictDoUpdate: (config: unknown) => {
            mockOnConflictDoUpdate(config);
            return { returning: mockReturning };
          },
        };
      },
    }),
  },
}));

const payload = {
  inputs: {},
  assumptions: {},
  records: [],
  summary: {},
  calculationVersion: 2,
} as unknown as Parameters<SecureQueryBuilder['saveProjectionResult']>[1];

describe('SecureQueryBuilder.saveProjectionResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([{ id: 'result-id' }]);
  });

  it('writes calculation version on insert and conflict update with an ownership predicate', async () => {
    const query = new SecureQueryBuilder('user-id');
    vi.spyOn(query, 'getPlanById').mockResolvedValue({ id: 'plan-id' } as never);

    await query.saveProjectionResult('plan-id', payload);

    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      planId: 'plan-id', userId: 'user-id', calculationVersion: 2,
    }));
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      set: expect.objectContaining({ calculationVersion: 2 }),
      setWhere: expect.anything(),
    }));
  });

  it('refuses to write when the authenticated user does not own the plan', async () => {
    const query = new SecureQueryBuilder('user-id');
    vi.spyOn(query, 'getPlanById').mockResolvedValue(undefined as never);

    await expect(query.saveProjectionResult('other-plan', payload)).rejects.toThrow(
      'Plan not found or access denied'
    );
    expect(mockValues).not.toHaveBeenCalled();
  });
});
