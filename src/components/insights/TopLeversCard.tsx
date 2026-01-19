'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LeverImpact } from '@/lib/projections/sensitivity-types';
import { formatDeltaValue } from '@/lib/projections/sensitivity';

interface TopLeversCardProps {
  levers: LeverImpact[];
  explanation: string;
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

export function TopLeversCard({ levers, explanation, isLoading }: TopLeversCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 animate-pulse" />
            Analyzing Key Factors...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          What Matters Most
        </CardTitle>
        <CardDescription>
          Factors with the biggest effect on your retirement projection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {explanation && (
          <p className="text-sm leading-relaxed">{explanation}</p>
        )}

        <div className="space-y-3">
          {levers.map((lever, index) => (
            <LeverItem key={lever.lever} lever={lever} rank={index + 1} />
          ))}
        </div>

        <p className="text-xs text-muted-foreground italic pt-2 border-t">
          Impact calculated by varying each factor individually. Actual results depend on multiple factors working together.
        </p>
      </CardContent>
    </Card>
  );
}

function LeverItem({ lever, rank }: { lever: LeverImpact; rank: number }) {
  const isPositive = lever.impactOnBalance > 0;

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
          rank === 1 && 'bg-primary text-primary-foreground',
          rank === 2 && 'bg-secondary text-secondary-foreground',
          rank === 3 && 'bg-muted-foreground/20 text-muted-foreground'
        )}>
          {rank}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{lever.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {lever.testDirection === 'increase' ? '+' : '-'}{formatDeltaValue(lever.lever, lever.testDelta)}
          </p>
        </div>
      </div>
      <div className={cn(
        'text-right shrink-0',
        isPositive ? 'text-success' : 'text-destructive'
      )}>
        <p className="font-semibold text-sm whitespace-nowrap">
          {isPositive ? '+' : ''}{formatCurrency(lever.impactOnBalance)}
        </p>
        <p className="text-xs text-muted-foreground whitespace-nowrap">
          {lever.percentImpact.toFixed(1)}% impact
        </p>
      </div>
    </div>
  );
}
