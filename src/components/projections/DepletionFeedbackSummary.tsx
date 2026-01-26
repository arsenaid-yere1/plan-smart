'use client';

import { useState } from 'react';
import type { DepletionFeedback, DepletionTarget } from '@/lib/projections/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Target, TrendingUp, TrendingDown, Check, AlertTriangle, Wallet, Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DepletionFeedbackSummaryProps {
  feedback: DepletionFeedback;
  depletionTarget: DepletionTarget;
  currentPlannedSpending: number;
  defaultOpen?: boolean;
}

const statusConfig = {
  on_track: {
    icon: Check,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    textColor: 'text-green-700 dark:text-green-300',
    barColor: 'bg-green-500',
    label: 'On Track',
  },
  underspending: {
    icon: TrendingDown,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    textColor: 'text-amber-700 dark:text-amber-300',
    barColor: 'bg-amber-500',
    label: 'Underspending',
  },
  overspending: {
    icon: TrendingUp,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-700 dark:text-red-300',
    barColor: 'bg-red-500',
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
  defaultOpen = false,
}: DepletionFeedbackSummaryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { trajectoryStatus, sustainableMonthlySpending, sustainableAnnualSpending, phaseBreakdown } = feedback;
  const config = statusConfig[trajectoryStatus];
  const StatusIcon = config.icon;

  const currentMonthlySpending = currentPlannedSpending / 12;
  const spendingDiff = sustainableMonthlySpending - currentMonthlySpending;

  // Calculate spending ratio for progress bar (capped at 150% for display)
  const spendingRatio = sustainableMonthlySpending > 0
    ? Math.min(currentMonthlySpending / sustainableMonthlySpending, 1.5)
    : 0;
  const spendingPercent = Math.round(spendingRatio * 100);

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className={cn('h-5 w-5', config.color)} />
            <CardTitle className="text-base">Spending Guidance</CardTitle>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', config.bgColor, config.color)}>
              {config.label}
            </span>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </div>
        <CardDescription>
          How to reach {depletionTarget.targetPercentageSpent}% depletion by age {depletionTarget.targetAge}
        </CardDescription>
      </CardHeader>

      <CardContent
        className={cn(
          'space-y-4 overflow-hidden transition-all duration-200',
          isOpen ? 'opacity-100' : 'max-h-0 py-0 opacity-0'
        )}
      >
        {/* Status Indicator */}
        <div
          className={cn(
            'flex items-center justify-between gap-3 p-3 rounded-lg',
            config.bgColor
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StatusIcon className={cn('h-4 w-4', config.color)} />
              <p className={cn('font-semibold', config.textColor)}>
                {config.label}
              </p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {feedback.statusMessage}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={cn('text-2xl font-bold', config.textColor)}>
              {formatCurrency(sustainableMonthlySpending)}
            </p>
            <p className="text-xs text-muted-foreground">/month sustainable</p>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              <span className="text-xs">Sustainable Spending</span>
            </div>
            <p className="font-medium">{formatCurrency(sustainableAnnualSpending)}/yr</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-xs">Balance at Target Age</span>
            </div>
            <p className="font-medium">{formatCurrency(feedback.projectedReserveAtTarget)}</p>
          </div>
        </div>

        {/* Spending Progress Bar */}
        {currentPlannedSpending > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Current vs Sustainable Spending</span>
              <span>{spendingPercent}%</span>
            </div>
            <div className="relative h-2 rounded-full bg-muted overflow-hidden">
              {/* Sustainable target marker at 100% */}
              <div className="absolute top-0 left-[100%] w-0.5 h-full bg-muted-foreground/40 -translate-x-0.5" />
              {/* Current spending bar */}
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  spendingRatio <= 0.95 ? 'bg-amber-500' :
                  spendingRatio <= 1.05 ? 'bg-green-500' :
                  'bg-red-500'
                )}
                style={{ width: `${Math.min(spendingPercent, 100)}%` }}
              />
              {/* Overflow indicator for overspending */}
              {spendingRatio > 1 && (
                <div
                  className="absolute top-0 h-full bg-red-500/50"
                  style={{
                    left: '100%',
                    width: `${Math.min((spendingRatio - 1) * 100, 50)}%`
                  }}
                />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {spendingDiff > 0 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span>
                    You can spend{' '}
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(Math.abs(spendingDiff))}/month more
                    </span>
                  </span>
                </>
              ) : spendingDiff < 0 ? (
                <>
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>
                    Consider reducing by{' '}
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {formatCurrency(Math.abs(spendingDiff))}/month
                    </span>
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Your spending matches the sustainable rate</span>
              )}
            </div>
          </div>
        )}

        {/* Phase Breakdown */}
        {phaseBreakdown && phaseBreakdown.length > 0 && (
          <div className="pt-4 border-t space-y-3">
            <h4 className="text-sm font-medium">Spending by Life Phase</h4>
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
                  <div className="text-right">
                    <span className="font-medium">
                      {formatCurrency(phase.monthlySpending)}/mo
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      · {phase.yearsInPhase} yrs
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {feedback.warningMessages.length > 0 && (
          <div className="space-y-2 pt-2">
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
      </CardContent>
    </Card>
  );
}
