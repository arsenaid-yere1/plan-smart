'use client';

import { Shield, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { IncomeFloorAnalysis } from '@/lib/projections/income-floor-types';
import { cn } from '@/lib/utils';

interface IncomeFloorCardProps {
  analysis: IncomeFloorAnalysis | null;
  explanation: string;
  isLoading: boolean;
}

export function IncomeFloorCard({
  analysis,
  explanation,
  isLoading,
}: IncomeFloorCardProps) {
  // Loading state
  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-muted" />
            <div className="h-5 w-32 rounded bg-muted" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No analysis available
  if (!analysis) {
    return null;
  }

  const statusConfig = getStatusConfig(analysis.status);
  const coveragePercent = Math.round(analysis.coverageRatioAtRetirement * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <statusConfig.icon
            className={cn('h-5 w-5', statusConfig.iconColor)}
          />
          <CardTitle className="text-base">Income Floor</CardTitle>
        </div>
        <CardDescription>
          How well your guaranteed income covers essential expenses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Indicator */}
        <div
          className={cn(
            'flex items-center justify-between gap-3 p-3 rounded-lg',
            statusConfig.bgColor
          )}
        >
          <div className="min-w-0 flex-1">
            <p className={cn('font-semibold', statusConfig.textColor)}>
              {statusConfig.label}
            </p>
            <p className="text-sm text-muted-foreground break-words">
              {analysis.insightStatement}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={cn('text-2xl font-bold', statusConfig.textColor)}>
              {coveragePercent}%
            </p>
            <p className="text-xs text-muted-foreground">coverage</p>
          </div>
        </div>

        {/* Coverage Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Guaranteed Income</p>
            <p className="font-medium">
              ${analysis.guaranteedIncomeAtRetirement.toLocaleString()}/yr
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Essential Expenses</p>
            <p className="font-medium">
              ${analysis.essentialExpensesAtRetirement.toLocaleString()}/yr
            </p>
          </div>
        </div>

        {/* Floor Established Age */}
        {analysis.floorEstablishedAge && (
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span>
              Floor established at age {analysis.floorEstablishedAge}
            </span>
          </div>
        )}

        {/* AI Explanation */}
        {explanation && (
          <p className="text-sm text-muted-foreground border-t pt-3">
            {explanation}
          </p>
        )}

        {/* Coverage Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                statusConfig.barColor
              )}
              style={{ width: `${Math.min(coveragePercent, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusConfig(status: IncomeFloorAnalysis['status']) {
  switch (status) {
    case 'fully-covered':
      return {
        icon: Shield,
        iconColor: 'text-green-600 dark:text-green-400',
        label: 'Fully Covered',
        bgColor: 'bg-green-50 dark:bg-green-950/30',
        textColor: 'text-green-700 dark:text-green-300',
        barColor: 'bg-green-500',
      };
    case 'partial':
      return {
        icon: TrendingUp,
        iconColor: 'text-amber-600 dark:text-amber-400',
        label: 'Partial Coverage',
        bgColor: 'bg-amber-50 dark:bg-amber-950/30',
        textColor: 'text-amber-700 dark:text-amber-300',
        barColor: 'bg-amber-500',
      };
    case 'insufficient':
      return {
        icon: AlertTriangle,
        iconColor: 'text-red-600 dark:text-red-400',
        label: 'Needs Attention',
        bgColor: 'bg-red-50 dark:bg-red-950/30',
        textColor: 'text-red-700 dark:text-red-300',
        barColor: 'bg-red-500',
      };
  }
}
