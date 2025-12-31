import { describe, it, expect } from 'vitest';
import { getLifestyleLabel } from '../lifestyle-label';

describe('getLifestyleLabel', () => {
  describe('simple lifestyle (under $2,500/month)', () => {
    it('returns simple for $0 spending', () => {
      expect(getLifestyleLabel(0)).toBe('simple');
    });

    it('returns simple for $2,000 spending', () => {
      expect(getLifestyleLabel(2000)).toBe('simple');
    });

    it('returns simple for $2,499 spending (boundary)', () => {
      expect(getLifestyleLabel(2499)).toBe('simple');
    });
  });

  describe('moderate lifestyle ($2,500 - $5,499/month)', () => {
    it('returns moderate for $2,500 spending (boundary)', () => {
      expect(getLifestyleLabel(2500)).toBe('moderate');
    });

    it('returns moderate for $4,000 spending', () => {
      expect(getLifestyleLabel(4000)).toBe('moderate');
    });

    it('returns moderate for $5,499 spending (boundary)', () => {
      expect(getLifestyleLabel(5499)).toBe('moderate');
    });
  });

  describe('flexible lifestyle ($5,500+/month)', () => {
    it('returns flexible for $5,500 spending (boundary)', () => {
      expect(getLifestyleLabel(5500)).toBe('flexible');
    });

    it('returns flexible for $7,000 spending', () => {
      expect(getLifestyleLabel(7000)).toBe('flexible');
    });

    it('returns flexible for $10,000 spending', () => {
      expect(getLifestyleLabel(10000)).toBe('flexible');
    });
  });
});
