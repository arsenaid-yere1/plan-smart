import { createHash } from 'crypto';
import type { ProjectionInput } from '@/lib/projections/types';

/**
 * Create a deterministic SHA-256 hash of projection inputs for caching.
 * Same inputs always produce the same hash.
 */
export function hashProjectionInputs(inputs: ProjectionInput): string {
  // Sort keys to ensure deterministic stringification
  const sortedInputs = JSON.stringify(inputs, Object.keys(inputs).sort());
  return createHash('sha256').update(sortedInputs).digest('hex');
}
