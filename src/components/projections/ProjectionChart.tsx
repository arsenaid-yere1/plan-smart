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
  inflationRate?: number;
  shortfallAge?: number;
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
  inflationRate = 0.025,
  shortfallAge,
}: ProjectionChartProps) {
  const [xAxisType, setXAxisType] = useState<XAxisType>('age');
  const [adjustForInflation, setAdjustForInflation] = useState(true);

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

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const isRetirement = record.age >= retirementAge;
      const prevRecord = i > 0 ? records[i - 1] : null;

      // Calculate inflation adjustment factor
      const yearsFromNow = record.age - currentAge;
      const inflationFactor = Math.pow(1 + inflationRate, yearsFromNow);
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

  const minBalance = Math.min(...records.map((r) => r.balance));
  const hasNegativeBalance = minBalance < 0;

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
      </div>

      {/* Chart Container */}
      <div className="h-64 w-full sm:h-80 lg:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
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
                  displayBalance: number;
                  nominalBalance: number;
                  realBalance: number;
                };
                const isNegative = data.displayBalance < 0;
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
            {/* Shortfall marker */}
            {shortfallXValue !== null && (
              <ReferenceLine
                x={shortfallXValue}
                stroke="hsl(var(--destructive))"
                strokeDasharray="5 5"
                label={{
                  value: 'Shortfall',
                  position: 'top',
                  fill: 'hsl(var(--destructive))',
                  fontSize: 12,
                }}
              />
            )}
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
        {shortfallAge && (
          <div className="flex items-center gap-2">
            <div className="h-4 w-0.5 border-l-2 border-dashed border-destructive" />
            <span>Funds Depleted</span>
          </div>
        )}
      </div>
    </div>
  );
}
