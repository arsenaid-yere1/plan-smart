// Income source categories (tax-relevant classification)
export type IncomeSourceType =
  | 'w2_employment'
  | 'self_employed'
  | 'business_owner'
  | 'contract_1099'
  | 'rental_income'
  | 'investment_income';

// Income variability
export type IncomeVariability = 'recurring' | 'variable' | 'seasonal';

// Tax flexibility (auto-populated based on income type)
export interface TaxFlexibility {
  canDefer: boolean; // Can defer income to future years
  canReduce: boolean; // Can reduce through deductions/expenses
  canRestructure: boolean; // Can change entity structure
}

// Complete income source model
export interface IncomeSource {
  id: string;
  type: IncomeSourceType;
  label: string; // User-friendly display name
  annualAmount: number;
  variability: IncomeVariability;
  flexibility: TaxFlexibility;
  isPrimary: boolean; // Primary income source flag
  notes?: string; // Optional user notes
}

// UI option definitions with plain-language descriptions
export const INCOME_SOURCE_OPTIONS: Array<{
  value: IncomeSourceType;
  label: string;
  description: string;
  defaultFlexibility: TaxFlexibility;
}> = [
  {
    value: 'w2_employment',
    label: 'W-2 Employment',
    description: 'Regular job with taxes withheld from paycheck',
    defaultFlexibility: { canDefer: false, canReduce: false, canRestructure: false },
  },
  {
    value: 'self_employed',
    label: 'Self-Employed / Sole Proprietor',
    description: 'Freelance work or own business without formal entity',
    defaultFlexibility: { canDefer: true, canReduce: true, canRestructure: true },
  },
  {
    value: 'business_owner',
    label: 'Business Owner (LLC / S-Corp)',
    description: 'Own a business through a formal legal entity',
    defaultFlexibility: { canDefer: true, canReduce: true, canRestructure: true },
  },
  {
    value: 'contract_1099',
    label: 'Contract / 1099 Work',
    description: 'Independent contractor or consulting work',
    defaultFlexibility: { canDefer: true, canReduce: true, canRestructure: false },
  },
  {
    value: 'rental_income',
    label: 'Rental Income',
    description: 'Income from renting out property',
    defaultFlexibility: { canDefer: false, canReduce: true, canRestructure: false },
  },
  {
    value: 'investment_income',
    label: 'Investment Income',
    description: 'Dividends, interest, or capital gains',
    defaultFlexibility: { canDefer: true, canReduce: false, canRestructure: false },
  },
];

export const INCOME_VARIABILITY_OPTIONS = [
  { value: 'recurring', label: 'Recurring', description: 'Predictable, consistent income' },
  { value: 'variable', label: 'Variable', description: 'Amount changes month to month' },
  { value: 'seasonal', label: 'Seasonal', description: 'Income concentrated in certain periods' },
] as const;

// Helper to get default flexibility for an income type
export function getDefaultFlexibility(type: IncomeSourceType): TaxFlexibility {
  const option = INCOME_SOURCE_OPTIONS.find((o) => o.value === type);
  return option?.defaultFlexibility ?? { canDefer: false, canReduce: false, canRestructure: false };
}
