'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, XCircle, Loader2, ChevronDown, AlertCircle, Info } from 'lucide-react';
import { ProjectionChart, ProjectionTable, AssumptionsPanel, ExportPanel, SpendingCompareTab, SpendingPhaseEditModal, type Assumptions } from '@/components/projections';
import { ScenarioInput, ScenarioExplanation } from '@/components/scenarios';
import { InsightsSection } from '@/components/insights';
import type { ScenarioExplanationResponse } from '@/lib/scenarios/types';
import { getRetirementStatus, type RetirementStatus } from '@/lib/projections';
import type { ProjectionResult, SpendingPhaseConfig } from '@/lib/projections/types';
import type { ProjectionWarning } from '@/lib/projections/warnings';
import { cn } from '@/lib/utils';

interface PlansClientProps {
  initialProjection: ProjectionResult;
  currentAge: number;
  defaultAssumptions: Assumptions;
  currentAssumptions: Assumptions;
  monthlySpending: number;
  planId: string;
}

export function PlansClient({
  initialProjection,
  currentAge,
  defaultAssumptions,
  currentAssumptions,
  monthlySpending,
  planId,
}: PlansClientProps) {
  const [assumptions, setAssumptions] = useState<Assumptions>(currentAssumptions);
  const [projection, setProjection] = useState<ProjectionResult>(initialProjection);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [inputWarnings, setInputWarnings] = useState<ProjectionWarning[]>([]);
  const [mobileAssumptionsOpen, setMobileAssumptionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'assets' | 'compare'>('assets');

  // Scenario state
  const [isScenarioActive, setIsScenarioActive] = useState(false);
  const [baseProjection, setBaseProjection] = useState<ProjectionResult | null>(null);
  const [baseAssumptions, setBaseAssumptions] = useState<Assumptions | null>(null);
  const [scenarioExplanation, setScenarioExplanation] = useState<ScenarioExplanationResponse | null>(null);
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);

  // Spending phase edit state
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [spendingConfig, setSpendingConfig] = useState<SpendingPhaseConfig | null>(null);

  // Fetch spending config on mount
  useEffect(() => {
    const fetchSpendingConfig = async () => {
      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const data = await response.json();
          setSpendingConfig(data.profile?.spendingPhases ?? null);
        }
      } catch (error) {
        console.error('Failed to fetch spending config:', error);
      }
    };
    fetchSpendingConfig();
  }, []);

  // Debounced recalculation
  useEffect(() => {
    // Skip if assumptions match the current saved state
    const hasChanges =
      assumptions.expectedReturn !== currentAssumptions.expectedReturn ||
      assumptions.inflationRate !== currentAssumptions.inflationRate ||
      assumptions.retirementAge !== currentAssumptions.retirementAge;

    if (!hasChanges) {
      setProjection(initialProjection);
      setValidationError(null);
      setInputWarnings([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      setValidationError(null);

      try {
        const response = await fetch('/api/projections/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId,
            expectedReturn: assumptions.expectedReturn,
            inflationRate: assumptions.inflationRate,
            retirementAge: assumptions.retirementAge,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 400) {
            // Validation error - show specific message
            setValidationError(errorData.message);
            return;
          }
          throw new Error(errorData.message || 'Failed to calculate projection');
        }

        const data = await response.json();
        setProjection(data.projection);
        setValidationError(null);

        // Extract warnings from response
        if (data.meta?.inputWarnings) {
          setInputWarnings(data.meta.inputWarnings);
        } else {
          setInputWarnings([]);
        }
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
  }, [assumptions, currentAssumptions, initialProjection, planId]);

  const handleReset = useCallback(() => {
    setAssumptions(defaultAssumptions);
  }, [defaultAssumptions]);

  const handleScenarioApply = useCallback(
    (newAssumptions: Assumptions) => {
      // 1. Save base state before applying scenario
      if (!isScenarioActive) {
        setBaseProjection(projection);
        setBaseAssumptions(assumptions);
      }

      // 2. Apply the new assumptions (triggers recalculation via useEffect)
      setAssumptions(newAssumptions);
      setIsScenarioActive(true);

      // Note: Explanation will be fetched after projection recalculates
    },
    [isScenarioActive, projection, assumptions]
  );

  const handleScenarioReset = useCallback(() => {
    if (baseAssumptions) {
      setAssumptions(baseAssumptions);
    }
    setIsScenarioActive(false);
    setBaseProjection(null);
    setBaseAssumptions(null);
    setScenarioExplanation(null);
  }, [baseAssumptions]);

  // Refetch projection (used after spending config changes)
  const refetchProjection = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/projections/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          expectedReturn: assumptions.expectedReturn,
          inflationRate: assumptions.inflationRate,
          retirementAge: assumptions.retirementAge,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProjection(data.projection);
      }
    } catch (error) {
      console.error('Failed to refetch projection:', error);
    } finally {
      setIsLoading(false);
    }
  }, [planId, assumptions]);

  // Handle saving spending config changes
  const handleSaveSpendingConfig = useCallback(async (config: SpendingPhaseConfig) => {
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spendingPhases: config }),
      });

      if (!response.ok) {
        throw new Error('Failed to save spending config');
      }

      setSpendingConfig(config);
      // Trigger projection recalculation
      await refetchProjection();
    } catch (error) {
      console.error('Failed to save spending config:', error);
      throw error;
    }
  }, [refetchProjection]);

  // Fetch scenario explanation when scenario projection is ready
  useEffect(() => {
    if (!isScenarioActive || !baseProjection || !baseAssumptions || isLoading) {
      return;
    }

    const fetchExplanation = async () => {
      setIsExplanationLoading(true);

      try {
        // Build changed fields array
        const changedFields: Array<{ field: string; previous: unknown; current: unknown }> = [];

        if (baseAssumptions.expectedReturn !== assumptions.expectedReturn) {
          changedFields.push({
            field: 'Expected Return',
            previous: `${(baseAssumptions.expectedReturn * 100).toFixed(1)}%`,
            current: `${(assumptions.expectedReturn * 100).toFixed(1)}%`,
          });
        }
        if (baseAssumptions.inflationRate !== assumptions.inflationRate) {
          changedFields.push({
            field: 'Inflation Rate',
            previous: `${(baseAssumptions.inflationRate * 100).toFixed(1)}%`,
            current: `${(assumptions.inflationRate * 100).toFixed(1)}%`,
          });
        }
        if (baseAssumptions.retirementAge !== assumptions.retirementAge) {
          changedFields.push({
            field: 'Retirement Age',
            previous: baseAssumptions.retirementAge,
            current: assumptions.retirementAge,
          });
        }

        const response = await fetch('/api/scenarios/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseProjection: {
              retirementBalance: baseProjection.summary.projectedRetirementBalance,
              yearsUntilDepletion: baseProjection.summary.yearsUntilDepletion,
              retirementAge: baseAssumptions.retirementAge,
            },
            scenarioProjection: {
              retirementBalance: projection.summary.projectedRetirementBalance,
              yearsUntilDepletion: projection.summary.yearsUntilDepletion,
              retirementAge: assumptions.retirementAge,
            },
            changedFields,
          }),
        });

        const result = await response.json();

        if (result.success && result.data) {
          setScenarioExplanation(result.data);
        } else {
          console.error('Failed to fetch scenario explanation:', result.error);
        }
      } catch (error) {
        console.error('Error fetching scenario explanation:', error);
      } finally {
        setIsExplanationLoading(false);
      }
    };

    fetchExplanation();
  }, [isScenarioActive, baseProjection, baseAssumptions, projection, assumptions, isLoading]);

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

      {/* Validation Error Alert */}
      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cannot Generate Projection</AlertTitle>
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {/* General Error Alert */}
      {error && !validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Calculation Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Input Warnings */}
      {inputWarnings.length > 0 && !validationError && (
        <div className="space-y-2">
          {inputWarnings.map((warning, index) => (
            <Alert key={index}>
              {warning.severity === 'warning' ? (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              ) : (
                <Info className="h-4 w-4 text-blue-600" />
              )}
              <AlertDescription>{warning.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Scenario Input Section */}
      <ScenarioInput
        currentAssumptions={assumptions}
        onApply={handleScenarioApply}
        disabled={isLoading}
      />

      {/* Scenario Explanation */}
      {isScenarioActive && (scenarioExplanation || isExplanationLoading) && (
        <div className="rounded-lg border shadow-sm">
          {isExplanationLoading ? (
            <div className="p-4 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Analyzing scenario impact...</span>
            </div>
          ) : scenarioExplanation ? (
            <ScenarioExplanation
              explanation={scenarioExplanation}
              onReset={handleScenarioReset}
            />
          ) : null}
        </div>
      )}

      {/* Mobile Assumptions Panel - Collapsible */}
      <div className="lg:hidden">
        <div
          className="flex items-center justify-between p-4 border rounded-lg cursor-pointer"
          onClick={() => setMobileAssumptionsOpen(!mobileAssumptionsOpen)}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">Adjust Assumptions</span>
            {(assumptions.expectedReturn !== defaultAssumptions.expectedReturn ||
              assumptions.inflationRate !== defaultAssumptions.inflationRate ||
              assumptions.retirementAge !== defaultAssumptions.retirementAge) && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Modified
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              'h-5 w-5 transition-transform',
              mobileAssumptionsOpen && 'rotate-180'
            )}
          />
        </div>
        {mobileAssumptionsOpen && (
          <div className="mt-2">
            <AssumptionsPanel
              assumptions={assumptions}
              defaultAssumptions={defaultAssumptions}
              currentAge={currentAge}
              onChange={setAssumptions}
              onReset={handleReset}
              disabled={isLoading}
            />
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Left Column: Chart & Metrics */}
        <div className="space-y-6">
          {/* Export Panel */}
          <div className="flex justify-end">
            <ExportPanel
              data={{
                records: projection.records,
                summary: projection.summary,
                assumptions,
                defaultAssumptions,
                currentAge,
                monthlySpending,
              }}
            />
          </div>

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

          {/* Tab Navigation */}
          <div className="border-b">
            <nav className="flex gap-4" aria-label="Projection views">
              <button
                onClick={() => setActiveTab('assets')}
                className={`py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'assets'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Assets Over Time
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'compare'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Compare Spending
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'assets' ? (
            <>
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
                  spendingEnabled={spendingConfig?.enabled ?? false}
                  onPhaseClick={setEditingPhaseId}
                />
              </div>

              {/* Insights Section */}
              <InsightsSection isScenarioActive={isScenarioActive} />

              {/* Table */}
              <ProjectionTable
                records={projection.records}
                retirementAge={assumptions.retirementAge}
              />
            </>
          ) : (
            <SpendingCompareTab
              retirementAge={assumptions.retirementAge}
              inflationRate={assumptions.inflationRate}
              expectedReturn={assumptions.expectedReturn}
            />
          )}
        </div>

        {/* Right Column: Assumptions Panel (Desktop only) */}
        <div className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
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

      {/* Spending Phase Edit Modal */}
      <SpendingPhaseEditModal
        open={editingPhaseId !== null}
        onOpenChange={(open) => !open && setEditingPhaseId(null)}
        phaseId={editingPhaseId}
        config={spendingConfig}
        onSave={handleSaveSpendingConfig}
      />
    </div>
  );
}
