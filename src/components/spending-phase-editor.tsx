'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Plus, Trash2 } from 'lucide-react';
import type { SpendingPhase, SpendingPhaseConfig } from '@/lib/projections/types';
import { DEFAULT_SPENDING_PHASES } from '@/lib/projections/assumptions';

interface SpendingPhaseEditorProps {
  config: SpendingPhaseConfig | undefined;
  retirementAge: number;
  onChange: (config: SpendingPhaseConfig) => void;
}

export function SpendingPhaseEditor({
  config,
  retirementAge,
  onChange,
}: SpendingPhaseEditorProps) {
  // Initialize with defaults if no config
  const [localConfig, setLocalConfig] = useState<SpendingPhaseConfig>(() => {
    if (config) return config;
    return {
      enabled: false,
      phases: DEFAULT_SPENDING_PHASES.map((p, i) => ({
        ...p,
        startAge: i === 0 ? retirementAge : p.startAge,
      })),
    };
  });

  const handleEnabledChange = useCallback((enabled: boolean) => {
    const newConfig = { ...localConfig, enabled };
    setLocalConfig(newConfig);
    onChange(newConfig);
  }, [localConfig, onChange]);

  const handlePhaseChange = useCallback((index: number, updates: Partial<SpendingPhase>) => {
    const sortedPhases = [...localConfig.phases].sort((a, b) => a.startAge - b.startAge);
    const newPhases = [...sortedPhases];
    newPhases[index] = { ...newPhases[index], ...updates };
    const newConfig = { ...localConfig, phases: newPhases };
    setLocalConfig(newConfig);
    onChange(newConfig);
  }, [localConfig, onChange]);

  const addPhase = useCallback(() => {
    if (localConfig.phases.length >= 4) return;

    const sortedPhases = [...localConfig.phases].sort((a, b) => a.startAge - b.startAge);
    const lastPhase = sortedPhases[sortedPhases.length - 1];
    const newPhase: SpendingPhase = {
      id: `phase-${Date.now()}`,
      name: 'New Phase',
      startAge: (lastPhase?.startAge ?? retirementAge) + 10,
      essentialMultiplier: 1.0,
      discretionaryMultiplier: 1.0,
    };

    const newConfig = {
      ...localConfig,
      phases: [...localConfig.phases, newPhase],
    };
    setLocalConfig(newConfig);
    onChange(newConfig);
  }, [localConfig, onChange, retirementAge]);

  const removePhase = useCallback((index: number) => {
    if (localConfig.phases.length <= 1) return;

    const sortedPhases = [...localConfig.phases].sort((a, b) => a.startAge - b.startAge);
    const newPhases = sortedPhases.filter((_, i) => i !== index);
    const newConfig = { ...localConfig, phases: newPhases };
    setLocalConfig(newConfig);
    onChange(newConfig);
  }, [localConfig, onChange]);

  const sortedPhases = [...localConfig.phases].sort((a, b) => a.startAge - b.startAge);

  return (
    <div className="space-y-4">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="phases-enabled" className="font-medium">
            Enable Spending Phases
          </Label>
          <p className="text-sm text-muted-foreground">
            Model how spending changes through retirement (Go-Go, Slow-Go, No-Go)
          </p>
        </div>
        <Switch
          id="phases-enabled"
          checked={localConfig.enabled}
          onCheckedChange={handleEnabledChange}
        />
      </div>

      {/* Phase Editor */}
      {localConfig.enabled && (
        <div className="space-y-4 pt-4 border-t">
          {sortedPhases.map((phase, index) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              index={index}
              canDelete={localConfig.phases.length > 1}
              onChange={(updates) => handlePhaseChange(index, updates)}
              onDelete={() => removePhase(index)}
            />
          ))}

          {localConfig.phases.length < 4 && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={addPhase}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Phase
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface PhaseCardProps {
  phase: SpendingPhase;
  index: number;
  canDelete: boolean;
  onChange: (updates: Partial<SpendingPhase>) => void;
  onDelete: () => void;
}

function PhaseCard({
  phase,
  canDelete,
  onChange,
  onDelete,
}: PhaseCardProps) {
  const [useAbsolute, setUseAbsolute] = useState(
    phase.absoluteEssential !== undefined || phase.absoluteDiscretionary !== undefined
  );

  const handleAbsoluteToggle = (checked: boolean) => {
    setUseAbsolute(checked);
    if (!checked) {
      onChange({
        absoluteEssential: undefined,
        absoluteDiscretionary: undefined,
      });
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
      {/* Phase Header */}
      <div className="flex items-center gap-2">
        <Input
          value={phase.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="font-medium flex-1"
          placeholder="Phase name"
        />
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label="Remove phase"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Start Age */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start Age</Label>
          <Input
            type="number"
            value={phase.startAge}
            onChange={(e) => onChange({ startAge: parseInt(e.target.value) || 50 })}
            min={50}
            max={100}
          />
        </div>

        <div className="flex items-end">
          <div className="flex items-center gap-2">
            <Switch
              id={`absolute-${phase.id}`}
              checked={useAbsolute}
              onCheckedChange={handleAbsoluteToggle}
            />
            <Label htmlFor={`absolute-${phase.id}`} className="text-sm">
              Use $ amounts
            </Label>
          </div>
        </div>
      </div>

      {/* Spending Controls */}
      {useAbsolute ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Essential ($/year)</Label>
            <Input
              type="number"
              value={phase.absoluteEssential ?? ''}
              onChange={(e) => onChange({
                absoluteEssential: e.target.value ? parseFloat(e.target.value) : undefined
              })}
              placeholder="Use multiplier"
              min={0}
              max={500000}
            />
          </div>
          <div>
            <Label>Discretionary ($/year)</Label>
            <Input
              type="number"
              value={phase.absoluteDiscretionary ?? ''}
              onChange={(e) => onChange({
                absoluteDiscretionary: e.target.value ? parseFloat(e.target.value) : undefined
              })}
              placeholder="Use multiplier"
              min={0}
              max={500000}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label>Essential Spending</Label>
            <Slider
              min={10}
              max={200}
              step={5}
              value={[Math.round(phase.essentialMultiplier * 100)]}
              onValueChange={([value]) => onChange({
                essentialMultiplier: value / 100
              })}
              formatValue={(v) => `${v}%`}
            />
          </div>
          <div>
            <Label>Discretionary Spending</Label>
            <Slider
              min={0}
              max={300}
              step={5}
              value={[Math.round(phase.discretionaryMultiplier * 100)]}
              onValueChange={([value]) => onChange({
                discretionaryMultiplier: value / 100
              })}
              formatValue={(v) => `${v}%`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
