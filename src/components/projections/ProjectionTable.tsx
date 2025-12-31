'use client';

import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectionRecord } from '@/lib/projections/types';

interface ProjectionTableProps {
  records: ProjectionRecord[];
  retirementAge: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProjectionTable({ records, retirementAge }: ProjectionTableProps) {
  const [open, setOpen] = useState(false);

  const tableData = useMemo(() => {
    return records.map((record, index) => ({
      ...record,
      netChange: index > 0
        ? record.balance - records[index - 1].balance
        : record.inflows - record.outflows,
      isRetirement: record.age >= retirementAge,
    }));
  }, [records, retirementAge]);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
        View Year-by-Year Details
      </button>

      {open && (
        <div className="mt-4">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Age</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Year</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Income</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Expenses</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net Change</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tableData.map((row) => (
                    <tr
                      key={row.age}
                      className={cn(
                        'hover:bg-muted/30 transition-colors',
                        row.age === retirementAge && 'bg-primary/5 font-medium'
                      )}
                    >
                      <td className="px-4 py-2 text-foreground">{row.age}</td>
                      <td className="px-4 py-2 text-foreground">{row.year}</td>
                      <td className={cn(
                        'px-4 py-2 text-right',
                        row.balance < 0 ? 'text-destructive' : 'text-foreground'
                      )}>
                        {formatCurrency(row.balance)}
                      </td>
                      <td className="px-4 py-2 text-right text-foreground">
                        {formatCurrency(row.inflows)}
                      </td>
                      <td className="px-4 py-2 text-right text-foreground">
                        {formatCurrency(row.outflows)}
                      </td>
                      <td className={cn(
                        'px-4 py-2 text-right',
                        row.netChange >= 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {row.netChange >= 0 ? '+' : ''}{formatCurrency(row.netChange)}
                      </td>
                      <td className="px-4 py-2">
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          row.isRetirement
                            ? 'bg-success/10 text-success'
                            : 'bg-primary/10 text-primary'
                        )}>
                          {row.isRetirement ? 'Retirement' : 'Accumulation'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Showing {records.length} years • Retirement starts at age {retirementAge}
          </p>
        </div>
      )}
    </div>
  );
}
