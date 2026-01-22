import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { SpendingPhaseEditModal } from '../SpendingPhaseEditModal';
import type { SpendingPhaseConfig } from '@/lib/projections/types';

describe('SpendingPhaseEditModal', () => {
  const mockConfig: SpendingPhaseConfig = {
    enabled: true,
    phases: [
      {
        id: 'phase-1',
        name: 'Go-Go Years',
        startAge: 65,
        essentialMultiplier: 1.0,
        discretionaryMultiplier: 1.5,
      },
      {
        id: 'phase-2',
        name: 'Slow-Go',
        startAge: 75,
        essentialMultiplier: 1.0,
        discretionaryMultiplier: 1.0,
      },
    ],
  };

  it('renders nothing when localPhase is null', () => {
    const { container } = render(
      <SpendingPhaseEditModal
        open={true}
        onOpenChange={vi.fn()}
        phaseId={null}
        config={mockConfig}
        onSave={vi.fn()}
      />
    );

    // Dialog should not be rendered when phaseId is null
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('displays phase name and settings when opened', async () => {
    render(
      <SpendingPhaseEditModal
        open={true}
        onOpenChange={vi.fn()}
        phaseId="phase-1"
        config={mockConfig}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/edit go-go years/i)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Go-Go Years')).toBeInTheDocument();
    expect(screen.getByDisplayValue('65')).toBeInTheDocument();
  });

  it('calls onSave with updated config when saved', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);

    render(
      <SpendingPhaseEditModal
        open={true}
        onOpenChange={vi.fn()}
        phaseId="phase-1"
        config={mockConfig}
        onSave={handleSave}
      />
    );

    // Wait for modal to be ready
    await waitFor(() => {
      expect(screen.getByDisplayValue('Go-Go Years')).toBeInTheDocument();
    });

    // Change the phase name
    const nameInput = screen.getByDisplayValue('Go-Go Years');
    fireEvent.change(nameInput, { target: { value: 'Active Years' } });

    // Save
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          phases: expect.arrayContaining([
            expect.objectContaining({ name: 'Active Years' }),
          ]),
        })
      );
    });
  });

  it('closes without saving when cancelled', async () => {
    const handleOpenChange = vi.fn();
    const handleSave = vi.fn();

    render(
      <SpendingPhaseEditModal
        open={true}
        onOpenChange={handleOpenChange}
        phaseId="phase-1"
        config={mockConfig}
        onSave={handleSave}
      />
    );

    // Wait for modal to be ready
    await waitFor(() => {
      expect(screen.getByDisplayValue('Go-Go Years')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(handleSave).not.toHaveBeenCalled();
  });

  it('shows percentage sliders by default', async () => {
    render(
      <SpendingPhaseEditModal
        open={true}
        onOpenChange={vi.fn()}
        phaseId="phase-1"
        config={mockConfig}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/essential spending.*100%/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/discretionary spending.*150%/i)).toBeInTheDocument();
  });

  it('switches to absolute dollar inputs when toggle is enabled', async () => {
    render(
      <SpendingPhaseEditModal
        open={true}
        onOpenChange={vi.fn()}
        phaseId="phase-1"
        config={mockConfig}
        onSave={vi.fn()}
      />
    );

    // Wait for modal to be ready
    await waitFor(() => {
      expect(screen.getByDisplayValue('Go-Go Years')).toBeInTheDocument();
    });

    // Toggle to absolute mode
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    // Should now show dollar input fields
    await waitFor(() => {
      expect(screen.getByText(/essential.*\$\/year/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/discretionary.*\$\/year/i)).toBeInTheDocument();
  });

  it('updates start age when input changes', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);

    render(
      <SpendingPhaseEditModal
        open={true}
        onOpenChange={vi.fn()}
        phaseId="phase-1"
        config={mockConfig}
        onSave={handleSave}
      />
    );

    // Wait for modal to be ready
    await waitFor(() => {
      expect(screen.getByDisplayValue('65')).toBeInTheDocument();
    });

    // Change start age
    const ageInput = screen.getByDisplayValue('65');
    fireEvent.change(ageInput, { target: { value: '67' } });

    // Save
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          phases: expect.arrayContaining([
            expect.objectContaining({ startAge: 67 }),
          ]),
        })
      );
    });
  });

  it('shows loading state while saving', async () => {
    // Create a promise that we can control
    let resolvePromise: () => void;
    const savePromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    const handleSave = vi.fn().mockReturnValue(savePromise);

    render(
      <SpendingPhaseEditModal
        open={true}
        onOpenChange={vi.fn()}
        phaseId="phase-1"
        config={mockConfig}
        onSave={handleSave}
      />
    );

    // Wait for modal to be ready
    await waitFor(() => {
      expect(screen.getByDisplayValue('Go-Go Years')).toBeInTheDocument();
    });

    // Click save
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });

    // Resolve the promise
    resolvePromise!();

    // Loading should disappear
    await waitFor(() => {
      expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
    });
  });
});
