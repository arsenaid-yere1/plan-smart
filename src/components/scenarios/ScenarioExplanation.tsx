'use client';

import { TrendingUp, TrendingDown, Minus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScenarioExplanationResponse, DeltaDirection } from '@/lib/scenarios/types';
import { cn } from '@/lib/utils';

interface ScenarioExplanationProps {
  explanation: ScenarioExplanationResponse;
  onReset: () => void;
  isLoading?: boolean;
}

function DirectionIcon({ direction }: { direction: DeltaDirection }) {
  switch (direction) {
    case 'positive':
      return <TrendingUp className="h-4 w-4 text-success" />;
    case 'negative':
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    case 'neutral':
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

export function ScenarioExplanation({
  explanation,
  onReset,
  isLoading = false,
}: ScenarioExplanationProps) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <span className="text-primary">Scenario Active</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={isLoading}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset to Base
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Explanation */}
        <p className="text-sm text-foreground leading-relaxed">
          {explanation.explanation}
        </p>

        {/* Key Changes */}
        {explanation.keyChanges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {explanation.keyChanges.map((change, index) => (
              <div
                key={index}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
                  change.direction === 'positive' && 'bg-success/10 text-success',
                  change.direction === 'negative' && 'bg-destructive/10 text-destructive',
                  change.direction === 'neutral' && 'bg-muted text-muted-foreground'
                )}
              >
                <DirectionIcon direction={change.direction} />
                <span>{change.metric}:</span>
                <span className="font-semibold">{change.delta}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
