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

function createMockRequest(options: { accept?: string } = {}) {
  return new Request('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: {
      'accept': options.accept || 'application/json',
    },
  });
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should logout successfully and return JSON for API requests', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const request = createMockRequest({ accept: 'application/json' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Logout successful');
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should redirect to login for form submissions', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const request = createMockRequest({ accept: 'text/html,application/xhtml+xml' });
    const response = await POST(request);

    expect(response.status).toBe(303); // See Other - converts POST to GET
    expect(response.headers.get('location')).toContain('/auth/login');
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should return 500 if logout fails for API requests', async () => {
    mockSignOut.mockRejectedValue(new Error('Logout failed'));

    const request = createMockRequest({ accept: 'application/json' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe('Logout failed');
  });

  it('should redirect to login even if logout fails for form submissions', async () => {
    mockSignOut.mockRejectedValue(new Error('Logout failed'));

    const request = createMockRequest({ accept: 'text/html,application/xhtml+xml' });
    const response = await POST(request);

    // Should still redirect (session might already be invalid)
    expect(response.status).toBe(303); // See Other - converts POST to GET
    expect(response.headers.get('location')).toContain('/auth/login');
  });
});
