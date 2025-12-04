import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const mockSignOut = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signOut: mockSignOut,
    },
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should logout successfully', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Logout successful');
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should return 500 if logout fails', async () => {
    mockSignOut.mockRejectedValue(new Error('Logout failed'));

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe('Logout failed');
  });
});
