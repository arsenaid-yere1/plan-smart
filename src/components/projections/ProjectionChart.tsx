'use client';

import { useMemo, useState } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import type { ProjectionRecord } from '@/lib/projections/types';

type XAxisType = 'age' | 'year';
type ViewMode = 'balance' | 'spending';

// Phase colors matching existing design system
const PHASE_COLORS: Record<string, string> = {
  'Go-Go Years': 'hsl(var(--success))',
  'Slow-Go': 'hsl(var(--warning))',
  'No-Go': 'hsl(var(--muted-foreground))',
  default: 'hsl(var(--primary))',
};

interface ProjectionChartProps {
  records: ProjectionRecord[];
  retirementAge: number;
  currentAge: number;
  inflationRate?: number;
  shortfallAge?: number;
  // New props for spending view
  spendingEnabled?: boolean; // Whether user has spending phases configured
  onPhaseClick?: (phaseId: string) => void; // Handler for click-to-edit
  // Epic 10.2: Reserve floor for dual-area visualization
  reserveFloor?: number;
  // Epic 10.3: Depletion target visualization
  depletionTargetAge?: number;
  showTargetTrajectory?: boolean;
}

function formatCurrency(value: number): string {
  if (value == null || Number.isNaN(value)) {
    return '$0';
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatTooltipCurrency(value: number): string {
  if (value == null || Number.isNaN(value)) {
    return '$0';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

// Label colors - using actual HSL values since SVG doesn't resolve CSS vars in all contexts
const LABEL_COLORS = {
  muted: '#737373', // neutral-500 approximation
  destructive: '#ef4444', // red-500
  primary: '#3b82f6', // blue-500
} as const;

export function ProjectionChart({
  records,
  retirementAge,
  currentAge,
  inflationRate = 0.025,
  shortfallAge,
  spendingEnabled = false,
  onPhaseClick,
  reserveFloor,
  depletionTargetAge,
  showTargetTrajectory = true,
}: ProjectionChartProps) {
  // DEBUG - REMOVE AFTER FIXING
  console.log('[ProjectionChart] Props:', {
    recordsLength: records?.length,
    firstRecord: records?.[0],
    reserveFloor,
    depletionTargetAge,
    currentAge,
    retirementAge,
  });

  const [xAxisType, setXAxisType] = useState<XAxisType>('age');
  const [adjustForInflation, setAdjustForInflation] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('balance');

  const chartData = useMemo(() => {
    type ChartDataPoint = ProjectionRecord & {
      xValue: number;
      isRetirement: boolean;
      accumulationBalance: number | null;
      retirementBalance: number | null;
      positiveBalance: number | null;
      negativeBalance: number | null;
      displayBalance: number;
      nominalBalance: number;
      realBalance: number;
    };

    const data: ChartDataPoint[] = [];

    // Ensure inflationRate is valid for calculations
    const safeInflationRate = inflationRate ?? 0.025;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const isRetirement = record.age >= retirementAge;
      const prevRecord = i > 0 ? records[i - 1] : null;

      // Calculate inflation adjustment factor
      const yearsFromNow = record.age - currentAge;
      const inflationFactor = Math.pow(1 + safeInflationRate, yearsFromNow);
      const realBalance = record.balance / inflationFactor;
      const displayBalance = adjustForInflation ? realBalance : record.balance;

      // Check if we're crossing from positive to negative (using display values)
      if (prevRecord && prevRecord.balance > 0 && record.balance < 0) {
        // Insert an interpolated zero-crossing point
        const ratio = prevRecord.balance / (prevRecord.balance - record.balance);
        const zeroAge = prevRecord.age + ratio * (record.age - prevRecord.age);
        const zeroYear = prevRecord.year + ratio * (record.year - prevRecord.year);

        data.push({
          ...record,
          age: Math.round(zeroAge * 10) / 10,
          year: Math.round(zeroYear),
          balance: 0,
          xValue: xAxisType === 'age' ? Math.round(zeroAge * 10) / 10 : Math.round(zeroYear),
          isRetirement: zeroAge >= retirementAge,
          accumulationBalance: zeroAge < retirementAge ? 0 : null,
          retirementBalance: zeroAge >= retirementAge ? 0 : null,
          positiveBalance: 0,
          negativeBalance: 0,
          displayBalance: 0,
          nominalBalance: 0,
          realBalance: 0,
        });
      }

      data.push({
        ...record,
        xValue: xAxisType === 'age' ? record.age : record.year,
        isRetirement,
        accumulationBalance: record.age < retirementAge ? displayBalance : null,
        retirementBalance: isRetirement ? displayBalance : null,
        // Include boundary point in accumulation for smooth transition
        ...(record.age === retirementAge && {
          accumulationBalance: displayBalance,
        }),
        positiveBalance: displayBalance >= 0 ? displayBalance : null,
        negativeBalance: displayBalance <= 0 ? displayBalance : null,
        displayBalance,
        nominalBalance: record.balance,
        realBalance,
      });
    }

    return data;
  }, [records, xAxisType, retirementAge, currentAge, inflationRate, adjustForInflation]);

  // Epic 10.2: Reserve chart data transformation
  const chartDataWithReserve = useMemo(() => {
    // DEBUG - REMOVE AFTER FIXING
    console.log('[ProjectionChart] chartDataWithReserve check:', {
      reserveFloor,
      viewMode,
      chartDataLength: chartData.length,
      firstChartData: chartData[0],
    });

    if (!reserveFloor || viewMode !== 'balance') return null;

    // Ensure inflationRate is valid for calculations
    const safeInflationRate = inflationRate ?? 0.025;

    return chartData.map((record) => {
      // Calculate inflation-adjusted reserve floor for display consistency
      const yearsFromNow = (record.age ?? currentAge) - currentAge;
      const inflationFactor = Math.pow(1 + safeInflationRate, yearsFromNow);
      const displayReserveFloor = adjustForInflation ? reserveFloor / inflationFactor : reserveFloor;
      const displayBalance = record.displayBalance ?? 0;

      // Guard against NaN values
      const safeReserveFloor = Number.isFinite(displayReserveFloor) ? displayReserveFloor : 0;
      const safeBalance = Number.isFinite(displayBalance) ? displayBalance : 0;

      return {
        ...record,
        // Reserve portion is the minimum of balance and reserve floor
        reservePortion: Math.max(0, Math.min(safeBalance, safeReserveFloor)),
        // Available portion is what's above the reserve floor
        balanceAboveReserve: Math.max(0, safeBalance - safeReserveFloor),
        // Display reserve floor for reference line
        displayReserveFloor: safeReserveFloor,
      };
    });
  }, [chartData, reserveFloor, viewMode, currentAge, inflationRate, adjustForInflation]);

  // Spending data transformation for spending view
  const spendingData = useMemo(() => {
    if (viewMode !== 'spending') return [];

    // Ensure inflationRate is valid for calculations
    const safeInflationRate = inflationRate ?? 0.025;

    return records
      .filter((record) => record.age >= retirementAge)
      .map((record) => {
        const yearsFromRetirement = record.age - retirementAge;
        const inflationFactor = Math.pow(1 + safeInflationRate, yearsFromRetirement);

        // Total spending = outflows (includes healthcare)
        const nominalSpending = record.outflows ?? 0;
        const realSpending = nominalSpending / inflationFactor;
        const displaySpending = adjustForInflation ? realSpending : nominalSpending;

        return {
          xValue: xAxisType === 'age' ? record.age : record.year,
          age: record.age,
          year: record.year,
          spending: displaySpending,
          nominalSpending,
          realSpending,
          phase: record.activePhaseName,
          phaseId: record.activePhaseId,
          essentialExpenses: record.essentialExpenses,
          discretionaryExpenses: record.discretionaryExpenses,
        };
      });
  }, [records, retirementAge, inflationRate, adjustForInflation, xAxisType, viewMode]);

  // Phase boundary calculation
  const phaseBoundaries = useMemo(() => {
    if (viewMode !== 'spending') return [];

    const boundaries: { xValue: number; phase: string; phaseId?: string }[] = [];
    let currentPhase: string | null = null;

    for (const point of spendingData) {
      if (point.phase !== currentPhase && point.phase) {
        boundaries.push({
          xValue: point.xValue,
          phase: point.phase,
          phaseId: point.phaseId,
        });
        currentPhase = point.phase;
      }
    }

    return boundaries;
  }, [spendingData, viewMode]);

  const retirementXValue = useMemo(() => {
    if (xAxisType === 'age') {
      return retirementAge;
    }
    // Calculate retirement year from current age
    const currentYear = new Date().getFullYear();
    return currentYear + (retirementAge - currentAge);
  }, [xAxisType, retirementAge, currentAge]);

  const shortfallXValue = useMemo(() => {
    if (!shortfallAge) return null;
    if (xAxisType === 'age') {
      return shortfallAge;
    }
    // Calculate shortfall year from current age
    const currentYear = new Date().getFullYear();
    return currentYear + (shortfallAge - currentAge);
  }, [xAxisType, shortfallAge, currentAge]);

  // Epic 10.3: Depletion target X value
  const depletionTargetXValue = useMemo(() => {
    if (depletionTargetAge == null) return null;
    if (xAxisType === 'age') {
      return depletionTargetAge;
    }
    const currentYear = new Date().getFullYear();
    return currentYear + (depletionTargetAge - currentAge);
  }, [xAxisType, depletionTargetAge, currentAge]);

  // Epic 10.3: Target trajectory calculation
  const targetTrajectoryData = useMemo(() => {
    if (depletionTargetAge == null || !showTargetTrajectory || !reserveFloor || viewMode !== 'balance') {
      return null;
    }

    const yearsToTarget = depletionTargetAge - currentAge;
    // Avoid division by zero or NaN - need at least 1 year difference
    if (Number.isNaN(yearsToTarget) || yearsToTarget <= 0) {
      return null;
    }

    // Ensure inflationRate is valid for calculations
    const safeInflationRate = inflationRate ?? 0.025;

    const startBalance = chartData[0]?.displayBalance;
    // Don't show trajectory if we don't have valid balance data
    if (startBalance == null || startBalance <= 0) {
      return null;
    }

    const endBalance = adjustForInflation
      ? reserveFloor / Math.pow(1 + safeInflationRate, yearsToTarget)
      : reserveFloor;

    // Generate trajectory points only for ages we have data
    return chartData
      .filter(r => r.age >= currentAge && r.age <= depletionTargetAge)
      .map(r => {
        const progress = (r.age - currentAge) / yearsToTarget;
        // Linear interpolation for simple visualization
        const targetBalance = startBalance - (startBalance - endBalance) * progress;

        return {
          xValue: r.xValue,
          targetBalance,
        };
      });
  }, [chartData, depletionTargetAge, reserveFloor, showTargetTrajectory, currentAge, adjustForInflation, inflationRate, viewMode]);

  const minBalance = records.length > 0
    ? Math.min(...records.map((r) => r.balance ?? 0))
    : 0;
  const hasNegativeBalance = Number.isFinite(minBalance) && minBalance < 0;

  // Calculate Y-axis domain based on current view and data
  // This fixes issues where stacked areas don't auto-scale correctly
  const yAxisDomain = useMemo((): [number | 'auto', number | 'auto'] => {
    if (viewMode === 'spending') {
      if (spendingData.length === 0) return [0, 'auto'];
      const maxSpending = Math.max(...spendingData.map(d => d.spending ?? 0));
      // Guard against -Infinity or NaN
      if (!Number.isFinite(maxSpending) || maxSpending <= 0) {
        return [0, 'auto'];
      }
      return [0, maxSpending * 1.1];
    }

    // For balance view with reserve (stacked areas)
    if (chartDataWithReserve && chartDataWithReserve.length > 0) {
      const balances = chartDataWithReserve.map(d =>
        (d.reservePortion ?? 0) + (d.balanceAboveReserve ?? 0)
      );
      const maxBalance = Math.max(...balances);

      // DEBUG - REMOVE AFTER FIXING
      console.log('[ProjectionChart] yAxisDomain debug:', {
        chartDataLength: chartDataWithReserve.length,
        firstRecord: chartDataWithReserve[0],
        maxBalance,
        balancesSample: balances.slice(0, 3),
        reserveFloor,
      });

      // Guard against -Infinity (empty array) or NaN
      if (!Number.isFinite(maxBalance) || maxBalance <= 0) {
        console.log('[ProjectionChart] yAxisDomain returning auto due to invalid maxBalance');
        return [0, 'auto'];
      }
      const minVal = hasNegativeBalance ? minBalance : 0;
      const result: [number, number] = [minVal, maxBalance * 1.05];
      console.log('[ProjectionChart] yAxisDomain result:', result);
      return result;
    }

    // For balance view without reserve, let Recharts auto-calculate
    console.log('[ProjectionChart] yAxisDomain returning auto (no reserve data)');
    return ['auto', 'auto'];
  }, [viewMode, spendingData, chartDataWithReserve, hasNegativeBalance, minBalance]);

  return (
    <div className="w-full">
      {/* Toggle Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {/* X-Axis Toggle */}
        <div className="flex items-center gap-2">
          <span id="x-axis-label" className="text-sm text-muted-foreground">
            View by:
          </span>
          <div
            className="inline-flex rounded-lg border border-border p-1"
            role="group"
            aria-labelledby="x-axis-label"
          >
            <button
              type="button"
              onClick={() => setXAxisType('age')}
              aria-pressed={xAxisType === 'age'}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                xAxisType === 'age'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Age
            </button>
            <button
              type="button"
              onClick={() => setXAxisType('year')}
              aria-pressed={xAxisType === 'year'}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                xAxisType === 'year'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Year
            </button>
          </div>
        </div>

        {/* Inflation Adjustment Toggle */}
        <div className="flex items-center gap-2">
          <span id="inflation-label" className="text-sm text-muted-foreground">
            Values in:
          </span>
          <div
            className="inline-flex rounded-lg border border-border p-1"
            role="group"
            aria-labelledby="inflation-label"
          >
            <button
              type="button"
              onClick={() => setAdjustForInflation(false)}
              aria-pressed={!adjustForInflation}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                !adjustForInflation
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Future $
            </button>
            <button
              type="button"
              onClick={() => setAdjustForInflation(true)}
              aria-pressed={adjustForInflation}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                adjustForInflation
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Today&apos;s $
            </button>
          </div>
        </div>

        {/* View Mode Toggle - only show if spending phases enabled */}
        {spendingEnabled && (
          <div className="flex items-center gap-2">
            <span id="view-mode-label" className="text-sm text-muted-foreground">
              Chart:
            </span>
            <div
              className="inline-flex rounded-lg border border-border p-1"
              role="group"
              aria-labelledby="view-mode-label"
            >
              <button
                type="button"
                onClick={() => setViewMode('balance')}
                aria-pressed={viewMode === 'balance'}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  viewMode === 'balance'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Balance
              </button>
              <button
                type="button"
                onClick={() => setViewMode('spending')}
                aria-pressed={viewMode === 'spending'}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  viewMode === 'spending'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Spending
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chart Container */}
      <div className="h-64 w-full sm:h-80 lg:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={viewMode === 'spending' ? spendingData : (chartDataWithReserve ?? chartData)}
            margin={{ top: 20, right: 60, left: 0, bottom: 0 }}
            onClick={(e) => {
              if (viewMode === 'spending' && onPhaseClick) {
                const event = e as unknown as { activePayload?: Array<{ payload?: { phaseId?: string } }> };
                const phaseId = event?.activePayload?.[0]?.payload?.phaseId;
                if (phaseId) {
                  onPhaseClick(phaseId);
                }
              }
            }}
            style={{ cursor: viewMode === 'spending' && onPhaseClick ? 'pointer' : 'default' }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="xValue"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              domain={yAxisDomain}
              tickFormatter={formatCurrency}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              width={60}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;

                // Handle spending view tooltip
                if (viewMode === 'spending') {
                  const data = payload[0].payload as (typeof spendingData)[0];
                  const phaseColor = PHASE_COLORS[data.phase ?? 'default'] ?? PHASE_COLORS.default;

                  return (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-md">
                      <p className="text-sm font-medium text-foreground">
                        {xAxisType === 'age' ? `Age ${data.age}` : `Year ${data.year}`}
                      </p>
                      <p className="text-sm font-medium" style={{ color: phaseColor }}>
                        {adjustForInflation ? "Today's $: " : 'Future $: '}
                        {formatTooltipCurrency(data.spending)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {adjustForInflation
                          ? `(${formatTooltipCurrency(data.nominalSpending)} in future dollars)`
                          : `(${formatTooltipCurrency(data.realSpending)} in today's dollars)`}
                      </p>
                      {data.essentialExpenses !== undefined && (
                        <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                          <p>Essential: {formatTooltipCurrency(data.essentialExpenses ?? 0)}</p>
                          <p>Discretionary: {formatTooltipCurrency(data.discretionaryExpenses ?? 0)}</p>
                        </div>
                      )}
                      <p className="mt-1 text-xs" style={{ color: phaseColor }}>
                        {data.phase ?? 'Retirement Phase'}
                      </p>
                    </div>
                  );
                }

                // Handle balance view tooltip
                const data = payload[0].payload as ProjectionRecord & {
                  xValue: number;
                  isRetirement: boolean;
                  displayBalance: number;
                  nominalBalance: number;
                  realBalance: number;
                  reservePortion?: number;
                  balanceAboveReserve?: number;
                  displayReserveFloor?: number;
                };
                const isNegative = data.displayBalance < 0;
                const hasReserve = reserveFloor !== undefined && data.displayReserveFloor !== undefined;
                return (
                  <div className="rounded-lg border border-border bg-card p-3 shadow-md">
                    <p className="text-sm font-medium text-foreground">
                      {xAxisType === 'age' ? `Age ${data.age}` : `Year ${data.year}`}
                    </p>
                    <p
                      className={`text-sm font-medium ${isNegative ? 'text-destructive' : 'text-foreground'}`}
                    >
                      {adjustForInflation ? "Today's $: " : 'Future $: '}
                      {formatTooltipCurrency(data.displayBalance)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {adjustForInflation
                        ? `(${formatTooltipCurrency(data.nominalBalance)} in future dollars)`
                        : `(${formatTooltipCurrency(data.realBalance)} in today's dollars)`}
                    </p>
                    {/* Epic 10.2: Reserve breakdown */}
                    {hasReserve && data.displayBalance > 0 && (
                      <>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          Available: {formatTooltipCurrency(data.balanceAboveReserve ?? 0)}
                        </p>
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                          Reserve: {formatTooltipCurrency(data.reservePortion ?? 0)}
                        </p>
                        {data.reserveConstrained && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Spending reduced to protect reserve
                          </p>
                        )}
                      </>
                    )}
                    {isNegative && (
                      <p className="text-xs font-medium text-destructive">
                        ⚠ Funds depleted
                      </p>
                    )}
                    {data.inflows > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Income: {formatTooltipCurrency(data.inflows)}
                      </p>
                    )}
                    {data.outflows > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Expenses: {formatTooltipCurrency(data.outflows)}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.activePhaseName || (data.isRetirement ? 'Retirement Phase' : 'Accumulation Phase')}
                    </p>
                  </div>
                );
              }}
            />
            {/* Spending view elements */}
            {viewMode === 'spending' && (
              <>
                {/* Phase boundary reference lines (skip first phase - it starts at retirement) */}
                {phaseBoundaries.slice(1).map((boundary) => (
                  <ReferenceLine
                    key={`phase-${boundary.xValue}`}
                    x={boundary.xValue}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="5 5"
                    label={{
                      value: boundary.phase,
                      position: 'top',
                      fill: LABEL_COLORS.muted,
                      fontSize: 10,
                    }}
                  />
                ))}

                {/* Spending area fill */}
                <Area
                  type="monotone"
                  dataKey="spending"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: 'hsl(var(--primary))',
                    stroke: 'hsl(var(--background))',
                    strokeWidth: 2,
                    cursor: onPhaseClick ? 'pointer' : 'default',
                  }}
                />
              </>
            )}

            {/* Balance view elements */}
            {viewMode === 'balance' && (
              <>
                {/* Zero baseline for negative balances */}
                {hasNegativeBalance && (
                  <ReferenceLine
                    y={0}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="3 3"
                  />
                )}
                {/* Retirement age marker */}
                <ReferenceLine
                  x={retirementXValue}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  label={{
                    value: 'Retirement',
                    position: 'top',
                    fill: LABEL_COLORS.muted,
                    fontSize: 12,
                  }}
                />
                {/* Shortfall marker */}
                {shortfallXValue !== null && (
                  <ReferenceLine
                    x={shortfallXValue}
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="5 5"
                    label={{
                      value: 'Shortfall',
                      position: 'top',
                      fill: LABEL_COLORS.destructive,
                      fontSize: 12,
                    }}
                  />
                )}
                {/* Epic 10.3: Depletion Target Age Marker */}
                {depletionTargetAge != null && depletionTargetXValue !== null && (
                  <ReferenceLine
                    x={depletionTargetXValue}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="5 5"
                    label={{
                      value: `Target Age ${depletionTargetAge}`,
                      position: 'top',
                      fill: LABEL_COLORS.primary,
                      fontSize: 12,
                    }}
                  />
                )}
                {/* Epic 10.3: Target Trajectory Line */}
                {targetTrajectoryData && (
                  <Line
                    type="monotone"
                    data={targetTrajectoryData}
                    dataKey="targetBalance"
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="8 4"
                    strokeWidth={1}
                    dot={false}
                    name="Target Trajectory"
                  />
                )}
                {/* Epic 10.2: Reserve visualization */}
                {chartDataWithReserve && (
                  <>
                    {/* Reserve zone (bottom) - protected funds */}
                    <Area
                      type="monotone"
                      dataKey="reservePortion"
                      stackId="reserve"
                      fill="hsl(var(--warning) / 0.2)"
                      stroke="hsl(var(--warning))"
                      strokeWidth={1}
                      name="Reserve"
                    />
                    {/* Available zone (top) - spendable funds */}
                    <Area
                      type="monotone"
                      dataKey="balanceAboveReserve"
                      stackId="reserve"
                      fill="hsl(var(--success) / 0.2)"
                      stroke="hsl(var(--success))"
                      strokeWidth={2}
                      name="Available"
                    />
                  </>
                )}
                {/* Accumulation phase area (light primary fill) - only when no reserve */}
                {!chartDataWithReserve && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="accumulationBalance"
                      stroke="none"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.1}
                      connectNulls={false}
                    />
                    {/* Retirement phase area (light success fill) */}
                    <Area
                      type="monotone"
                      dataKey="retirementBalance"
                      stroke="none"
                      fill="hsl(var(--success))"
                      fillOpacity={0.1}
                      connectNulls={false}
                    />
                    {/* Positive balance line */}
                    <Line
                      type="monotone"
                      dataKey="positiveBalance"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      activeDot={{
                        r: 6,
                        fill: 'hsl(var(--primary))',
                        stroke: 'hsl(var(--background))',
                        strokeWidth: 2,
                      }}
                    />
                  </>
                )}
                {/* Negative balance line (red) */}
                <Line
                  type="monotone"
                  dataKey="negativeBalance"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  activeDot={{
                    r: 6,
                    fill: 'hsl(var(--destructive))',
                    stroke: 'hsl(var(--background))',
                    strokeWidth: 2,
                  }}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
        {viewMode === 'spending' ? (
          <>
            <div className="flex items-center gap-2">
              <div className="h-3 w-4 rounded-sm bg-primary/20" />
              <span>Annual Spending</span>
            </div>
            {phaseBoundaries.map((boundary) => (
              <div key={boundary.phase} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-sm"
                  style={{
                    backgroundColor: PHASE_COLORS[boundary.phase] ?? PHASE_COLORS.default,
                    opacity: 0.5,
                  }}
                />
                <span>{boundary.phase}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <div className="h-4 w-0.5 border-l-2 border-dashed border-muted-foreground" />
              <span>Phase Boundary</span>
            </div>
          </>
        ) : chartDataWithReserve ? (
          // Epic 10.2: Reserve-enabled legend
          <>
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: 'hsl(var(--success))' }}
              />
              <span>Available for Spending</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: 'hsl(var(--warning))' }}
              />
              <span>Reserve</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-0.5 border-l-2 border-dashed border-muted-foreground" />
              <span>Retirement Start</span>
            </div>
            {/* Epic 10.3: Depletion target legend items */}
            {depletionTargetAge != null && showTargetTrajectory && targetTrajectoryData && (
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 border-b-2 border-dashed border-muted-foreground" />
                <span>Target Trajectory</span>
              </div>
            )}
            {depletionTargetAge != null && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-0.5 border-l-2 border-dashed border-primary" />
                <span>Target Age</span>
              </div>
            )}
            {hasNegativeBalance && (
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 bg-destructive" />
                <span>Depleted</span>
              </div>
            )}
            {shortfallAge && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-0.5 border-l-2 border-dashed border-destructive" />
                <span>Funds Depleted</span>
              </div>
            )}
          </>
        ) : (
          // Default legend without reserve
          <>
            <div className="flex items-center gap-2">
              <div className="h-3 w-4 rounded-sm bg-primary/20" />
              <span>Accumulation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-4 rounded-sm bg-success/20" />
              <span>Retirement</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-4 bg-primary" />
              <span>Total Balance</span>
            </div>
            {hasNegativeBalance && (
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 bg-destructive" />
                <span>Depleted</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="h-4 w-0.5 border-l-2 border-dashed border-muted-foreground" />
              <span>Retirement Start</span>
            </div>
            {shortfallAge && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-0.5 border-l-2 border-dashed border-destructive" />
                <span>Funds Depleted</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
