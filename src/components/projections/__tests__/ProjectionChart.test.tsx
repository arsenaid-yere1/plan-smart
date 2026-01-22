import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectionChart } from '../ProjectionChart';
import type { ProjectionRecord } from '@/lib/projections/types';

const mockRecords: ProjectionRecord[] = [
  {
    age: 30,
    year: 2025,
    balance: 100000,
    inflows: 20000,
    outflows: 0,
    balanceByType: { taxDeferred: 50000, taxFree: 30000, taxable: 20000 },
  },
  {
    age: 40,
    year: 2035,
    balance: 300000,
    inflows: 25000,
    outflows: 0,
    balanceByType: { taxDeferred: 150000, taxFree: 90000, taxable: 60000 },
  },
  {
    age: 50,
    year: 2045,
    balance: 600000,
    inflows: 30000,
    outflows: 0,
    balanceByType: { taxDeferred: 300000, taxFree: 180000, taxable: 120000 },
  },
  {
    age: 65,
    year: 2060,
    balance: 1200000,
    inflows: 24000,
    outflows: 50000,
    balanceByType: { taxDeferred: 600000, taxFree: 360000, taxable: 240000 },
  },
  {
    age: 80,
    year: 2075,
    balance: 800000,
    inflows: 24000,
    outflows: 60000,
    balanceByType: { taxDeferred: 400000, taxFree: 240000, taxable: 160000 },
  },
];

const mockRecordsWithNegative: ProjectionRecord[] = [
  {
    age: 30,
    year: 2025,
    balance: 50000,
    inflows: 10000,
    outflows: 0,
    balanceByType: { taxDeferred: 25000, taxFree: 15000, taxable: 10000 },
  },
  {
    age: 65,
    year: 2060,
    balance: 100000,
    inflows: 20000,
    outflows: 80000,
    balanceByType: { taxDeferred: 50000, taxFree: 30000, taxable: 20000 },
  },
  {
    age: 70,
    year: 2065,
    balance: -50000,
    inflows: 20000,
    outflows: 100000,
    balanceByType: { taxDeferred: 0, taxFree: 0, taxable: 0 },
  },
  {
    age: 80,
    year: 2075,
    balance: -200000,
    inflows: 20000,
    outflows: 100000,
    balanceByType: { taxDeferred: 0, taxFree: 0, taxable: 0 },
  },
];

describe('ProjectionChart', () => {
  it('renders chart with Age toggle active by default', () => {
    render(
      <ProjectionChart
        records={mockRecords}
        retirementAge={65}
        currentAge={30}
      />
    );

    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Year')).toBeInTheDocument();
    expect(screen.getByText('View by:')).toBeInTheDocument();
  });

  it('toggles between Age and Year view', () => {
    render(
      <ProjectionChart
        records={mockRecords}
        retirementAge={65}
        currentAge={30}
      />
    );

    const yearButton = screen.getByText('Year');
    fireEvent.click(yearButton);

    // Year button should now be active (has aria-pressed=true)
    expect(yearButton).toHaveAttribute('aria-pressed', 'true');

    const ageButton = screen.getByText('Age');
    expect(ageButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows legend with correct labels', () => {
    render(
      <ProjectionChart
        records={mockRecords}
        retirementAge={65}
        currentAge={30}
      />
    );

    expect(screen.getByText('Accumulation')).toBeInTheDocument();
    expect(screen.getByText('Retirement')).toBeInTheDocument();
    expect(screen.getByText('Total Balance')).toBeInTheDocument();
    expect(screen.getByText('Retirement Start')).toBeInTheDocument();
  });

  it('shows Depleted legend item when negative balances exist', () => {
    render(
      <ProjectionChart
        records={mockRecordsWithNegative}
        retirementAge={65}
        currentAge={30}
      />
    );

    expect(screen.getByText('Depleted')).toBeInTheDocument();
  });

  it('does not show Depleted legend item when all balances are positive', () => {
    render(
      <ProjectionChart
        records={mockRecords}
        retirementAge={65}
        currentAge={30}
      />
    );

    expect(screen.queryByText('Depleted')).not.toBeInTheDocument();
  });

  it('has accessible toggle buttons with aria-pressed', () => {
    render(
      <ProjectionChart
        records={mockRecords}
        retirementAge={65}
        currentAge={30}
      />
    );

    const ageButton = screen.getByText('Age');
    const yearButton = screen.getByText('Year');

    // Age should be pressed by default
    expect(ageButton).toHaveAttribute('aria-pressed', 'true');
    expect(yearButton).toHaveAttribute('aria-pressed', 'false');

    // Toggle groups should have proper role
    const toggleGroups = screen.getAllByRole('group');
    expect(toggleGroups.length).toBe(2); // x-axis and inflation toggles
    expect(toggleGroups[0]).toHaveAttribute('aria-labelledby', 'x-axis-label');
    expect(toggleGroups[1]).toHaveAttribute('aria-labelledby', 'inflation-label');
  });

  it("shows inflation toggle with Today's $ active by default", () => {
    render(
      <ProjectionChart
        records={mockRecords}
        retirementAge={65}
        currentAge={30}
      />
    );

    const futureButton = screen.getByText('Future $');
    const todaysButton = screen.getByText("Today's $");

    expect(futureButton).toHaveAttribute('aria-pressed', 'false');
    expect(todaysButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders with different retirement ages', () => {
    const { rerender } = render(
      <ProjectionChart
        records={mockRecords}
        retirementAge={60}
        currentAge={30}
      />
    );

    // Should render without errors
    expect(screen.getByText('View by:')).toBeInTheDocument();

    rerender(
      <ProjectionChart
        records={mockRecords}
        retirementAge={70}
        currentAge={30}
      />
    );

    // Should still render without errors
    expect(screen.getByText('View by:')).toBeInTheDocument();
  });
});

// Test data for spending view
const mockRecordsWithSpending: ProjectionRecord[] = [
  {
    age: 65,
    year: 2030,
    balance: 1000000,
    inflows: 0,
    outflows: 50000,
    balanceByType: { taxDeferred: 500000, taxFree: 300000, taxable: 200000 },
    essentialExpenses: 30000,
    discretionaryExpenses: 20000,
    activePhaseName: 'Go-Go Years',
    activePhaseId: 'phase-1',
  },
  {
    age: 75,
    year: 2040,
    balance: 800000,
    inflows: 0,
    outflows: 40000,
    balanceByType: { taxDeferred: 400000, taxFree: 250000, taxable: 150000 },
    essentialExpenses: 28000,
    discretionaryExpenses: 12000,
    activePhaseName: 'Slow-Go',
    activePhaseId: 'phase-2',
  },
  {
    age: 85,
    year: 2050,
    balance: 600000,
    inflows: 0,
    outflows: 35000,
    balanceByType: { taxDeferred: 300000, taxFree: 200000, taxable: 100000 },
    essentialExpenses: 30000,
    discretionaryExpenses: 5000,
    activePhaseName: 'No-Go',
    activePhaseId: 'phase-3',
  },
];

describe('ProjectionChart - Spending View', () => {
  it('shows view toggle when spending is enabled', () => {
    render(
      <ProjectionChart
        records={mockRecordsWithSpending}
        retirementAge={65}
        currentAge={55}
        spendingEnabled={true}
      />
    );

    expect(screen.getByRole('button', { name: /balance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /spending/i })).toBeInTheDocument();
  });

  it('hides view toggle when spending is not enabled', () => {
    render(
      <ProjectionChart
        records={mockRecordsWithSpending}
        retirementAge={65}
        currentAge={55}
        spendingEnabled={false}
      />
    );

    expect(screen.queryByRole('button', { name: /spending/i })).not.toBeInTheDocument();
  });

  it('defaults to balance view when spending is enabled', () => {
    render(
      <ProjectionChart
        records={mockRecordsWithSpending}
        retirementAge={65}
        currentAge={55}
        spendingEnabled={true}
      />
    );

    const balanceButton = screen.getByRole('button', { name: /balance/i });
    const spendingButton = screen.getByRole('button', { name: /spending/i });

    expect(balanceButton).toHaveAttribute('aria-pressed', 'true');
    expect(spendingButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles to spending view when clicking Spending button', () => {
    render(
      <ProjectionChart
        records={mockRecordsWithSpending}
        retirementAge={65}
        currentAge={55}
        spendingEnabled={true}
      />
    );

    const spendingButton = screen.getByRole('button', { name: /spending/i });
    fireEvent.click(spendingButton);

    expect(spendingButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /balance/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('shows spending legend items when in spending view', () => {
    render(
      <ProjectionChart
        records={mockRecordsWithSpending}
        retirementAge={65}
        currentAge={55}
        spendingEnabled={true}
      />
    );

    // Switch to spending view
    fireEvent.click(screen.getByRole('button', { name: /spending/i }));

    // Should show spending-specific legend items
    expect(screen.getByText('Annual Spending')).toBeInTheDocument();
    expect(screen.getByText('Phase Boundary')).toBeInTheDocument();

    // Should not show balance legend items
    expect(screen.queryByText('Accumulation')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Balance')).not.toBeInTheDocument();
  });

  it('shows phase names in spending legend', () => {
    render(
      <ProjectionChart
        records={mockRecordsWithSpending}
        retirementAge={65}
        currentAge={55}
        spendingEnabled={true}
      />
    );

    // Switch to spending view
    fireEvent.click(screen.getByRole('button', { name: /spending/i }));

    // Should show phase names in legend
    expect(screen.getByText('Go-Go Years')).toBeInTheDocument();
    expect(screen.getByText('Slow-Go')).toBeInTheDocument();
    expect(screen.getByText('No-Go')).toBeInTheDocument();
  });

  it('does not call onPhaseClick when not provided', () => {
    render(
      <ProjectionChart
        records={mockRecordsWithSpending}
        retirementAge={65}
        currentAge={55}
        spendingEnabled={true}
      />
    );

    // Switch to spending view - should not error without onPhaseClick
    fireEvent.click(screen.getByRole('button', { name: /spending/i }));

    // No errors expected
    expect(screen.getByText('Annual Spending')).toBeInTheDocument();
  });

  it('has correct aria-labelledby for view mode toggle', async () => {
    render(
      <ProjectionChart
        records={mockRecordsWithSpending}
        retirementAge={65}
        currentAge={55}
        spendingEnabled={true}
      />
    );

    const toggleGroups = screen.getAllByRole('group');
    // Should now have 3 toggle groups: x-axis, inflation, and view mode
    expect(toggleGroups.length).toBe(3);
    expect(toggleGroups[2]).toHaveAttribute('aria-labelledby', 'view-mode-label');
  });
});
