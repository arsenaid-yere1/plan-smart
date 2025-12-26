'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { ProjectionChart, ProjectionTable, AssumptionsPanel, type Assumptions } from '@/components/projections';
import { getRetirementStatus, type RetirementStatus } from '@/lib/projections';
import type { ProjectionResult } from '@/lib/projections/types';
import { cn } from '@/lib/utils';

interface PlansClientProps {
  initialProjection: ProjectionResult;
  currentAge: number;
  defaultAssumptions: Assumptions;
  monthlySpending: number;
}

export function PlansClient({
  initialProjection,
  currentAge,
  defaultAssumptions,
  monthlySpending,
}: PlansClientProps) {
  const [assumptions, setAssumptions] = useState<Assumptions>(defaultAssumptions);
  const [projection, setProjection] = useState<ProjectionResult>(initialProjection);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced recalculation
  useEffect(() => {
    // Skip if assumptions match defaults (initial state)
    const hasChanges =
      assumptions.expectedReturn !== defaultAssumptions.expectedReturn ||
      assumptions.inflationRate !== defaultAssumptions.inflationRate ||
      assumptions.retirementAge !== defaultAssumptions.retirementAge;

    if (!hasChanges) {
      setProjection(initialProjection);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/projections/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedReturn: assumptions.expectedReturn,
            inflationRate: assumptions.inflationRate,
            retirementAge: assumptions.retirementAge,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to calculate projection');
        }

        const data = await response.json();
        setProjection(data.projection);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [assumptions, defaultAssumptions, initialProjection]);

  const handleReset = useCallback(() => {
    setAssumptions(defaultAssumptions);
  }, [defaultAssumptions]);

  // Calculate status from current projection
  const statusResult = getRetirementStatus(projection.summary, currentAge);

  // Format helpers
  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
    return `$${Math.round(value)}`;
  };

  const StatusIcon = ({ status }: { status: RetirementStatus }) => {
    switch (status) {
      case 'on-track':
        return <CheckCircle2 className="h-6 w-6" />;
      case 'needs-adjustment':
        return <AlertTriangle className="h-6 w-6" />;
      case 'at-risk':
        return <XCircle className="h-6 w-6" />;
    }
  };

  const shortfallAge =
    projection.summary.yearsUntilDepletion !== null
      ? currentAge + projection.summary.yearsUntilDepletion
      : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Your Retirement Projection
        </h1>
        <p className="text-muted-foreground">
          Based on your financial information, here&apos;s where you stand.
        </p>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-lg font-semibold',
            statusResult.status === 'on-track' && 'bg-success/10 text-success',
            statusResult.status === 'needs-adjustment' && 'bg-warning/10 text-warning',
            statusResult.status === 'at-risk' && 'bg-destructive/10 text-destructive'
          )}
        >
          <StatusIcon status={statusResult.status} />
          {statusResult.label}
        </div>
        {isLoading && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Calculation Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Left Column: Chart & Metrics */}
        <div className="space-y-6">
          {/* Snapshot Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>At Retirement (Age {assumptions.retirementAge})</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(projection.summary.projectedRetirementBalance)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Retirement Age</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  {assumptions.retirementAge}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Funds Last Until</CardDescription>
              </CardHeader>
              <CardContent>
                {projection.summary.yearsUntilDepletion === null ? (
                  <p className="text-2xl font-bold text-success">Age 90+</p>
                ) : (
                  <p className="text-2xl font-bold text-destructive">
                    Age {currentAge + projection.summary.yearsUntilDepletion}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Monthly Spending</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(monthlySpending)}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <div>
            <h2 className="text-lg font-semibold mb-2">Assets Over Time</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your projected balance from age {currentAge} to 90
            </p>
            <ProjectionChart
              records={projection.records}
              retirementAge={assumptions.retirementAge}
              currentAge={currentAge}
              inflationRate={assumptions.inflationRate}
              shortfallAge={shortfallAge}
            />
          </div>

          {/* Table */}
          <ProjectionTable
            records={projection.records}
            retirementAge={assumptions.retirementAge}
          />
        </div>

        {/* Right Column: Assumptions Panel */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <AssumptionsPanel
            assumptions={assumptions}
            defaultAssumptions={defaultAssumptions}
            currentAge={currentAge}
            onChange={setAssumptions}
            onReset={handleReset}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
