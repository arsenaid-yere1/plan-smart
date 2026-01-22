'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import type { SpendingComparison } from '@/lib/projections/types';

interface SpendingImpactSummaryProps {
  comparison: SpendingComparison;
  retirementAge: number;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

export function SpendingImpactSummary({
  comparison,
  retirementAge,
}: SpendingImpactSummaryProps) {
  const { flatSpending, phasedSpending, breakEvenAge, longevityDifference } = comparison;

  // Calculate differences
  const balanceDifference = phasedSpending.endingBalance - flatSpending.endingBalance;

  // Determine impact direction for each metric
  const earlyYearsBonusPositive = phasedSpending.earlyYearsBonus > 0;
  const longevityPositive = longevityDifference >= 0;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Spending Strategy Comparison</h3>
      <p className="text-sm text-muted-foreground">
        How phased spending compares to flat spending over your retirement.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Early Years Bonus */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Early Years ({phasedSpending.earlyYearsCount} yrs)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold ${
                  earlyYearsBonusPositive ? 'text-success' : 'text-muted-foreground'
                }`}
              >
                {earlyYearsBonusPositive ? '+' : ''}
                {formatCurrency(phasedSpending.earlyYearsBonus)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {earlyYearsBonusPositive
                ? 'More spending in early retirement'
                : 'Same spending pattern'}
            </p>
          </CardContent>
        </Card>

        {/* Portfolio Longevity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Portfolio Longevity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              {longevityDifference === 0 ? (
                <Minus className="h-5 w-5 text-muted-foreground" />
              ) : longevityPositive ? (
                <ArrowUp className="h-5 w-5 text-success" />
              ) : (
                <ArrowDown className="h-5 w-5 text-destructive" />
              )}
              <span
                className={`text-2xl font-bold ${
                  longevityDifference === 0
                    ? 'text-muted-foreground'
                    : longevityPositive
                    ? 'text-success'
                    : 'text-destructive'
                }`}
              >
                {longevityDifference === 0
                  ? 'Same'
                  : `${Math.abs(longevityDifference)} yr${Math.abs(longevityDifference) !== 1 ? 's' : ''}`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {longevityDifference === 0
                ? 'No change in portfolio duration'
                : longevityPositive
                ? 'Longer portfolio life with phased'
                : 'Shorter portfolio life with phased'}
            </p>
          </CardContent>
        </Card>

        {/* Break-Even Age */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Break-Even Point
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {breakEvenAge !== null ? `Age ${breakEvenAge}` : 'Never'}
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              {breakEvenAge !== null
                ? `After ${breakEvenAge - retirementAge} years of retirement`
                : 'Cumulative spending never equals'}
            </p>
          </CardContent>
        </Card>

        {/* Ending Balance Difference */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Ending Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              {balanceDifference === 0 ? (
                <Minus className="h-5 w-5 text-muted-foreground" />
              ) : balanceDifference > 0 ? (
                <ArrowUp className="h-5 w-5 text-success" />
              ) : (
                <ArrowDown className="h-5 w-5 text-warning" />
              )}
              <span
                className={`text-2xl font-bold ${
                  balanceDifference === 0
                    ? 'text-muted-foreground'
                    : balanceDifference > 0
                    ? 'text-success'
                    : 'text-warning'
                }`}
              >
                {balanceDifference === 0
                  ? 'Same'
                  : `${balanceDifference > 0 ? '+' : ''}${formatCurrency(balanceDifference)}`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Difference at age 90
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed comparison table */}
      <Card>
        <CardContent className="pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Metric</th>
                <th className="text-right py-2 font-medium">Flat</th>
                <th className="text-right py-2 font-medium">Phased</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">Total Lifetime Spending</td>
                <td className="text-right py-2">
                  {formatCurrency(flatSpending.totalLifetimeSpending)}
                </td>
                <td className="text-right py-2">
                  {formatCurrency(phasedSpending.totalLifetimeSpending)}
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Portfolio Depletes At</td>
                <td className="text-right py-2">
                  {flatSpending.portfolioDepletionAge !== null
                    ? `Age ${flatSpending.portfolioDepletionAge}`
                    : 'Never'}
                </td>
                <td className="text-right py-2">
                  {phasedSpending.portfolioDepletionAge !== null
                    ? `Age ${phasedSpending.portfolioDepletionAge}`
                    : 'Never'}
                </td>
              </tr>
              <tr>
                <td className="py-2">Ending Balance (Age 90)</td>
                <td className="text-right py-2">
                  {formatCurrency(flatSpending.endingBalance)}
                </td>
                <td className="text-right py-2">
                  {formatCurrency(phasedSpending.endingBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
