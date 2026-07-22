import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PlansClient } from './plans-client';

vi.mock('@/components/projections', () => ({
  ProjectionChart: () => <div />,
  ProjectionTable: () => <div />,
  ExportPanel: () => <div />,
  SpendingCompareTab: () => <div />,
  SpendingPhaseEditModal: () => <div />,
  DepletionFeedbackSummary: () => <div />,
  AssumptionsPanel: ({ assumptions, onChange }: {
    assumptions: { expectedReturn: number; inflationRate: number; retirementAge: number };
    onChange: (value: { expectedReturn: number; inflationRate: number; retirementAge: number }) => void;
  }) => (
    <div>
      <button onClick={() => onChange({ ...assumptions, expectedReturn: 0.08 })}>change-return</button>
      <button onClick={() => onChange({ expectedReturn: 0.06, inflationRate: 0.025, retirementAge: 67 })}>restore-current</button>
    </div>
  ),
}));
vi.mock('@/components/scenarios', () => ({
  ScenarioInput: () => <div />,
  ScenarioExplanation: () => <div />,
}));
vi.mock('@/components/insights', () => ({ InsightsSection: () => <div /> }));

const projection = {
  records: [{
    age: 66, year: 2026, balance: 100000, inflows: 0, outflows: 0,
    balanceByType: { taxDeferred: 100000, taxFree: 0, taxable: 0 },
  }],
  summary: {
    startingBalance: 100000, endingBalance: 100000, totalContributions: 0,
    totalWithdrawals: 0, yearsUntilDepletion: null, projectedRetirementBalance: 100000,
  },
};

describe('PlansClient warnings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        projection,
        meta: { inputWarnings: [{ field: 'new', message: 'Updated warning', severity: 'warning' }] },
      }),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows initial warnings, replaces them after calculation, and restores them at saved inputs', async () => {
    render(<PlansClient
      initialProjection={projection}
      currentAge={66}
      defaultAssumptions={{ expectedReturn: 0.06, inflationRate: 0.025, retirementAge: 67 }}
      currentAssumptions={{ expectedReturn: 0.06, inflationRate: 0.025, retirementAge: 67 }}
      monthlySpending={5000}
      planId="8e3651b7-27c1-42aa-b959-f9a8d20b1400"
      initialInputWarnings={[{ field: 'rmd', message: 'Initial RMD warning', severity: 'info' }]}
      calculationVersion={2}
    />);

    expect(screen.getByText('Initial RMD warning')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('change-return')[0]);
    await act(async () => vi.advanceTimersByTimeAsync(350));
    expect(screen.getByText('Updated warning')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('restore-current')[0]);
    await act(async () => Promise.resolve());
    expect(screen.getByText('Initial RMD warning')).toBeInTheDocument();
  });
});
