'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { TopLeversCard } from './TopLeversCard';
import { LowFrictionWinsCard } from './LowFrictionWinsCard';
import { AssumptionSensitivityCard } from './AssumptionSensitivityCard';
import type { InsightsResponse } from '@/lib/projections/sensitivity-types';
import { cn } from '@/lib/utils';

interface InsightsSectionProps {
  isScenarioActive: boolean;
}

export function InsightsSection({ isScenarioActive }: InsightsSectionProps) {
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Don't fetch during scenario mode
    if (isScenarioActive) {
      return;
    }

    async function fetchInsights() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/insights/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch insights');
        }

        const data = await response.json() as InsightsResponse;
        setInsights(data);
      } catch (err) {
        console.error('Insights fetch error:', err);
        setError('Unable to load insights');
      } finally {
        setIsLoading(false);
      }
    }

    fetchInsights();
  }, [isScenarioActive]);

  // Hide during scenario mode
  if (isScenarioActive) {
    return null;
  }

  // Show error state
  if (error && !isLoading) {
    return null; // Silently hide if insights fail to load
  }

  // Build summary text for collapsed state
  const topLever = insights?.topLevers[0];
  const summaryText = topLever
    ? `${topLever.displayName} has the biggest impact on your projection`
    : 'Discover what affects your retirement most';

  return (
    <div className="mt-8 rounded-lg border bg-card shadow-sm">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Insights</h2>
            <p className="text-sm text-muted-foreground">
              {summaryText}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-muted-foreground transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
            <TopLeversCard
              levers={insights?.topLevers ?? []}
              explanation={insights?.leverExplanation ?? ''}
              isLoading={isLoading}
            />
            <LowFrictionWinsCard
              wins={insights?.lowFrictionWins ?? []}
              isLoading={isLoading}
            />
            <AssumptionSensitivityCard
              assumptions={insights?.sensitiveAssumptions ?? []}
              explanation={insights?.sensitivityExplanation ?? ''}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
}
