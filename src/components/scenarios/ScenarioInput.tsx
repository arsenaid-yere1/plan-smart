'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScenarioConfirmation } from './ScenarioConfirmation';
import type { ParsedScenario } from '@/lib/scenarios/types';
import type { Assumptions } from '@/components/projections/AssumptionsPanel';

interface ScenarioInputProps {
  currentAssumptions: Assumptions;
  onApply: (assumptions: Assumptions) => void;
  disabled?: boolean;
}

export function ScenarioInput({
  currentAssumptions,
  onApply,
  disabled = false,
}: ScenarioInputProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedScenario, setParsedScenario] = useState<ParsedScenario | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleParse = useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scenarios/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to parse scenario');
        return;
      }

      if (!result.data?.fields?.length) {
        setError('I couldn\'t identify any scenario parameters. Try something like "What if I retire at 65?"');
        return;
      }

      setParsedScenario(result.data);
      setShowConfirmation(true);
    } catch {
      setError('Failed to connect. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  const handleConfirm = useCallback(
    (overrides: Record<string, number>) => {
      setIsApplying(true);

      // Map overrides to Assumptions format
      const newAssumptions: Assumptions = {
        expectedReturn: overrides.expectedReturn ?? currentAssumptions.expectedReturn,
        inflationRate: overrides.inflationRate ?? currentAssumptions.inflationRate,
        retirementAge: overrides.retirementAge ?? currentAssumptions.retirementAge,
      };

      // Call the parent's apply function
      onApply(newAssumptions);

      // Clean up
      setIsApplying(false);
      setShowConfirmation(false);
      setParsedScenario(null);
      setQuery('');
    },
    [currentAssumptions, onApply]
  );

  const handleCancel = useCallback(() => {
    setShowConfirmation(false);
    setParsedScenario(null);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleParse();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium">Ask a &quot;What If&quot; Question</span>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder='Try: "What if I retire at 65?" or "What if I get 7% returns?"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          className="flex-1"
        />
        <Button
          onClick={handleParse}
          disabled={disabled || isLoading || !query.trim()}
          size="default"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Parsing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Analyze
            </>
          )}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {parsedScenario && (
        <ScenarioConfirmation
          scenario={parsedScenario}
          open={showConfirmation}
          onOpenChange={setShowConfirmation}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          isApplying={isApplying}
        />
      )}
    </div>
  );
}
