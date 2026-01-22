'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import type { SpendingPhase, SpendingPhaseConfig } from '@/lib/projections/types';

interface SpendingPhaseEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseId: string | null;
  config: SpendingPhaseConfig | null;
  onSave: (config: SpendingPhaseConfig) => Promise<void>;
}

export function SpendingPhaseEditModal({
  open,
  onOpenChange,
  phaseId,
  config,
  onSave,
}: SpendingPhaseEditModalProps) {
  const [localPhase, setLocalPhase] = useState<SpendingPhase | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [useAbsolute, setUseAbsolute] = useState(false);

  // Find and load the phase when modal opens
  useEffect(() => {
    if (open && phaseId && config) {
      const phase = config.phases.find((p) => p.id === phaseId);
      if (phase) {
        setLocalPhase({ ...phase });
        setUseAbsolute(
          phase.absoluteEssential !== undefined ||
            phase.absoluteDiscretionary !== undefined
        );
      }
    }
  }, [open, phaseId, config]);

  const handleSave = async () => {
    if (!localPhase || !config) return;

    setIsSaving(true);
    try {
      const updatedPhases = config.phases.map((p) =>
        p.id === localPhase.id ? localPhase : p
      );
      await onSave({ ...config, phases: updatedPhases });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAbsoluteToggle = (checked: boolean) => {
    setUseAbsolute(checked);
    if (!checked && localPhase) {
      setLocalPhase({
        ...localPhase,
        absoluteEssential: undefined,
        absoluteDiscretionary: undefined,
      });
    }
  };

  if (!localPhase) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {localPhase.name}</DialogTitle>
          <DialogDescription>
            Adjust spending levels for this phase of retirement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Phase Name */}
          <div className="space-y-2">
            <Label htmlFor="phase-name">Phase Name</Label>
            <Input
              id="phase-name"
              value={localPhase.name}
              onChange={(e) =>
                setLocalPhase({ ...localPhase, name: e.target.value })
              }
            />
          </div>

          {/* Start Age */}
          <div className="space-y-2">
            <Label htmlFor="start-age">Start Age</Label>
            <Input
              id="start-age"
              type="number"
              value={localPhase.startAge}
              onChange={(e) =>
                setLocalPhase({
                  ...localPhase,
                  startAge: parseInt(e.target.value) || 50,
                })
              }
              min={50}
              max={100}
            />
          </div>

          {/* Use Absolute Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="use-absolute"
              checked={useAbsolute}
              onCheckedChange={handleAbsoluteToggle}
            />
            <Label htmlFor="use-absolute" className="text-sm">
              Use fixed dollar amounts instead of percentages
            </Label>
          </div>

          {/* Spending Controls */}
          {useAbsolute ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Essential ($/year)</Label>
                <Input
                  type="number"
                  value={localPhase.absoluteEssential ?? ''}
                  onChange={(e) =>
                    setLocalPhase({
                      ...localPhase,
                      absoluteEssential: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="Use multiplier"
                  min={0}
                  max={500000}
                />
              </div>
              <div className="space-y-2">
                <Label>Discretionary ($/year)</Label>
                <Input
                  type="number"
                  value={localPhase.absoluteDiscretionary ?? ''}
                  onChange={(e) =>
                    setLocalPhase({
                      ...localPhase,
                      absoluteDiscretionary: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="Use multiplier"
                  min={0}
                  max={500000}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Essential Spending (
                  {Math.round(localPhase.essentialMultiplier * 100)}%)
                </Label>
                <Slider
                  min={10}
                  max={200}
                  step={5}
                  value={[Math.round(localPhase.essentialMultiplier * 100)]}
                  onValueChange={([value]) =>
                    setLocalPhase({
                      ...localPhase,
                      essentialMultiplier: value / 100,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Discretionary Spending (
                  {Math.round(localPhase.discretionaryMultiplier * 100)}%)
                </Label>
                <Slider
                  min={0}
                  max={300}
                  step={5}
                  value={[Math.round(localPhase.discretionaryMultiplier * 100)]}
                  onValueChange={([value]) =>
                    setLocalPhase({
                      ...localPhase,
                      discretionaryMultiplier: value / 100,
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
