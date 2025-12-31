'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Sparkles, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AISummaryProps {
  projectionResultId: string | null;
  status: 'on-track' | 'needs-adjustment' | 'at-risk';
  projectedRetirementBalance: number;
  yearsUntilDepletion: number | null;
}

interface SummaryData {
  whereYouStand: string;
  assumptions: string;
  lifestyle: string;
  disclaimer: string;
}

interface SummaryMeta {
  cached: boolean;
  generatedAt: string;
  projectionVersion: string;
  model: string;
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-muted', className)} />
  );
}

export function AISummary({
  projectionResultId,
  status,
  projectedRetirementBalance,
  yearsUntilDepletion,
}: AISummaryProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [meta, setMeta] = useState<SummaryMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!projectionResultId) return;

    const loadSummary = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/plan-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectionResultId, regenerate: false }),
        });

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 429) {
            setError(`Rate limit reached. Try again after ${new Date(data.resetAt).toLocaleTimeString()}`);
          } else {
            setError(data.message || 'Failed to generate summary');
          }
          return;
        }

        const data = await response.json();
        setSummary(data.summary);
        setMeta(data.meta);
      } catch {
        setError('Failed to load summary. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [projectionResultId]);

  async function fetchSummary(regenerate: boolean) {
    if (!projectionResultId) return;

    setLoading(!regenerate);
    setRegenerating(regenerate);
    setError(null);

    try {
      const response = await fetch('/api/ai/plan-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectionResultId, regenerate }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 429) {
          setError(`Rate limit reached. Try again after ${new Date(data.resetAt).toLocaleTimeString()}`);
        } else {
          setError(data.message || 'Failed to generate summary');
        }
        return;
      }

      const data = await response.json();
      setSummary(data.summary);
      setMeta(data.meta);
    } catch {
      setError('Failed to load summary. Please try again.');
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }

  // Fallback UI when AI is unavailable
  if (!projectionResultId || error) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5" />
            Your Retirement Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FallbackSummary
            status={status}
            projectedRetirementBalance={projectedRetirementBalance}
            yearsUntilDepletion={yearsUntilDepletion}
          />
          {error && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => fetchSummary(false)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 animate-pulse" />
            Generating Your Summary...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  // Success state with summary
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Your Retirement Summary
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchSummary(true)}
          disabled={regenerating}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", regenerating && "animate-spin")} />
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {summary && (
          <>
            <SummarySection
              title="Where You Stand"
              content={summary.whereYouStand}
            />
            <SummarySection
              title="Key Assumptions"
              content={summary.assumptions}
            />
            <SummarySection
              title="What This Means for Your Lifestyle"
              content={summary.lifestyle}
            />
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground italic">
                {summary.disclaimer}
              </p>
            </div>
          </>
        )}
        {meta && (
          <p className="text-xs text-muted-foreground">
            {meta.cached ? 'Cached summary' : 'Freshly generated'} •
            Version {meta.projectionVersion}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SummarySection({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h4 className="font-medium text-sm text-muted-foreground mb-1">{title}</h4>
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  );
}

function FallbackSummary({
  status,
  projectedRetirementBalance,
  yearsUntilDepletion,
}: {
  status: 'on-track' | 'needs-adjustment' | 'at-risk';
  projectedRetirementBalance: number;
  yearsUntilDepletion: number | null;
}) {
  const statusLabels = {
    'on-track': { label: 'On Track', color: 'text-green-600' },
    'needs-adjustment': { label: 'Needs Adjustment', color: 'text-yellow-600' },
    'at-risk': { label: 'At Risk', color: 'text-red-600' },
  };

  const { label, color } = statusLabels[status];
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Your retirement projection status: <span className={cn("font-semibold", color)}>{label}</span>
      </p>
      <p className="text-sm">
        Projected balance at retirement: <span className="font-semibold">{formatter.format(projectedRetirementBalance)}</span>
      </p>
      <p className="text-sm">
        {yearsUntilDepletion === null
          ? 'Your funds are projected to last through your planned lifespan.'
          : `Funds projected to last ${yearsUntilDepletion} years into retirement.`}
      </p>
      <p className="text-xs text-muted-foreground italic mt-4">
        AI summary temporarily unavailable. Here&apos;s your projection overview.
      </p>
    </div>
  );
}
