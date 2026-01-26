'use client';

import type { DepletionFeedback, DepletionTarget } from '@/lib/projections/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, Check, AlertTriangle, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DepletionFeedbackSummaryProps {
  feedback: DepletionFeedback;
  depletionTarget: DepletionTarget;
  currentPlannedSpending: number;
}

const statusConfig = {
  on_track: {
    icon: Check,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    label: 'On Track',
  },
  underspending: {
    icon: TrendingDown,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    label: 'Underspending',
  },
  overspending: {
    icon: TrendingUp,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    label: 'Overspending',
  },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function DepletionFeedbackSummary({
  feedback,
  depletionTarget,
  currentPlannedSpending,
}: DepletionFeedbackSummaryProps) {
  const { trajectoryStatus, sustainableMonthlySpending, sustainableAnnualSpending, phaseBreakdown } = feedback;
  const config = statusConfig[trajectoryStatus];
  const StatusIcon = config.icon;

  const currentMonthlySpending = currentPlannedSpending / 12;
  const spendingDiff = sustainableMonthlySpending - currentMonthlySpending;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          Spending Guidance
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1', config.bgColor, config.color)}>
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main spending message */}
        <div className={cn('p-4 rounded-lg', config.bgColor)}>
          <p className="text-sm text-muted-foreground">
            To reach {depletionTarget.targetPercentageSpent}% depletion by age {depletionTarget.targetAge}:
          </p>
          <p className="text-2xl font-bold mt-1">
            {formatCurrency(sustainableMonthlySpending)}/month
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            ({formatCurrency(sustainableAnnualSpending)}/year)
          </p>
        </div>

        {/* Comparison with current plan */}
        {currentPlannedSpending > 0 && (
          <div className="flex items-center gap-2 text-sm">
            {spendingDiff > 0 ? (
              <>
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span>
                  You can spend{' '}
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(Math.abs(spendingDiff))}/month more
                  </span>{' '}
                  than your current plan
                </span>
              </>
            ) : spendingDiff < 0 ? (
              <>
                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span>
                  Your current plan is{' '}
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {formatCurrency(Math.abs(spendingDiff))}/month higher
                  </span>{' '}
                  than sustainable
                </span>
              </>
            ) : (
              <>
                <Minus className="h-4 w-4 text-muted-foreground" />
                <span>Your current plan matches sustainable spending</span>
              </>
            )}
          </div>
        )}

        {/* Phase breakdown */}
        {phaseBreakdown && phaseBreakdown.length > 0 && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Spending by Life Phase</h4>
            <div className="space-y-2">
              {phaseBreakdown.map((phase) => (
                <div
                  key={phase.phaseName}
                  className="flex justify-between items-center p-2 bg-muted/50 rounded"
                >
                  <div>
                    <span className="font-medium">{phase.phaseName}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      (Ages {phase.startAge}-{phase.endAge})
                    </span>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(phase.monthlySpending)}/mo
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {feedback.warningMessages.length > 0 && (
          <div className="space-y-2">
            {feedback.warningMessages.map((warning, i) => (
              <Alert key={i} variant={trajectoryStatus === 'overspending' ? 'destructive' : 'default'} className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm ml-2">
                  {warning}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Reserve at target */}
        <div className="pt-4 border-t text-sm text-muted-foreground">
          <p>
            Projected balance at age {depletionTarget.targetAge}:{' '}
            <span className="font-medium text-foreground">
              {formatCurrency(feedback.projectedReserveAtTarget)}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
