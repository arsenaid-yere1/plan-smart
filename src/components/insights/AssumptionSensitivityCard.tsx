'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SensitiveAssumption } from '@/lib/projections/sensitivity-types';

interface AssumptionSensitivityCardProps {
  assumptions: SensitiveAssumption[];
  explanation: string;
  isLoading?: boolean;
}

export function AssumptionSensitivityCard({
  assumptions,
  explanation,
  isLoading,
}: AssumptionSensitivityCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 animate-pulse" />
            Analyzing Assumptions...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5 text-primary" />
          Assumption Sensitivity
        </CardTitle>
        <CardDescription>
          Which assumptions your projection depends on most
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {explanation && (
          <p className="text-sm leading-relaxed">{explanation}</p>
        )}

        <div className="space-y-3">
          {assumptions.map((assumption) => (
            <AssumptionItem key={assumption.assumption} assumption={assumption} />
          ))}
        </div>

        <div className="p-3 rounded-lg bg-muted/50 mt-4">
          <p className="text-sm text-muted-foreground">
            <Info className="h-4 w-4 inline mr-2" />
            These assumptions may evolve over time. Periodic review helps keep projections aligned with your actual situation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function AssumptionItem({ assumption }: { assumption: SensitiveAssumption }) {
  return (
    <div className="p-3 rounded-lg border">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-sm">{assumption.displayName}</h4>
        <SensitivityMeter score={assumption.sensitivityScore} />
      </div>
      <p className="text-sm text-muted-foreground mb-2">
        Current: <span className="font-medium text-foreground">{assumption.formattedValue}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {assumption.explanation}
      </p>
      <p className="text-xs text-primary mt-2">
        {assumption.reviewSuggestion}
      </p>
    </div>
  );
}

function SensitivityMeter({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            score >= 80 && 'bg-destructive',
            score >= 50 && score < 80 && 'bg-warning',
            score < 50 && 'bg-success'
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{score}%</span>
    </div>
  );
}
