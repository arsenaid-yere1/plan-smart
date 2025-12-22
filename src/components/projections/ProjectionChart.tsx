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

interface ProjectionChartProps {
  records: ProjectionRecord[];
  retirementAge: number;
  currentAge: number;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatTooltipCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProjectionChart({
  records,
  retirementAge,
  currentAge,
}: ProjectionChartProps) {
  const [xAxisType, setXAxisType] = useState<XAxisType>('age');

  const chartData = useMemo(() => {
    return records.map((record) => {
      const isRetirement = record.age >= retirementAge;
      return {
        ...record,
        xValue: xAxisType === 'age' ? record.age : record.year,
        isRetirement,
        // Split balance by phase for area fills
        accumulationBalance: record.age < retirementAge ? record.balance : null,
        retirementBalance: isRetirement ? record.balance : null,
        // Include boundary point in accumulation for smooth transition
        ...(record.age === retirementAge && {
          accumulationBalance: record.balance,
        }),
        // Split balance for positive/negative line coloring
        positiveBalance: record.balance >= 0 ? record.balance : null,
        negativeBalance: record.balance < 0 ? record.balance : null,
      };
    });
  }, [records, xAxisType, retirementAge]);

  const retirementXValue = useMemo(() => {
    if (xAxisType === 'age') {
      return retirementAge;
    }
    // Calculate retirement year from current age
    const currentYear = new Date().getFullYear();
    return currentYear + (retirementAge - currentAge);
  }, [xAxisType, retirementAge, currentAge]);

  const minBalance = Math.min(...records.map((r) => r.balance));
  const hasNegativeBalance = minBalance < 0;

  return (
    <div className="w-full">
      {/* X-Axis Toggle */}
      <div className="mb-4 flex items-center gap-2">
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

      {/* Chart Container */}
      <div className="h-64 w-full sm:h-80 lg:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
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
              tickFormatter={formatCurrency}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              width={60}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const data = payload[0].payload as ProjectionRecord & {
                  xValue: number;
                  isRetirement: boolean;
                };
                const isNegative = data.balance < 0;
                return (
                  <div className="rounded-lg border border-border bg-card p-3 shadow-md">
                    <p className="text-sm font-medium text-foreground">
                      {xAxisType === 'age' ? `Age ${data.age}` : `Year ${data.year}`}
                    </p>
                    <p
                      className={`text-sm font-medium ${isNegative ? 'text-destructive' : 'text-foreground'}`}
                    >
                      Balance: {formatTooltipCurrency(data.balance)}
                    </p>
                    {isNegative && (
                      <p className="text-xs font-medium text-destructive">
                        ⚠ Funds depleted
                      </p>
                    )}
                    {data.inflows > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Inflows: {formatTooltipCurrency(data.inflows)}
                      </p>
                    )}
                    {data.outflows > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Outflows: {formatTooltipCurrency(data.outflows)}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.isRetirement ? 'Retirement Phase' : 'Accumulation Phase'}
                    </p>
                  </div>
                );
              }}
            />
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
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 12,
              }}
            />
            {/* Accumulation phase area (light primary fill) */}
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
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
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
      </div>
    </div>
  );
}
