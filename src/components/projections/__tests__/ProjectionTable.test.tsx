import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectionTable } from '../ProjectionTable';
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

describe('ProjectionTable', () => {
  beforeEach(() => {
    // Mock URL.createObjectURL and URL.revokeObjectURL for CSV export
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('renders collapsible trigger', () => {
    render(<ProjectionTable records={mockRecords} retirementAge={65} />);

    expect(screen.getByText('View Year-by-Year Details')).toBeInTheDocument();
  });

  it('table is collapsed by default', () => {
    render(<ProjectionTable records={mockRecords} retirementAge={65} />);

    // Table headers should not be visible when collapsed
    expect(screen.queryByText('Balance')).not.toBeInTheDocument();
    expect(screen.queryByText('Income')).not.toBeInTheDocument();
  });

  it('expands table when trigger is clicked', () => {
    render(<ProjectionTable records={mockRecords} retirementAge={65} />);

    const trigger = screen.getByText('View Year-by-Year Details');
    fireEvent.click(trigger);

    // Table headers should now be visible
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
    expect(screen.getByText('Net Change')).toBeInTheDocument();
    expect(screen.getByText('Phase')).toBeInTheDocument();
  });

  it('shows Export CSV button when expanded', () => {
    render(<ProjectionTable records={mockRecords} retirementAge={65} />);

    // Export button should not be visible when collapsed
    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();

    // Expand the table
    fireEvent.click(screen.getByText('View Year-by-Year Details'));

    // Export button should now be visible
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('displays correct number of rows', () => {
    render(<ProjectionTable records={mockRecords} retirementAge={65} />);

    fireEvent.click(screen.getByText('View Year-by-Year Details'));

    // Check for age values in the table
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('65')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('shows summary with record count and retirement age', () => {
    render(<ProjectionTable records={mockRecords} retirementAge={65} />);

    fireEvent.click(screen.getByText('View Year-by-Year Details'));

    expect(screen.getByText(/Showing 4 years/)).toBeInTheDocument();
    expect(screen.getByText(/Retirement starts at age 65/)).toBeInTheDocument();
  });

  it('displays phase badges correctly', () => {
    render(<ProjectionTable records={mockRecords} retirementAge={65} />);

    fireEvent.click(screen.getByText('View Year-by-Year Details'));

    // Should have accumulation phases for ages before 65
    const accumulationBadges = screen.getAllByText('Accumulation');
    expect(accumulationBadges.length).toBe(2);

    // Should have retirement phases for ages 65+
    const retirementBadges = screen.getAllByText('Retirement');
    expect(retirementBadges.length).toBe(2);
  });

  it('has accessible trigger with aria-expanded', () => {
    render(<ProjectionTable records={mockRecords} retirementAge={65} />);

    const trigger = screen.getByRole('button', { name: /View Year-by-Year Details/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses table when trigger is clicked again', () => {
    render(<ProjectionTable records={mockRecords} retirementAge={65} />);

    const trigger = screen.getByText('View Year-by-Year Details');

    // Expand
    fireEvent.click(trigger);
    expect(screen.getByText('Balance')).toBeInTheDocument();

    // Collapse
    fireEvent.click(trigger);
    expect(screen.queryByText('Balance')).not.toBeInTheDocument();
  });

  it('triggers CSV download when Export CSV is clicked', () => {
    const createElementSpy = vi.spyOn(document, 'createElement');

    render(<ProjectionTable records={mockRecords} retirementAge={65} />);

    fireEvent.click(screen.getByText('View Year-by-Year Details'));
    fireEvent.click(screen.getByText('Export CSV'));

    // Check that a link element was created for download
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });
});
