'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LowFrictionWin } from '@/lib/projections/sensitivity-types';

interface LowFrictionWinsCardProps {
  wins: LowFrictionWin[];
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

export function LowFrictionWinsCard({ wins, isLoading }: LowFrictionWinsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 animate-pulse" />
            Finding Quick Wins...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (wins.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-warning" />
          Small Changes, Big Effects
        </CardTitle>
        <CardDescription>
          Modest adjustments that show meaningful impact in projections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {wins.map((win) => (
          <WinItem key={win.id} win={win} />
        ))}
      </CardContent>
    </Card>
  );
}

function WinItem({ win }: { win: LowFrictionWin }) {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="font-medium text-sm">{win.title}</h4>
            <EffortBadge level={win.effortLevel} />
          </div>
          <p className="text-sm text-muted-foreground mb-2 break-words">
            {win.description}
          </p>
          <p className="text-sm break-words">
            <span className="text-success font-medium">
              {win.impactDescription}
            </span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-success whitespace-nowrap">
            +{formatCurrency(win.potentialImpact)}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground italic mt-3 pt-3 border-t break-words">
        {win.uncertaintyCaveat}
      </p>
    </div>
  );
}

function EffortBadge({ level }: { level: LowFrictionWin['effortLevel'] }) {
  const styles = {
    minimal: 'bg-success/10 text-success',
    low: 'bg-warning/10 text-warning',
    moderate: 'bg-muted text-muted-foreground',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      styles[level]
    )}>
      {level} effort
    </span>
  );
}
