'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { CompleteOnboardingDataV2 } from '@/types/onboarding';

interface SmartIntakeProps {
  onApply: (data: Partial<CompleteOnboardingDataV2>) => void;
  onSkip: () => void;
}

interface ParsedField {
  key: string;
  label: string;
  value: string | number;
  confidence: number;
}

export function SmartIntake({ onApply, onSkip }: SmartIntakeProps) {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<{
    data: Partial<CompleteOnboardingDataV2>;
    fields: ParsedField[];
  } | null>(null);

  const handleParse = async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);
    setParsedData(null);

    try {
      const response = await fetch('/api/parse-financial-nl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse input');
      }

      const result = await response.json();
      const data = result.data;

      // Convert to display-friendly format
      const fields: ParsedField[] = [];
      const confidenceScores = data.confidence?.fields || {};

      if (data.birthYear) {
        const age = new Date().getFullYear() - data.birthYear;
        fields.push({
          key: 'birthYear',
          label: 'Age',
          value: age,
          confidence: confidenceScores.birthYear || data.confidence?.overall || 0.8,
        });
      }

      if (data.targetRetirementAge) {
        fields.push({
          key: 'targetRetirementAge',
          label: 'Target Retirement Age',
          value: data.targetRetirementAge,
          confidence: confidenceScores.targetRetirementAge || data.confidence?.overall || 0.8,
        });
      }

      if (data.annualIncome) {
        fields.push({
          key: 'annualIncome',
          label: 'Annual Income',
          value: `$${data.annualIncome.toLocaleString()}`,
          confidence: confidenceScores.annualIncome || data.confidence?.overall || 0.8,
        });
      }

      if (data.investmentAccounts?.length) {
        const total = data.investmentAccounts.reduce(
          (sum: number, a: { balance: number }) => sum + a.balance,
          0
        );
        fields.push({
          key: 'investmentAccounts',
          label: 'Investment Accounts',
          value: `${data.investmentAccounts.length} account(s) totaling $${total.toLocaleString()}`,
          confidence: confidenceScores.investmentAccounts || data.confidence?.overall || 0.8,
        });
      }

      if (data.primaryResidence?.estimatedValue) {
        fields.push({
          key: 'primaryResidence',
          label: 'Home Value',
          value: `$${data.primaryResidence.estimatedValue.toLocaleString()}`,
          confidence: confidenceScores.primaryResidence || data.confidence?.overall || 0.8,
        });
      }

      if (data.debts?.length) {
        const total = data.debts.reduce(
          (sum: number, d: { balance: number }) => sum + d.balance,
          0
        );
        fields.push({
          key: 'debts',
          label: 'Total Debt',
          value: `$${total.toLocaleString()}`,
          confidence: confidenceScores.debts || data.confidence?.overall || 0.8,
        });
      }

      // Add IDs to investment accounts and debts
      if (data.investmentAccounts) {
        data.investmentAccounts = data.investmentAccounts.map(
          (account: { label: string; type: string; balance: number; monthlyContribution?: number }) => ({
            ...account,
            id: crypto.randomUUID(),
          })
        );
      }

      if (data.debts) {
        data.debts = data.debts.map(
          (debt: { label: string; type: string; balance: number; interestRate?: number }) => ({
            ...debt,
            id: crypto.randomUUID(),
          })
        );
      }

      setParsedData({ data, fields });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse input');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (parsedData) {
      onApply(parsedData.data);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Smart Intake
        </CardTitle>
        <CardDescription>
          Describe your financial situation in plain English and we&apos;ll
          extract the details automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="smartInput">Your financial snapshot</Label>
          <textarea
            id="smartInput"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g., I'm 45 years old with $300k in my 401k and $50k in a Roth IRA. I contribute $2k/month to retirement. My home is worth $500k with $300k left on the mortgage at 6.5%. I also have $15k in student loans."
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {parsedData && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-foreground">Detected Information:</h4>
            <ul className="space-y-2">
              {parsedData.fields.map((field) => (
                <li
                  key={field.key}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-foreground">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="font-medium">{field.label}:</span>
                    <span>{field.value}</span>
                  </span>
                  <span
                    className={`text-xs ${getConfidenceColor(field.confidence)}`}
                  >
                    {Math.round(field.confidence * 100)}% confident
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            className="flex-1"
            disabled={isLoading}
          >
            Skip & Enter Manually
          </Button>

          {!parsedData ? (
            <Button
              type="button"
              onClick={handleParse}
              className="flex-1"
              disabled={isLoading || !text.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>
          ) : (
            <Button type="button" onClick={handleApply} className="flex-1">
              Apply & Continue
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
