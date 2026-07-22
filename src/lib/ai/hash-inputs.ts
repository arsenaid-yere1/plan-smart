import { createHash } from 'crypto';
import type { ProjectionInput } from '@/lib/projections/types';

/**
 * Create a deterministic SHA-256 hash of projection inputs for caching.
 * Same inputs always produce the same hash.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

export function hashProjectionInputs(
  inputs: ProjectionInput,
  calculationVersion: number
): string {
  const cacheMaterial = JSON.stringify(canonicalize({ calculationVersion, inputs }));
  return createHash('sha256').update(cacheMaterial).digest('hex');
}
