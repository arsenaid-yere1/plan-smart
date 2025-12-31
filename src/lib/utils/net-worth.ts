import type {
  InvestmentAccountJson,
  DebtJson,
  RealEstatePropertyJson,
} from '@/db/schema/financial-snapshot';

export interface NetWorthBreakdown {
  // Assets
  investmentAccounts: number;
  realEstateValue: number;
  totalAssets: number;

  // Liabilities
  realEstateMortgages: number;
  otherDebts: number;
  totalLiabilities: number;

  // Net Worth
  realEstateEquity: number;
  netWorth: number;
}

export function calculateNetWorth(
  investmentAccounts: InvestmentAccountJson[] | null | undefined,
  realEstateProperties: RealEstatePropertyJson[] | null | undefined,
  debts: DebtJson[] | null | undefined
): NetWorthBreakdown {
  // Investment accounts
  const investmentTotal = (investmentAccounts ?? []).reduce(
    (sum, acc) => sum + (acc.balance ?? 0),
    0
  );

  // Real estate
  const properties = realEstateProperties ?? [];
  const realEstateValue = properties.reduce(
    (sum, prop) => sum + (prop.estimatedValue ?? 0),
    0
  );
  const realEstateMortgages = properties.reduce(
    (sum, prop) => sum + (prop.mortgageBalance ?? 0),
    0
  );
  const realEstateEquity = realEstateValue - realEstateMortgages;

  // Other debts (non-mortgage)
  const otherDebts = (debts ?? []).reduce(
    (sum, debt) => sum + (debt.balance ?? 0),
    0
  );

  // Totals
  const totalAssets = investmentTotal + realEstateValue;
  const totalLiabilities = realEstateMortgages + otherDebts;
  const netWorth = totalAssets - totalLiabilities;

  return {
    investmentAccounts: investmentTotal,
    realEstateValue,
    totalAssets,
    realEstateMortgages,
    otherDebts,
    totalLiabilities,
    realEstateEquity,
    netWorth,
  };
}
