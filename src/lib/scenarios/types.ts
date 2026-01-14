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
