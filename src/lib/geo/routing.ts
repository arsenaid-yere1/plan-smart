import type { NextRequest } from 'next/server';

export interface RegionConfig {
  supabaseUrl: string;
  region: string;
}

// Map countries to continents for geo-routing
const EUROPEAN_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH', 'NO',
]);

const ASIA_PACIFIC_COUNTRIES = new Set([
  'AU', 'NZ', 'JP', 'KR', 'CN', 'HK', 'TW', 'SG', 'MY', 'TH',
  'VN', 'ID', 'PH', 'IN', 'PK', 'BD',
]);

/**
 * Determine optimal Supabase region based on user geography
 */
export function getOptimalRegion(request: NextRequest): RegionConfig {
  const geo = request.geo;

  // US East (default)
  if (!geo || geo.country === 'US') {
    const isWestCoast =
      geo?.region?.startsWith('CA') ||
      geo?.region?.startsWith('WA') ||
      geo?.region?.startsWith('OR');

    if (isWestCoast) {
      return {
        region: 'us-west',
        supabaseUrl:
          process.env.SUPABASE_US_WEST_URL ||
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
      };
    }

    return {
      region: 'us-east',
      supabaseUrl:
        process.env.SUPABASE_US_EAST_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
    };
  }

  // Europe
  if (geo.country && EUROPEAN_COUNTRIES.has(geo.country)) {
    return {
      region: 'eu-west',
      supabaseUrl:
        process.env.SUPABASE_EU_WEST_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
    };
  }

  // Asia Pacific
  if (geo.country && ASIA_PACIFIC_COUNTRIES.has(geo.country)) {
    return {
      region: 'asia-southeast',
      supabaseUrl:
        process.env.SUPABASE_ASIA_SE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
    };
  }

  // Default to US East
  return {
    region: 'us-east',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  };
}

/**
 * Get region from request headers (set by middleware)
 */
export function getRegionFromHeaders(
  headers: Headers
): RegionConfig | undefined {
  const region = headers.get('x-supabase-region');
  const supabaseUrl = headers.get('x-supabase-url');

  if (region && supabaseUrl) {
    return { region, supabaseUrl };
  }

  return undefined;
}
