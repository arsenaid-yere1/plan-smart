'use client';

import { useState } from 'react';
import { Check, AlertTriangle, X, Edit2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ParsedScenario } from '@/lib/scenarios/types';

interface ScenarioConfirmationProps {
  scenario: ParsedScenario;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (overrides: Record<string, number>) => void;
  onCancel: () => void;
  isApplying?: boolean;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
  if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getConfidenceIcon(confidence: number) {
  if (confidence >= 0.8) return <Check className="h-4 w-4 text-green-600" />;
  if (confidence >= 0.5) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  return <X className="h-4 w-4 text-red-600" />;
}

export function ScenarioConfirmation({
  scenario,
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  isApplying = false,
}: ScenarioConfirmationProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedOverrides, setEditedOverrides] = useState<Record<string, number>>(() => {
    // Filter to only numeric overrides for editing
    const numericOverrides: Record<string, number> = {};
    for (const [key, value] of Object.entries(scenario.overrides)) {
      if (typeof value === 'number') {
        numericOverrides[key] = value;
      }
    }
    return numericOverrides;
  });

  const handleFieldEdit = (key: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setEditedOverrides((prev) => ({ ...prev, [key]: numValue }));
    }
  };

  const handleConfirm = () => {
    onConfirm(editedOverrides);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Scenario</DialogTitle>
          <DialogDescription>
            I understood your question as: &ldquo;{scenario.originalQuery}&rdquo;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground">
            I&apos;ll adjust these parameters:
          </p>

          <div className="space-y-2 rounded-lg border p-3">
            {scenario.fields.map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  {getConfidenceIcon(field.confidence)}
                  <span className="font-medium">{field.label}:</span>
                </div>

                {editingField === field.key ? (
                  <Input
                    type="text"
                    className="h-7 w-24 text-right"
                    defaultValue={
                      field.key.includes('Rate') || field.key === 'expectedReturn'
                        ? (editedOverrides[field.key] * 100).toFixed(1)
                        : editedOverrides[field.key]
                    }
                    onBlur={(e) => {
                      let value = parseFloat(e.target.value);
                      if (field.key.includes('Rate') || field.key === 'expectedReturn') {
                        value = value / 100;
                      }
                      handleFieldEdit(field.key, String(value));
                      setEditingField(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingField(field.key)}
                    className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-muted"
                  >
                    <span>{field.displayValue}</span>
                    <Edit2 className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}

                <span className={`text-xs ${getConfidenceColor(field.confidence)}`}>
                  {Math.round(field.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>

          {scenario.fields.some((f) => f.confidence < 0.8) && (
            <p className="text-xs text-muted-foreground">
              Lower confidence values may need manual adjustment. Click a value to edit.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onCancel} disabled={isApplying}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isApplying}>
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              'Apply Scenario'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
