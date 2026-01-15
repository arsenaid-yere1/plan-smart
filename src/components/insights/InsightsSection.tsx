'use client';

import { useEffect, useState } from 'react';
import { TopLeversCard } from './TopLeversCard';
import { LowFrictionWinsCard } from './LowFrictionWinsCard';
import { AssumptionSensitivityCard } from './AssumptionSensitivityCard';
import type { InsightsResponse } from '@/lib/projections/sensitivity-types';

interface InsightsSectionProps {
  isScenarioActive: boolean;
}

export function InsightsSection({ isScenarioActive }: InsightsSectionProps) {
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6 mt-8">
      <div>
        <h2 className="text-xl font-semibold mb-1">Insights</h2>
        <p className="text-sm text-muted-foreground">
          Understanding what affects your retirement projection most
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
  );
}
