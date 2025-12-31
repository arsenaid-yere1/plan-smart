/**
 * Maps monthly spending to a lifestyle label based on US retirement spending percentiles.
 *
 * Thresholds based on 2024-2025 data:
 * - Simple (≤30th percentile): Under $2,500/month
 * - Moderate (30th-70th percentile): $2,500 - $5,500/month
 * - Flexible (≥70th percentile): Over $5,500/month
 *
 * @param monthlySpending - Monthly spending in dollars
 * @returns Lifestyle label: 'simple' | 'moderate' | 'flexible'
 */
export function getLifestyleLabel(monthlySpending: number): 'simple' | 'moderate' | 'flexible' {
  if (monthlySpending < 2500) {
    return 'simple';
  } else if (monthlySpending < 5500) {
    return 'moderate';
  } else {
    return 'flexible';
  }
}
