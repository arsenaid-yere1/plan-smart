import type { ProjectionOverrides } from '@/lib/projections/input-builder';

export interface ParsedScenarioField {
  key: keyof ProjectionOverrides;
  label: string;
  value: number | string;
  displayValue: string;
  confidence: number;
}

export interface ParsedScenario {
  overrides: Partial<ProjectionOverrides>;
  fields: ParsedScenarioField[];
  confidence: {
    overall: number;
    fields: Record<string, number>;
  };
  originalQuery: string;
}

export interface ScenarioParseResponse {
  success: boolean;
  data?: ParsedScenario;
  error?: string;
}

/**
 * Direction indicator for a metric change
 */
export type DeltaDirection = 'positive' | 'negative' | 'neutral';

/**
 * A single key change in the scenario comparison
 */
export interface KeyChange {
  metric: string;
  delta: string;
  direction: DeltaDirection;
}

/**
 * AI-generated explanation response
 */
export interface ScenarioExplanationResponse {
  explanation: string;
  keyChanges: KeyChange[];
}

/**
 * Full response from the explain API
 */
export interface ScenarioExplainApiResponse {
  success: boolean;
  data?: ScenarioExplanationResponse;
  error?: string;
}
