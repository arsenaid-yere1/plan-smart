---
date: 2026-07-22
researcher: Codex
git_commit: 9b48efb
branch: main
repository: plan-smart
topic: "Tax planning features, gaps, and best-practice assessment"
tags: [research, tax-planning, projections, rmd, retirement]
status: complete
---

# Tax Planning Features, Gaps, and Best-Practice Assessment

## Research question

How does PlanSmart currently model tax-relevant retirement planning, how does data flow from user input to projections and outputs, which capabilities are missing or only partially wired, and which gaps should be prioritized against current U.S. tax-planning practices?

This document distinguishes verified repository behavior from external best-practice recommendations. It does not implement changes.

## Summary

PlanSmart currently provides a **tax-awareness layer**, not an actual tax projection engine.

Verified shipped capabilities include:

- three balance categories (`taxDeferred`, `taxFree`, and `taxable`);
- a fixed taxable -> tax-deferred -> tax-free withdrawal order;
- aggregate Required Minimum Distribution (RMD) calculation and enforcement using the Uniform Lifetime Table;
- a stacked account-tax-category chart, RMD tooltips, and tax/RMD export columns;
- collection of filing status, state of residence, account type, income-source category, and tax-flexibility metadata;
- focused unit and engine tests for the fixed withdrawal order and basic RMD behavior.

The main limitations are:

1. No federal or state income-tax liability is calculated. There are no tax-year rules, brackets, deductions, taxable Social Security, capital-gains rates/basis, or after-tax cash flow.
2. Filing status, state, and income-source flexibility are stored but do not drive projections.
3. The RMD model is useful but simplified: it is fixed to age 73 by default, aggregate rather than account/owner specific, only runs after modeled retirement, and drops any RMD amount not needed for spending from the modeled asset system.
4. Contribution destinations are not preserved. Contributions from individual accounts are summed and redistributed using a global 60/30/10 tax-category default.
5. “Tax-aware withdrawal” is a fixed heuristic, not tax optimization. It cannot fill brackets, compare Roth conversions, manage gains, or account for Medicare/ACA cliffs.
6. A separate projection-integrity issue compounds tax-planning accuracy: healthcare expenses are displayed as outflows but are not included in the portfolio withdrawal requirement.

The recommended order is to repair projection/RMD cash-flow integrity first, then build a versioned federal after-tax engine, then add optimization and state/healthcare interactions.

## Current implementation by component

### 1. User inputs and persistence

The product collects several tax-relevant fields:

- `stateOfResidence` and `filingStatus` are part of onboarding (`src/types/onboarding.ts:64-77`) and persisted on the financial snapshot (`src/db/schema/financial-snapshot.ts:122-141`).
- Filing status currently supports Single, Married Filing Jointly, and Head of Household (`src/types/onboarding.ts:90-94`). Married Filing Separately and Qualifying Surviving Spouse are not represented.
- Six investment account types are supported: 401(k), Traditional IRA, Roth IRA, Brokerage, Cash, and Other (`src/types/onboarding.ts:114-132`).
- Working-age income sources record category, variability, and three tax-flexibility booleans (`canDefer`, `canReduce`, `canRestructure`) (`src/types/income-sources.ts:1-29`). Defaults exist for W-2, self-employment, business, contract, rental, and investment income (`src/types/income-sources.ts:32-74`).

Verified downstream use is much narrower:

- The calculate route uses current-income `annualAmount` and a variability haircut, and uses raw source totals to estimate Social Security (`src/app/api/projections/calculate/route.ts:81-102,130-154`).
- No projection consumer reads `stateOfResidence`, `filingStatus`, or the income-source `flexibility` flags.
- No database field exists for cost basis, deduction elections, Roth conversions, IRMAA, QCDs, per-account RMD settings, or tax-rule year/version.

### 2. Account tax classification

Accounts are collapsed into three categories (`src/lib/projections/types.ts:3-70`):

| Source account type | Projection category |
| --- | --- |
| 401(k), Traditional IRA | tax-deferred |
| Roth IRA | tax-free |
| Brokerage, Cash, Other | taxable |

The API aggregates balances using this mapping and warns when an unknown type is treated as taxable (`src/app/api/projections/calculate/route.ts:181-197`). The shared input builder and server-rendered plans/dashboard paths use the same fallback without that warning (`src/lib/projections/input-builder.ts:71-82`).

This aggregation loses account owner, plan type, employer-plan status, beneficiary/table choice, basis, and actual per-account contribution destination.

Monthly contributions from all accounts are summed and then redistributed using a global allocation. The default is 60% tax-deferred, 30% tax-free, and 10% taxable (`src/lib/projections/assumptions.ts:28-35`; `src/app/api/projections/calculate/route.ts:199-203,256-266`). This means a contribution entered on a specific Roth IRA or 401(k) does not necessarily remain assigned to that account's tax category in the projection.

### 3. Withdrawal behavior

`withdrawFromAccounts()` uses a fixed order:

1. taxable;
2. tax-deferred;
3. tax-free.

The implementation and its comments are at `src/lib/projections/engine.ts:26-59`. No tax liability is calculated. “Capital gains treatment” and “ordinary income” appear only as explanatory comments; both withdrawals are dollar-for-dollar gross balance reductions.

All three categories receive the same return rate (`src/lib/projections/engine.ts:138-147`). There is no taxable-account tax drag, qualified-dividend treatment, realized-gain ratio, or cost-basis tracking.

### 4. RMD implementation

The shipped RMD module contains a hard-coded Uniform Lifetime Table for ages 73-120, a default start age of 73, and the prior-year-balance/divisor calculation (`src/lib/projections/rmd.ts:3-104`). Values above age 120 use a divisor of 2.0.

During drawdown, the engine:

1. reads the default or direct-call `rmdConfig`;
2. calculates RMD from the preceding projected year-end aggregate tax-deferred balance;
3. withdraws the RMD from tax-deferred assets first;
4. uses it to satisfy spending, then resumes taxable -> deferred -> tax-free ordering for any remaining need;
5. records required, taken, and excess-over-RMD values (`src/lib/projections/engine.ts:61-136,440-487,530-555`).

Important verified limitations:

- The calculation only occurs inside the retired branch. A user modeled as working past age 73 receives no RMD until retirement (`src/lib/projections/engine.ts:394-452`).
- The default start age is always 73. Birth-cohort transition to age 75 is mentioned in a comment but not derived from birth year (`src/lib/projections/rmd.ts:62-67`).
- RMD is computed on one aggregate tax-deferred balance, so account-specific and owner-specific rules cannot be represented.
- When RMD exceeds spending need, the excess is removed from the deferred balance but is not added to cash/taxable assets or counted as income. It therefore disappears from modeled household assets (`src/lib/projections/engine.ts:463-487`).
- A public API caller cannot set `rmdConfig`: it exists on `ProjectionInput`, but not on `ProjectionRequest` or the request validation schema (`src/lib/projections/types.ts:245-289`; `src/lib/validation/projections.ts:201-279`).
- The first-year April 1 deferral option, possible double-distribution year, still-working employer-plan exception, 5% owner exception, spouse-more-than-10-years-younger table, inherited accounts, and QCD treatment are absent.
- The `/api/projections/calculate` route rejects `currentAge >= retirementAge`, even though the engine supports already-retired inputs (`src/app/api/projections/calculate/route.ts:55-79,283-295`; `src/lib/projections/engine.ts:366-369,508-511`). This can block the API path most relevant to current RMD users.

### 5. Income and expense treatment

Retirement streams support Social Security, pensions, rental income, annuities, part-time work, and other income (`src/lib/projections/types.ts:8-49`). The engine sums active streams as gross cash, optionally inflation-adjusted, without tax treatment by source (`src/lib/projections/engine.ts:185-201,437-439`).

Social Security benefits are estimated from current income when explicit streams do not exist, but the estimate is not an SSA benefit calculation and taxable Social Security is not calculated (`src/lib/projections/assumptions.ts:145-180`; `src/lib/projections/input-builder.ts:121-150`).

Healthcare costs are calculated with a separate inflation rate and included in displayed `outflows`, but they are not passed into reserve-constrained spending or `withdrawalNeeded` (`src/lib/projections/engine.ts:429-468,485-487`). This is a verified projection-integrity defect: balances can be overstated even though charts/exports show the healthcare expense.

### 6. API, storage, UI, and exports

The main projection API builds inputs, runs the engine, optionally persists inputs/records/summary, and returns warnings (`src/app/api/projections/calculate/route.ts:256-365`). Stored assumptions contain returns, inflation, retirement age, and max age, but no tax year, tax ruleset, or RMD assumptions.

The chart provides Balance, By Account Type, and optional Spending views. The tax view stacks taxable, tax-deferred, and tax-free balances and labels the categories (`src/components/projections/ProjectionChart.tsx:486-535,625-655,870-915,1067-1096`). Balance-view tooltips show RMD required and taken (`src/components/projections/ProjectionChart.tsx:737-747,813-823`).

CSV and PDF exports include the three category balances and RMD required/taken (`src/hooks/useProjectionExport.ts:74-110,193-227`). They do not include withdrawal amounts by category, `excessOverRmd`, estimated tax, or after-tax income.

The warning layer alerts only users ages 70-72 with more than $100,000 tax-deferred (`src/lib/projections/warnings.ts:65-76`). It is not cohort-aware.

## Execution and data flow

```text
Onboarding/profile
  -> financial_snapshot
     - state + filing status (stored, not used by engine)
     - individual accounts (identity retained in storage)
     - income source tax-flexibility metadata (stored, mostly unused)
  -> calculate route / shared input builder
     - collapse accounts into 3 tax buckets
     - sum contributions, redistribute by global allocation
     - create gross retirement income streams
  -> runProjection
     - accumulation: contributions + same return for every bucket
     - retirement: gross income, spending need, aggregate RMD
     - fixed withdrawal order; no tax calculation
  -> records / persistence
     - balances and withdrawals by tax bucket
     - RMD required/taken/excess
  -> chart / table / CSV / PDF
     - tax-bucket balance visualization
     - partial RMD visibility
```

## Existing tests

Verified source-level coverage includes:

- taxable -> deferred -> tax-free withdrawal ordering and exhaustion/shortfall (`src/lib/projections/__tests__/engine.test.ts:9-53`);
- contribution-allocation validation (`src/lib/validation/__tests__/projections.test.ts:323-368`);
- RMD table factors, below-age behavior, nonpositive balances, age-73/85 calculations, and default age (`src/lib/projections/__tests__/rmd.test.ts:9-81`);
- engine RMD activation, high-income/excess-RMD case, disable config, and prior-year balance (`src/lib/projections/__tests__/engine.test.ts:974-1098`);
- retirement income stream timing/inflation and income-floor behavior (`src/lib/projections/__tests__/engine.test.ts:292-570`; `src/lib/projections/__tests__/income-floor.test.ts:9-190`);
- chart and export infrastructure using tax-balance fixtures.

Concrete missing assertions include:

- direct branch coverage of `withdrawFromAccountsWithRMD()`, including insufficient deferred funds, cascading after RMD, shortfall, and `excessOverRmd`;
- enabled custom RMD start ages and public API behavior;
- cohort age 75, RMD while working/after age 73, first-year handling, and excess-RMD reinvestment;
- the RMD warning;
- tax-breakdown toggle, transformation, tooltip, stacked areas, legend, and RMD tooltip;
- actual tax/RMD CSV and PDF cell contents;
- working-age income-source schemas/defaults, variability haircuts, and flexibility downstream use;
- filing-status/state propagation into projections (there is no behavior to assert today);
- healthcare expenses reducing balances.

Automated verification was attempted with:

```text
npm test -- --run src/lib/projections/__tests__/rmd.test.ts src/lib/projections/__tests__/engine.test.ts src/components/projections/__tests__/ProjectionChart.test.tsx src/hooks/__tests__/useProjectionExport.test.ts
```

It did not start because repository dependencies are absent: `sh: vitest: command not found`. Test coverage statements above are therefore based on reading assertions, not a fresh passing run.

## Historical context

- The original Epic 3 scope explicitly excluded detailed tax optimization and implemented only deterministic projections plus basic tax-bucket ordering (`thoughts/personal/tickets/epic-3/projection-modeling/story-1-scope.md:6-32`).
- The December engine plan deferred RMDs (`thoughts/shared/plans/2025-12-18-epic-3-story-1-projection-engine.md:1572-1587`).
- The February 11 research correctly described the then-current missing RMD and tax visualization (`thoughts/shared/research/2026-02-11-current-features-tax-awareness-model-recommendations.md`). It is now stale on those two points.
- Commit `8249bb5` on February 12 added aggregate RMD enforcement, tax-balance visualization, export fields, and related tests, following `thoughts/shared/plans/2026-02-12-tax-awareness-rmd-visualization.md`.
- That plan deliberately excluded liability calculation, conversions, state taxes, per-account RMDs, first-year deferral, and inherited-IRA rules. Current implementation matches that boundary.

## External benchmark: current U.S. rules and product best practices

The following benchmark uses primary government sources current as of 2026-07-22. It is not tax advice.

### Rules that expose current model gaps

- IRS guidance says RMDs generally begin at 73 today, while SECURE 2.0 changes the applicable age to 75 for the later cohort. RMDs are generally calculated for each account from its prior December 31 balance; employer plans can have a still-working exception, and a different joint-life table applies when the sole-beneficiary spouse is more than 10 years younger. Source: https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs and https://www.irs.gov/irb/2026-06_IRB.
- Up to 85% of Social Security benefits can be taxable depending on other income. Source: https://www.irs.gov/publications/p554.
- Tax brackets and standard deductions are tax-year and filing-status specific and are updated annually. Source: https://www.irs.gov/newsroom/inflation-adjusted-tax-items-by-tax-year and https://www.irs.gov/filing/federal-income-tax-rates-and-brackets.
- Taxable investment gains require basis and realization data; gross brokerage withdrawals are not equivalent to capital gains. Source: https://www.irs.gov/publications/p550.
- Traditional-to-Roth conversions generally include untaxed converted amounts in income, and QCDs can satisfy charitable/RMD objectives while being excluded under applicable rules. Source: https://www.irs.gov/publications/p590b and https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-iras.
- Medicare Part B and Part D premiums can rise with income, so MAGI-sensitive planning is material. Source: https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles.
- Marketplace premium assistance also depends on MAGI, which matters for pre-Medicare retirement scenarios. Source: https://www.healthcare.gov/income-and-household-information/income/.

### Recommended capability sequence

#### Priority 0: projection and RMD integrity

These should precede claims of tax optimization:

1. Include healthcare costs in withdrawal need and reserve constraints.
2. Run legal-distribution logic independently of the product's “retired” phase.
3. Keep excess RMD in household cash/taxable assets unless explicitly spent, gifted, withheld, or reinvested.
4. Derive RMD start age from birth cohort and represent owner/account/plan attributes needed for exceptions and table choice.
5. Preserve actual contribution destination and account identity instead of redistributing all contributions through a global default.
6. Either rename the current strategy to “tax-bucket withdrawal order” or clearly disclose that it does not estimate taxes.

#### Priority 1: versioned after-tax projection engine

Add a tax-domain boundary separate from the portfolio engine, with:

- tax-year/versioned federal rule data and source/effective-date metadata;
- complete filing-status support and household/spouse ownership;
- ordinary income, preferential capital gains/qualified dividends, deductions, and taxable Social Security;
- taxable-account basis/realization assumptions;
- gross-up logic so spending is funded **after** taxes, avoiding the current gross-withdrawal assumption;
- federal liability, marginal/effective rates, MAGI, after-tax cash flow, and transparent calculation breakdowns;
- explicit fallback behavior for years beyond enacted law rather than silently applying one year's rules forever.

#### Priority 2: planning strategies

Once liability calculations are trustworthy:

- bracket-aware withdrawal sequencing rather than one fixed order;
- manual and bracket-fill Roth conversion scenarios, including IRA basis/pro-rata effects and tax-payment source;
- RMD/QCD scenarios;
- capital-gain harvesting and tax-loss harvesting assumptions;
- Social Security claiming interactions;
- Medicare IRMAA two-year lookback and pre-65 ACA MAGI interactions;
- state retirement-income treatment and relocation scenarios;
- side-by-side lifetime tax, after-tax spending, ending estate, and risk comparisons.

#### Priority 3: governance, UX, and testing

- Show tax year, jurisdiction, assumptions, rule source, last-updated date, and known omissions in every result/export.
- Separate “estimate” from “recommendation,” retain the tax/legal disclaimer, and provide review prompts for CPA/adviser input.
- Make strategy controls user-authorized and reversible; do not silently select conversions or realizations.
- Store an immutable calculation/ruleset version with saved projections for reproducibility.
- Add golden fixtures from published IRS examples, boundary tests at every bracket/cliff, property-based invariants, and regression tests for rule updates.
- Test household ownership, spouse age, current-retiree, working-past-RMD-age, zero/negative basis, insufficient liquidity, and multi-account cases.

## Gap matrix

| Capability | Current status | Evidence / consequence | Suggested priority |
| --- | --- | --- | --- |
| Account tax buckets | Implemented, coarse | 6 types -> 3 categories; identity lost | P0 refine |
| Tax-balance visualization/export | Implemented | Chart and CSV/PDF show category balances/RMD | Maintain/test |
| Fixed withdrawal order | Implemented | Gross taxable -> deferred -> free | Rename/disclose, then P2 |
| Aggregate RMD | Partially implemented | Basic table/enforcement; cohort/account/cash-flow gaps | P0 |
| Healthcare funding | Defective | Shown as outflow, absent from withdrawal need | P0 |
| Filing status/state | Collected, unused | No engine consumer | P1/P2 |
| Income tax-flexibility metadata | Collected, mostly unused | Amount/variability used; flags ignored | P2 or remove ambiguity |
| Federal income tax | Missing | No brackets/deductions/liability | P1 |
| Taxable Social Security | Missing | All streams treated as gross cash | P1 |
| Capital gains/basis | Missing | Brokerage withdrawal treated as gross category draw | P1 |
| After-tax spending/gross-up | Missing | Expenses funded without tax cost | P1 |
| Roth conversions | Missing | No conversion transaction or tax effect | P2 |
| QCD/charitable strategy | Missing | No distribution destination/tax exclusion | P2 |
| IRMAA/ACA MAGI | Missing | Healthcare costs are age buckets only | P2 |
| State taxes | Missing | Residence stored only | P2 |
| Tax ruleset versioning/audit | Missing | Saved assumptions omit tax law/version | P1/P3 |

## Open questions

1. Is PlanSmart intended to remain an educational cash-flow planner or become a tax-estimation product? The accuracy, compliance, and maintenance burden differ materially.
2. What future-law convention should projections use: current-law extension, scheduled law, user-selectable policy, or an explicit “unknown beyond year X” boundary?
3. Should account ownership be individual/spouse/joint, and which employer-plan details are required for RMD and early-distribution rules?
4. Will users enter cost basis and tax attributes, or will the system use clearly labeled assumptions?
5. Should excess RMD default to taxable reinvestment, cash spending, withholding, gifting, or a user-selected split?
6. Are state calculations in scope for all jurisdictions, or should the first tax engine be federal-only with state shown as unsupported?
7. What level of review, disclaimer, and rules-update process is required before presenting “optimization” recommendations?

## Inferences

- **Inference:** The February 12 feature was designed as a visibility/RMD increment rather than a comprehensive tax model. This is supported by its plan's explicit exclusions and the current narrow data contracts.
- **Inference:** Correcting RMD/healthcare cash-flow handling will change balances and could invalidate saved projections, so a calculation-version migration or stale-result invalidation mechanism will likely be needed before implementation.
- **Inference:** Building Roth conversion optimization before an after-tax/MAGI engine would produce misleading results, because conversion value depends on bracket, Social Security, Medicare/ACA, state, basis, and tax-payment interactions.
