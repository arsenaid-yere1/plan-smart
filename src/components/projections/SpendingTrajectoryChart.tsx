'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
} from 'recharts';

interface SpendingDataPoint {
  age: number;
  amount: number;
  phase: string | null;
}

interface SpendingTrajectoryChartProps {
  /** Yearly spending data with phase info */
  data: SpendingDataPoint[];
  /** Optional flat spending overlay for comparison */
  flatData?: { age: number; amount: number }[];
  /** Whether to show in inflation-adjusted (real) dollars */
  showRealDollars?: boolean;
  /** Inflation rate for real dollar conversion */
  inflationRate?: number;
  /** Retirement age (starting point) */
  retirementAge: number;
}

// Phase colors matching existing design system
const PHASE_COLORS: Record<string, string> = {
  'Go-Go Years': 'hsl(var(--success))',
  'Slow-Go': 'hsl(var(--warning))',
  'No-Go': 'hsl(var(--muted-foreground))',
  default: 'hsl(var(--primary))',
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatTooltipCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function SpendingTrajectoryChart({
  data,
  flatData,
  showRealDollars = true,
  inflationRate = 0.025,
  retirementAge,
}: SpendingTrajectoryChartProps) {
  const [showFlat, setShowFlat] = useState(!!flatData);

  // Transform data for chart with optional inflation adjustment
  const chartData = useMemo(() => {
    return data.map((point) => {
      const yearsFromRetirement = point.age - retirementAge;
      const inflationFactor = Math.pow(1 + inflationRate, yearsFromRetirement);

      const displayAmount = showRealDollars
        ? point.amount / inflationFactor
        : point.amount;

      // Find corresponding flat spending if available
      let flatAmount: number | null = null;
      if (flatData && showFlat) {
        const flatPoint = flatData.find((f) => f.age === point.age);
        if (flatPoint) {
          flatAmount = showRealDollars
            ? flatPoint.amount / inflationFactor
            : flatPoint.amount;
        }
      }

      return {
        age: point.age,
        spending: Math.round(displayAmount * 100) / 100,
        flatSpending: flatAmount ? Math.round(flatAmount * 100) / 100 : null,
        phase: point.phase,
        originalAmount: point.amount,
      };
    });
  }, [data, flatData, showRealDollars, showFlat, inflationRate, retirementAge]);

  // Find phase boundaries for reference lines
  const phaseBoundaries = useMemo(() => {
    const boundaries: { age: number; phase: string }[] = [];
    let currentPhase: string | null = null;

    for (const point of data) {
      if (point.phase !== currentPhase && point.phase) {
        boundaries.push({ age: point.age, phase: point.phase });
        currentPhase = point.phase;
      }
    }

    return boundaries;
  }, [data]);

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: (typeof chartData)[0] }>;
  }) => {
    if (!active || !payload?.length) return null;

    const point = payload[0].payload;
    const phaseColor = PHASE_COLORS[point.phase ?? 'default'] ?? PHASE_COLORS.default;

    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="font-medium">Age {point.age}</p>
        <div className="mt-1 space-y-1 text-sm">
          <p style={{ color: phaseColor }}>
            {point.phase ?? 'Flat'}: {formatTooltipCurrency(point.spending)}
            {showRealDollars && (
              <span className="text-muted-foreground ml-1">
                (today&apos;s dollars)
              </span>
            )}
          </p>
          {point.flatSpending !== null && (
            <p className="text-muted-foreground">
              Flat: {formatTooltipCurrency(point.flatSpending)}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setShowFlat(!showFlat)}
            disabled={!flatData}
            className={`px-3 py-1 text-sm rounded-md border ${
              showFlat
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-foreground'
            } ${!flatData ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {showFlat ? 'Hide' : 'Show'} Flat Comparison
          </button>
        </div>
        <div className="text-sm text-muted-foreground">
          {showRealDollars ? "Today's dollars" : 'Future dollars'}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="age"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              stroke="hsl(var(--border))"
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Phase boundary reference lines */}
            {phaseBoundaries.slice(1).map((boundary) => (
              <ReferenceLine
                key={boundary.age}
                x={boundary.age}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                label={{
                  value: boundary.phase,
                  position: 'top',
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 10,
                }}
              />
            ))}

            {/* Flat spending comparison line */}
            {showFlat && flatData && (
              <Area
                type="monotone"
                dataKey="flatSpending"
                stroke="hsl(var(--muted-foreground))"
                fill="none"
                strokeDasharray="5 5"
                strokeWidth={1}
                connectNulls={false}
              />
            )}

            {/* Phased spending area */}
            <Area
              type="monotone"
              dataKey="spending"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.1}
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary))' }} />
          <span>Phased Spending</span>
        </div>
        {showFlat && flatData && (
          <div className="flex items-center gap-2">
            <div
              className="h-0 w-4 border-t-2 border-dashed"
              style={{ borderColor: 'hsl(var(--muted-foreground))' }}
            />
            <span>Flat Spending</span>
          </div>
        )}
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
      </div>
    </div>
  );
}
