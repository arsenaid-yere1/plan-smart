'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SpendingTrajectoryChart } from './SpendingTrajectoryChart';
import { SpendingImpactSummary } from './SpendingImpactSummary';
import type { SpendingComparison, SpendingComparisonResponse } from '@/lib/projections/types';

interface SpendingCompareTabProps {
  retirementAge: number;
  inflationRate: number;
}

export function SpendingCompareTab({
  retirementAge,
  inflationRate,
}: SpendingCompareTabProps) {
  const [comparison, setComparison] = useState<SpendingComparison | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchComparison = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/projections/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to load comparison');
        }

        const data: SpendingComparisonResponse = await response.json();
        setComparison(data.comparison);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load comparison');
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparison();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">
          Calculating spending comparison...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Unable to Compare</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!comparison) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Comparison Available</AlertTitle>
        <AlertDescription>
          Configure spending phases in your profile to see how phased spending
          compares to flat spending.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {/* Impact Summary */}
      <SpendingImpactSummary
        comparison={comparison}
        retirementAge={retirementAge}
      />

      {/* Spending Trajectory Chart */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Spending Trajectory</h3>
        <p className="text-sm text-muted-foreground mb-4">
          How your annual spending changes throughout retirement
        </p>
        <SpendingTrajectoryChart
          data={comparison.phasedSpending.yearlySpending}
          flatData={comparison.flatSpending.yearlySpending}
          showRealDollars={true}
          inflationRate={inflationRate}
          retirementAge={retirementAge}
        />
      </div>
    </div>
  );
}
