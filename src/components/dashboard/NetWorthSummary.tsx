'use client';

import type { NetWorthBreakdown } from '@/lib/utils/net-worth';

interface NetWorthSummaryProps {
  breakdown: NetWorthBreakdown;
  variant?: 'compact' | 'detailed';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function NetWorthSummary({ breakdown, variant = 'compact' }: NetWorthSummaryProps) {
  if (variant === 'compact') {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium text-muted-foreground">Net Worth</h3>
        <p className="text-2xl font-bold">{formatCurrency(breakdown.netWorth)}</p>
        <div className="mt-2 text-sm text-muted-foreground">
          <span>Assets: {formatCurrency(breakdown.totalAssets)}</span>
          <span className="mx-2">•</span>
          <span>Liabilities: {formatCurrency(breakdown.totalLiabilities)}</span>
        </div>
      </div>
    );
  }

  // Detailed variant shows full breakdown
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Net Worth</h3>
        <p className="text-3xl font-bold">{formatCurrency(breakdown.netWorth)}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Assets */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Assets</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Investment Accounts</span>
              <span>{formatCurrency(breakdown.investmentAccounts)}</span>
            </div>
            <div className="flex justify-between">
              <span>Real Estate Value</span>
              <span>{formatCurrency(breakdown.realEstateValue)}</span>
            </div>
            <div className="flex justify-between font-medium border-t pt-1">
              <span>Total Assets</span>
              <span>{formatCurrency(breakdown.totalAssets)}</span>
            </div>
          </div>
        </div>

        {/* Liabilities */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Liabilities</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Mortgages</span>
              <span>{formatCurrency(breakdown.realEstateMortgages)}</span>
            </div>
            <div className="flex justify-between">
              <span>Other Debts</span>
              <span>{formatCurrency(breakdown.otherDebts)}</span>
            </div>
            <div className="flex justify-between font-medium border-t pt-1">
              <span>Total Liabilities</span>
              <span>{formatCurrency(breakdown.totalLiabilities)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Property Equity (if any real estate) */}
      {breakdown.realEstateValue > 0 && (
        <div className="text-sm text-muted-foreground border-t pt-2">
          Property Equity: {formatCurrency(breakdown.realEstateEquity)}
        </div>
      )}
    </div>
  );
}
