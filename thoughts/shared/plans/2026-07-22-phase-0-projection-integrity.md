---
date: 2026-07-22
author: Codex
status: implemented-awaiting-rollout-verification
repository: plan-smart
base_commit: 9b48efb
related_research: thoughts/shared/research/2026-07-22-tax-planning-features-gap-analysis.md
---

# Phase 0 Projection Integrity Implementation Plan

## Overview

Phase 0 makes PlanSmart's existing retirement projection internally consistent before federal tax calculation or Roth conversion recommendations are introduced. It corrects retirement cash flow, cohort-based RMD timing, RMD surplus retention, already-retired API behavior, and contribution routing. It also gives saved projections an explicit calculation version so results produced by the corrected engine cannot be confused with legacy output.

The implementation is intentionally backward-compatible at the TypeScript/JSON boundary: old saved inputs and direct engine fixtures remain readable, but normal application paths generate the new fields and version-2 projections. Existing saved version-1 projections are lazily recalculated through normal authenticated product flows.

## Current State

### Retirement cash flow

- `runProjection()` calculates essential, discretionary, and healthcare expenses, but passes only essential and discretionary amounts into `calculateReserveConstrainedSpending()` (`src/lib/projections/engine.ts:414-468`). Healthcare appears in `outflows` but does not increase portfolio withdrawals (`src/lib/projections/engine.ts:480-487`).
- Retirement income is applied only against essential spending. Discretionary spending is always assigned to the portfolio even when income exceeds essential expenses (`src/lib/projections/engine.ts:267-342`).
- Reserve protection prioritizes essential over discretionary spending, but has no explicit healthcare component.

### RMD behavior

- The RMD table and calculation live in `src/lib/projections/rmd.ts:3-104`; the default start age is fixed at 73.
- RMD calculation is inside the retired branch, so users modeled as working past RMD age receive no RMD until retirement (`src/lib/projections/engine.ts:394-452`).
- When an RMD exceeds portfolio spending need, the full distribution leaves tax-deferred assets but the surplus is not added to cash or taxable assets (`src/lib/projections/engine.ts:463-487`).
- `RMDTracking` records required, taken, and excess deferred withdrawal, but not the amount retained/reinvested (`src/lib/projections/types.ts:174-196`).
- The warning is hard-coded to ages 70-72 and age 73 (`src/lib/projections/warnings.ts:65-76`).

### Contribution behavior

- Individual account contributions are summed into `annualContribution` and redistributed using a global `contributionAllocation`, normally the 60/30/10 default (`src/lib/projections/input-builder.ts:71-88,168-188`; `src/lib/projections/assumptions.ts:28-35`).
- `addContributions()` applies only the global percentages (`src/lib/projections/engine.ts:149-162`). A Roth IRA contribution entered by a user can therefore be projected into tax-deferred and taxable balances.

### Input construction and API behavior

- `buildProjectionInputFromSnapshot()` is the intended shared transformer (`src/lib/projections/input-builder.ts:63-189`). It is used by comparison, insights, and staleness APIs.
- The calculate route, dashboard, and plans page independently rebuild projection input (`src/app/api/projections/calculate/route.ts:176-281`; `src/app/dashboard/page.tsx:171-262`; `src/app/plans/page.tsx:152-303`). These copies already differ on explicit zero expenses, income variability, income-stream migration, spending phases, and depletion reserves.
- `validateAgeRelationships()` rejects `currentAge >= retirementAge`, although `runProjection()` explicitly supports already-retired inputs (`src/app/api/projections/calculate/route.ts:55-79,283-295`; `src/lib/projections/engine.ts:366-369,508-511`).

### Persistence, staleness, and AI cache

- `projection_results` stores JSON inputs, assumptions, records, and summary, but has no engine/calculation version (`src/db/schema/projection-results.ts:11-36`).
- `saveProjectionResult()` upserts one row per plan (`src/db/secure-query.ts:74-117`).
- The dashboard trusts any saved row and recalculates only if none exists (`src/app/dashboard/page.tsx:148-169`). The plans page always recalculates for display but does not save the server recalculation (`src/app/plans/page.tsx:149-199,281-353`).
- `checkProjectionStaleness()` compares many inputs but omits essential/discretionary expenses, reserve/depletion inputs, RMD configuration, contribution dollars by category, and engine version (`src/lib/projections/staleness.ts:13-88`).
- The staleness endpoint rebuilds with empty overrides, which can falsely mark user-customized saved assumptions as stale (`src/app/api/projections/[planId]/staleness/route.ts:39-54`).
- AI summaries are cached by projection row ID and a hash of inputs. An engine-only change with identical inputs can reuse an old narrative (`src/app/api/ai/plan-summary/route.ts:44-68`; `src/lib/ai/hash-inputs.ts:1-11`).

## Desired End State

After Phase 0:

1. Retirement withdrawals fund essential, healthcare, and discretionary expenses after all active income is applied.
2. Healthcare is treated as protected spending for reserve purposes and reported separately in each retirement record.
3. RMD applicability is derived from birth cohort and evaluated every projection year, not only after the modeled retirement date.
4. RMD amounts not needed for spending remain in the household's taxable balance and are visible in records, tooltips, and exports.
5. Generated projections preserve the tax category of each account's actual contribution. Legacy direct engine inputs still fall back to percentage allocation.
6. The calculate API accepts already-retired users while still rejecting invalid projection horizons.
7. All snapshot-to-projection production paths use the shared input builder.
8. Saved results include a first-class calculation version. Version-1 or input-stale results are recalculated before the dashboard, plan, or AI summary treats them as current.
9. Tests cover the corrected formulas, boundary cohorts, current retirees, version staleness, and all affected integrations.

## Key Discoveries

- Phase 0 changes balances even when user inputs do not change. Input-only staleness is therefore insufficient; engine version must be part of freshness.
- A top-level `calculation_version` column matches existing top-level projection metadata (`calculation_time_ms`, timestamps) and is queryable without reading large JSON blobs.
- Existing saved projections use a one-row-per-plan upsert, allowing lazy replacement without a bulk record migration.
- The shared builder already handles more product features than the dashboard's duplicate path, including spending phases and depletion reserves. Consolidation is necessary for correctness, not merely cleanup.
- Full legal RMD accuracy needs account owner, plan type, current-employer status, and beneficiary data that the product does not collect. Phase 0 will improve cohort timing and cash flow while retaining the existing aggregate tax-deferred approximation.
- Existing public request validation exposes contribution-allocation overrides. These remain supported as an explicit scenario override; absent an override, actual per-account contribution destinations win.
- The calculate route also exposes legacy `socialSecurityAge` and `socialSecurityMonthly` overrides that the shared builder does not currently accept. Consolidation must preserve those request semantics.
- The calculate route extracts `planId` outside its Zod schema and passes it to an upsert without first proving plan ownership. Phase 0 persistence changes must close this authorization gap before adding more automatic writes.
- The standalone projection save route accepts caller-supplied results and therefore cannot truthfully stamp them as version 2 unless it recomputes them server-side.

## What We Are Not Doing

- Federal or state income-tax calculation
- Roth conversion transactions or recommendations
- Taxable Social Security, capital-gains basis, IRMAA, or ACA modeling
- Per-account/per-owner RMD calculation, still-working employer-plan exceptions, joint-life tables, inherited accounts, first-year deferral, QCDs, tax withholding, or gifting choices
- A new account taxonomy or onboarding redesign
- A new investment-return model for taxable cash created by surplus RMDs; it will use the existing taxable bucket and return assumption
- Historical back-simulation of pre-2023 RMD law; projections start at the user's current age, and older cohorts are already beyond their required beginning age
- Removal of legacy `annualContribution` or `contributionAllocation` fields; they remain as compatibility and explicit-override mechanisms
- Broad chart/table redesign

## Relationship to Roth Conversion Recommendations

Phase 0 is the integrity foundation for a combined tax-planning and Roth-conversion feature, not the conversion recommender itself. The later recommender should consume only fresh version-2-or-newer projections and reuse the canonical input builder. In particular, Phase 0 makes conversion analysis trustworthy by preserving account tax categories, modeling cohort RMD timing, retaining deferred-distribution surplus in taxable assets, and exposing calculation-version provenance.

The follow-on conversion phase will still need tax-year-specific ordinary-income brackets, filing status, Social Security taxation, Medicare IRMAA, ACA interactions where applicable, conversion transaction semantics, multi-year optimization, and recommendation explanations. Those should be layered onto the corrected engine rather than mixed into this repair phase.

## Implementation Approach

### Locked decisions

1. **Calculation version:** add `projection_results.calculation_version`, backfill/default legacy rows to `1`, and define `CURRENT_PROJECTION_CALCULATION_VERSION = 2` in `src/lib/projections/version.ts`. Only server-executed version-2 calculations may write version 2.
2. **RMD cohort rule:** add a pure `getRmdStartAge(birthYear)` helper. Use 72 for birth years through 1950, 73 for 1951-1959, and 75 for 1960 onward. For generated inputs, set `rmdConfig.startAge` from this helper. Existing explicit `rmdConfig.startAge` remains an override for tests/scenarios.
3. **Interim RMD scope:** apply the cohort rule to the aggregate `taxDeferred` bucket every year once applicable. Add a user warning when retirement is later than RMD age explaining that current-employer exceptions are not modeled.
4. **RMD surplus:** `max(0, rmdTaken - portfolioSpendingNeed)` is transferred to the taxable bucket before returns. It is an internal asset transfer, not an income-stream inflow or spending outflow.
5. **Healthcare priority:** treat healthcare and essential spending as one protected tier for reserve constraints. Apply retirement income to protected spending first and then discretionary spending. If protected spending itself must be reduced, allocate actual protected spending proportionally between essential and healthcare so record totals reconcile.
6. **Contribution routing:** add optional `annualContributionsByType` to `ProjectionInput`. Shared builders always populate it. The engine grows each category and proportionally scales the categories when debt payments reduce effective contributions. If absent, use the legacy total-plus-allocation calculation.
7. **Saved-result refresh:** freshness is the union of calculation-version equality and complete outcome-affecting input equality. Preserve saved user assumptions while rebuilding snapshot-derived inputs.
8. **No client-trusted version:** the standalone save endpoint must either recompute using the server engine or write legacy version 1. Phase 0 will choose the smaller safe change: continue accepting its existing payload but persist `calculationVersion: 1`, ensuring those results are never treated as current by version-2 consumers. Add a deprecation comment and no new callers.
9. **Saved override provenance:** add one pure resolver for stored overrides. It returns `assumptions.overrides` for new rows, reconstructs the six historically persisted fields for legacy rows, and returns an empty object when no saved row exists. Every freshness/recalculation consumer must use this resolver.
10. **Partial plan updates:** when a validated calculate request includes a `planId`, merge its explicitly supplied overrides over that plan's stored overrides before rebuilding and saving. Requests without a `planId` continue to use only request overrides. This prevents the three-field Plans UI from erasing hidden healthcare, contribution-growth, income-stream, or legacy Social Security choices.
11. **Income fallback rules:** when detailed working-income sources exist, derive fallback expenses from their variability-adjusted total. Estimate Social Security from the unadjusted total of earned-income source types (`w2_employment`, `self_employed`, `business_owner`, and `contract_1099`), excluding rental and investment income. When structured sources are absent, retain the legacy `annualIncome` fallback.
12. **Persistence authorization:** validate `planId` as a UUID, verify it belongs to the authenticated user before reading stored overrides or saving, and ownership-scope the projection upsert conflict update as defense in depth.

## Phase 1: Versioned contracts and canonical input construction

### Files and changes

#### `src/lib/projections/version.ts` (new)

- Export `LEGACY_PROJECTION_CALCULATION_VERSION = 1`.
- Export `CURRENT_PROJECTION_CALCULATION_VERSION = 2`.
- Keep this module dependency-free so schema, API, staleness, and AI code can import it safely.

#### `src/lib/projections/index.ts`

- Re-export calculation-version constants.

#### `src/lib/projections/types.ts`

- Add optional `birthYear` to `ProjectionInput`; generated inputs must set it, while direct legacy fixtures may omit it.
- Add optional `annualContributionsByType: BalanceByType`; document precedence over percentage allocation.
- Move `ProjectionOverrides` from `input-builder.ts` into this shared type module so validated overrides can be persisted without a reverse dependency.
- Include the existing legacy `socialSecurityAge` and `socialSecurityMonthly` request fields in `ProjectionOverrides`; remove the unused duplicate `ProjectionRequest` interface so request/domain types cannot drift independently.
- Add an input-facing income-stream override type where `isGuaranteed` and `isSpouse` are optional, matching the existing Zod request and legacy JSON. Keep normalized `ProjectionInput.incomeStreams` as `IncomeStream[]` with `isGuaranteed` required after builder migration.
- Extend `ProjectionAssumptions` with optional `overrides: ProjectionOverrides`. New saves must store the exact validated overrides; legacy rows fall back to the six existing assumption fields.
- Add optional `healthcareExpenses` and `actualHealthcareSpending` to `ProjectionRecord` for persisted JSON compatibility.
- Add optional `surplusReinvested` to `RMDTracking`.
- Add optional `totalRmdSurplusReinvested` to `ProjectionSummary`.
- Retain the existing `annualContribution`, `contributionAllocation`, and RMD fields.

#### `src/db/schema/projection-results.ts`

- Add `calculationVersion: integer('calculation_version').notNull().default(1)` next to `calculationTimeMs`.

#### `src/db/migrations/0011_*.sql` and `src/db/migrations/meta/*`

- Generate an additive Drizzle migration.
- Add `calculation_version` with default `1` and `NOT NULL`; existing rows become legacy version 1.
- Do not backfill existing rows to version 2.

#### `src/db/secure-query.ts`

- Require `calculationVersion` in `saveProjectionResult()` data.
- Write it on both insert and conflict update.
- Ownership-scope the `plan_id` conflict update to the authenticated `userId`; a conflicting row owned by another user must never be updated or returned.
- Ensure every caller explicitly chooses current or legacy version.

#### `src/lib/projections/staleness.ts`

- Extend staleness checking to accept stored/current calculation versions.
- Report `calculationVersion` in `changedFields` and `changes` on mismatch.
- Add every engine-affecting field currently omitted: `birthYear`, essential/discretionary expenses, `annualContributionsByType`, `reserveFloor`, `rmdConfig`, and enabled depletion/reserve configuration.
- Normalize absent optional fields in legacy JSON safely.
- Add a pure `shouldRecalculateProjection()` helper that returns true when the row is missing, the version differs, or inputs differ. Pages and APIs must share this decision logic.

#### `src/lib/projections/rmd.ts`

- Add and export `getRmdStartAge(birthYear)` with the locked cohort rules.
- Keep `calculateRMD()` focused on divisor lookup and balance math.
- Keep `DEFAULT_RMD_CONFIG` as the legacy/direct-call fallback; generated application input must provide cohort-derived configuration.

#### `src/lib/projections/input-builder.ts`

- Make this the canonical snapshot transformer.
- Set `birthYear` and cohort-derived `rmdConfig` on every generated input.
- Aggregate both balances and monthly contributions by `ACCOUNT_TAX_CATEGORY`.
- When no explicit `contributionAllocation` override is supplied:
  - populate `annualContributionsByType` from the actual accounts;
  - derive the compatibility `contributionAllocation` percentages from those dollars, using `DEFAULT_CONTRIBUTION_ALLOCATION` only when total contribution is zero.
- When an explicit allocation override is supplied, distribute total contribution into `annualContributionsByType` using that override.
- Add and export a pure `collectProjectionInputWarnings(snapshot)` helper for unknown account types so the calculate route can retain its existing warning behavior while using the shared builder.
- Move the calculate route's income-source variability helper into the builder and implement the locked expense and Social Security income-source rules above.
- Preserve `socialSecurityAge` and `socialSecurityMonthly` when auto-generating a Social Security stream; explicit `incomeStreams` continue to take precedence.
- Preserve explicit zero expense values by using null checks, not truthiness checks.
- Preserve the existing income-stream migration for `isGuaranteed` and `isSpouse`.
- Continue calculating spending phases, depletion target, and reserve floor here.

#### `src/lib/projections/saved-overrides.ts` (new)

- Add `getStoredProjectionOverrides(assumptions)` as the only conversion from persisted assumptions to `ProjectionOverrides`.
- Add `buildProjectionAssumptions(input, resolvedOverrides)` as the single constructor for the six human-readable fields plus exact override provenance on every version-2 save.
- Prefer the exact optional `assumptions.overrides` object for new rows.
- For legacy rows, reconstruct only `expectedReturn`, `inflationRate`, `healthcareInflationRate`, `contributionGrowthRate`, `retirementAge`, and `maxAge`; snapshot-owned inputs must continue to come from the current financial snapshot.
- Return an empty override object when assumptions are absent.
- Re-export both helpers from `src/lib/projections/index.ts` so pages and API routes do not duplicate fallback or persistence logic.

#### `src/lib/projections/__tests__/input-builder.test.ts` (new)

- Build typed financial-snapshot fixtures and verify:
  - balance aggregation;
  - contribution dollars remain in their source account tax category;
  - explicit allocation override behavior;
  - zero-contribution fallback;
  - debt/expense derivation and explicit zero expenses;
  - variability-adjusted expense fallback;
  - earned-income-only Social Security estimation and the unstructured-income fallback;
  - legacy Social Security age/monthly overrides and explicit-income-stream precedence;
  - unknown account classification plus warning collection;
  - income-stream migration;
  - cohort-derived RMD configuration for 1950, 1951, 1959, and 1960 birth years;
  - spending/depletion/reserve propagation.

#### `src/lib/projections/__tests__/staleness.test.ts`

- Add tests for version mismatch, identical version-2 results, all newly compared fields, legacy optional fields, and `shouldRecalculateProjection()`.

#### `src/lib/projections/__tests__/saved-overrides.test.ts` (new)

- Verify exact new-row overrides win, the six-field legacy fallback is deterministic, snapshot-derived fields are not invented, explicit zero values survive, and missing assumptions return no overrides.
- Verify `buildProjectionAssumptions()` records the effective human-readable fields and exact resolved overrides without adding snapshot-derived values.

#### `src/lib/validation/projections.ts` and `src/lib/validation/__tests__/projections.test.ts`

- Add a POST request schema that combines the existing projection overrides with optional UUID `planId`; do not destructure an unvalidated identifier from the raw body.
- Retain all existing override bounds and add valid/invalid `planId` cases.

### Automated verification

- Run `npm run db:generate` and inspect the generated additive SQL and schema snapshot.
- Run `npm test -- --run src/lib/projections/__tests__/input-builder.test.ts src/lib/projections/__tests__/rmd.test.ts`.
- Run `npm test -- --run src/lib/projections/__tests__/staleness.test.ts src/lib/projections/__tests__/saved-overrides.test.ts`.
- Run `npm run typecheck` after contract changes.

### Manual verification

- Use representative snapshots containing one 401(k), Roth IRA, brokerage account, and cash account. Confirm generated starting balances and annual contributions reconcile to the raw account totals.
- Confirm a user born in 1960 receives an RMD start age of 75 while a user born in 1959 receives 73.
- Inspect an existing projection row after migration and confirm it is version 1.

## Phase 2: Correct annual cash flow, contributions, and RMD transfers

### Files and changes

#### `src/lib/projections/engine.ts`

- Refactor `addContributions()` to accept resolved annual contribution dollars by category.
- Add a resolver that:
  - grows `annualContributionsByType` by `contributionGrowthRate` when present;
  - otherwise grows and allocates the legacy `annualContribution`;
  - subtracts annual debt payments from the total;
  - scales category contributions proportionally after the debt reduction;
  - never produces negative category contributions.
- Refactor `calculateReserveConstrainedSpending()` to accept essential, healthcare, discretionary, and total income separately.
- Compute portfolio need as `max(0, all planned expenses - total income)` while preserving the protected-first reserve policy.
- Return enough detail to reconcile actual essential, healthcare, and discretionary spending and the total shortfall.
- Move annual RMD applicability/calculation outside the retired-only branch so it runs for applicable ages in both accumulation and retirement years.
- Continue using the preceding record's tax-deferred ending balance as the next year's RMD base; use the opening input balance as the first projected year's proxy.
- For accumulation years subject to RMD, use zero spending need, take the RMD, and transfer the full amount to taxable assets.
- For retirement years, calculate `surplusReinvested` from the portion of RMD not used for portfolio-funded spending.
- Apply balance operations in this explicit order:
  1. resolve/add working-year contributions, if applicable;
  2. determine required distribution and spending withdrawal;
  3. subtract gross withdrawals from source buckets;
  4. add RMD surplus to taxable assets;
  5. apply returns to remaining household assets.
- Keep `withdrawalsByType` and `totalWithdrawals` as gross account distributions; separately accumulate `totalRmdSurplusReinvested` so the summary explains why gross withdrawals do not equal net asset reduction.
- Populate `healthcareExpenses`, `actualHealthcareSpending`, and RMD surplus fields on records.
- Ensure reserve tracking is based on total household assets after the RMD internal transfer; legal RMD transfer alone must not breach the reserve floor.

#### `src/lib/projections/__tests__/engine.test.ts`

- Update existing balance expectations affected by healthcare funding.
- Add focused tests for:
  - healthcare increasing withdrawals and lowering ending balance;
  - income covering protected and then discretionary spending;
  - protected spending/reserve reconciliation and healthcare shortfall reporting;
  - actual contribution dollars by category;
  - proportional debt reduction across contribution categories;
  - legacy contribution-allocation fallback;
  - age-73 RMD while retirement age is later than 73;
  - age-75 cohort behavior;
  - excess RMD transferred to taxable rather than disappearing;
  - RMD partially used for spending with only the remainder transferred;
  - insufficient tax-deferred balance and withdrawal shortfall;
  - gross withdrawal and reinvested-surplus summary reconciliation.

#### `src/lib/projections/__tests__/engine-reserve.test.ts`

- Update reserve tests so healthcare is protected spending.
- Add cases where reserve constraints reduce discretionary spending first, then proportionally reduce essential and healthcare spending.
- Assert an RMD transfer between buckets does not reduce total assets or falsely trigger a reserve breach.

#### `src/lib/projections/__tests__/rmd.test.ts`

- Add cohort-start-age boundary tests.
- Retain divisor-table and direct calculation tests.

### Automated verification

- Run `npm test -- --run src/lib/projections/__tests__/engine.test.ts src/lib/projections/__tests__/engine-reserve.test.ts src/lib/projections/__tests__/rmd.test.ts`.
- Run all projection-library tests because sensitivity, spending comparisons, income floor, depletion feedback, warnings, and staleness consume the same engine contracts: `npm test -- --run src/lib/projections`.
- Run `npm run typecheck`.

### Manual verification

- Compare one no-income retiree projection with healthcare set to zero and nonzero; verify the difference appears in both withdrawals and ending balance.
- Model retirement at 76 for birth years 1959 and 1960. Verify RMD begins at 73 and 75 respectively, before retirement, and surplus moves to taxable assets.
- Model an RMD larger than spending need and verify total household balance changes only for spending and returns, not the internal deferred-to-taxable transfer.

## Phase 3: Consolidate production paths and support current retirees

### Files and changes

#### `src/app/api/projections/calculate/route.ts`

- Replace duplicated snapshot transformation with `buildProjectionInputFromSnapshot(snapshot, validatedOverrides)`.
- Parse the complete POST body, including optional UUID `planId`, with the combined request schema.
- When `planId` is present, verify ownership, load the saved row, resolve its stored overrides, merge the request's defined fields over them, and pass that resolved override set to the builder. Return 404 without calculating or writing when the plan is not owned by the user.
- Retain route-specific authentication, validation, warnings from `collectProjectionInputWarnings()`, timing, depletion feedback, response formatting, and optional persistence.
- Change age validation to allow `retirementAge <= currentAge` and reject only invalid horizons:
  - `maxAge <= currentAge`;
  - `retirementAge >= maxAge`;
  - values already rejected by the request schema.
- Stamp persisted results with `CURRENT_PROJECTION_CALCULATION_VERSION`.
- Store the exact resolved override object in `ProjectionAssumptions.overrides` along with the existing human-readable assumption fields.
- Echo cohort-derived RMD configuration and calculation version in the response metadata for diagnosis.

#### `src/app/plans/page.tsx`

- Replace manual input construction with the shared builder.
- Rebuild input with `getStoredProjectionOverrides(savedProjection?.assumptions)`; do not reconstruct overrides inside the page.
- Compare the freshly built input and version with the saved row.
- Recalculate as today; upsert the result only when the row is absent, stale, or on a legacy calculation version. The upsert must use `buildProjectionAssumptions()` with the resolved overrides and stamp the current calculation version.
- Pass the current calculation version to `PlansClient` so exports can identify the calculation contract that produced the displayed result.
- Generate projection warnings for the initial server calculation and pass them to `PlansClient`.

#### `src/app/dashboard/page.tsx`

- Replace the large fallback builder with the shared builder.
- Do not trust a saved row merely because it exists.
- Build current input using `getStoredProjectionOverrides()`, run version/input staleness, and lazily recalculate/upsert when absent or stale.
- Build version-2 persisted assumptions with `buildProjectionAssumptions()` so a dashboard-triggered refresh preserves the same override provenance as Plans and the calculate API.
- Use only the fresh result for status, projected balance, depletion age, and AI projection ID.

#### `src/app/api/projections/compare/route.ts` and `src/app/api/insights/analyze/route.ts`

- Verify their existing shared-builder use compiles with new fields; no duplicate calculations should be added.

#### `src/app/api/projections/save/route.ts`

- Keep the existing endpoint contract for compatibility, but persist caller-supplied results as `LEGACY_PROJECTION_CALCULATION_VERSION`.
- Add a deprecation comment explaining that current-version results must be produced through `/api/projections/calculate`.

#### `src/lib/projections/warnings.ts`

- Replace the fixed 70-72 check with a warning window derived from `rmdConfig.startAge`.
- Add an informational warning when `retirementAge` is later than RMD age, explaining the aggregate model does not represent current-employer-plan exceptions.

#### `src/app/api/projections/calculate/route.test.ts`

- Refactor the database mock so it can return a real financial-snapshot fixture; the current mock always returns an empty array.
- Add integration cases for:
  - an already-retired user receiving a successful projection;
  - invalid `maxAge <= currentAge`;
  - shared-builder contribution routing;
  - cohort RMD configuration in the response;
  - current calculation version on saved results;
  - invalid `planId` rejection and unowned-plan 404 behavior;
  - merging a partial request over stored overrides without erasing unspecified fields;
  - retained unknown-account warnings and legacy Social Security overrides.
- Retain authentication and validation cases.

#### `src/app/plans/plans-client.tsx` and `src/app/plans/plans-client.test.tsx` (new)

- Accept `initialInputWarnings`, initialize warning state from it, and restore those warnings when assumptions return to the initial saved state instead of clearing them.
- Continue replacing them with calculate-response warnings after an interactive recalculation.
- Add or extend a focused client test to verify initial warning display, reset behavior, and replacement after recalculation.

#### Page/API tests

- Add the narrowest feasible server-page/helper tests for legacy saved-row refresh and initial warning propagation. Test pure freshness and override-resolution helpers directly rather than adding a new server-component rendering framework solely for this work.

### Automated verification

- Run `npm test -- --run src/app/api/projections/calculate/route.test.ts src/lib/projections/__tests__/warnings.test.ts src/lib/projections/__tests__/staleness.test.ts`.
- Run `npm run typecheck` and `npm run lint`.
- Run the full Vitest suite because dashboard/plans/API now share the builder: `npm test -- --run`.

### Manual verification

- Sign in as an already-retired fixture/user and verify GET/POST projection calculation succeeds.
- Open dashboard and plans for a user with a saved legacy result; verify one version-2 upsert occurs and both surfaces show the same summary.
- Change an assumption in Plans, refresh dashboard, and verify the saved customization is preserved rather than reset to defaults.

## Phase 4: Complete stale-result consumers, AI cache, and user-visible output

### Files and changes

#### `src/app/api/projections/[planId]/staleness/route.ts`

- Include version comparison.
- Rebuild current inputs with `getStoredProjectionOverrides()` rather than empty overrides.
- Return stored/current calculation versions with the existing staleness payload.

#### `src/app/api/projections/[planId]/route.ts`

- Load the current snapshot, rebuild inputs with `getStoredProjectionOverrides()`, and return the existing `projectionResult` plus explicit `isStale`, `changedFields`, `storedCalculationVersion`, and `currentCalculationVersion` fields.
- Do not recalculate on this GET endpoint and do not silently label a version-1 row current.

#### `src/lib/ai/hash-inputs.ts` and `src/app/api/ai/plan-summary/route.ts`

- Change `hashProjectionInputs()` to accept calculation version and include it in cache-key material.
- Replace the current top-level-key JSON replacer with deterministic deep canonicalization so nested balance, contribution, RMD, income-stream, spending-phase, depletion, and reserve changes alter the hash.
- Before cache lookup or generation, load the current snapshot, rebuild inputs with `getStoredProjectionOverrides()`, and run the shared freshness check.
- Return HTTP 409 with a recalculation-required message when the projection is stale or legacy. Dashboard/Plans will perform the authenticated recalculation; this AI endpoint will not mutate projection state.
- Preserve the existing hash-prefix display as a result fingerprint, and expose calculation version separately instead of labeling the hash as an engine version.

#### `src/components/projections/ProjectionChart.tsx`

- Add `surplusReinvested` to the existing RMD tooltip when it is positive, labeled as moved to taxable assets.
- Display healthcare in the retirement spending tooltip when `healthcareExpenses` is present.

#### `src/app/plans/plans-client.tsx` and `src/hooks/useProjectionExport.ts`

- Add calculation version to `PlansClientProps` and `ExportData`, and pass it from the version-checked server page into the export panel.
- Add healthcare expense and RMD surplus reinvested columns plus calculation-version metadata to CSV and PDF output.
- Keep legacy optional fields readable by exporting zero/blank values when absent.

#### `src/components/projections/__tests__/ProjectionChart.test.tsx` and `src/hooks/__tests__/useProjectionExport.test.ts`

- Add assertions for healthcare and RMD-surplus labels/content.
- Assert exported tax/RMD columns contain the corrected values, not only that a download/table was triggered.

#### `src/db/__tests__/secure-query.test.ts` (new)

- Verify calculation version is included on insert and update and that a `planId` conflict owned by another user cannot update or return the existing row.

#### `src/app/api/projections/save/route.test.ts` (new)

- Verify authentication/ownership remains enforced and caller-supplied save payloads are persisted as version 1.

#### `src/lib/ai/__tests__/hash-inputs.test.ts` (new)

- Verify identical canonical inputs hash consistently regardless of object key insertion order.
- Verify hashes differ for calculation-version changes and changes inside nested balance, contribution, RMD, income-stream, spending-phase, depletion, and reserve data.

#### `src/app/api/projections/[planId]/route.test.ts`, `src/app/api/projections/[planId]/staleness/route.test.ts`, and `src/app/api/ai/plan-summary/route.test.ts` (new)

- Test authentication and ownership boundaries.
- Test fresh version-2, stale-input version-2, and legacy version-1 rows.
- Verify saved-result GET reports but does not mutate stale data.
- Verify AI summary returns 409 before cache lookup/generation for stale data and separates versioned cache metadata for fresh data.

### Automated verification

- Apply the migration to the local/test database with `npm run db:migrate`.
- Run `npm test -- --run src/lib/projections/__tests__/staleness.test.ts src/db/__tests__/secure-query.test.ts src/app/api/projections src/app/api/ai/plan-summary/route.test.ts src/lib/ai/__tests__/hash-inputs.test.ts src/components/projections/__tests__/ProjectionChart.test.tsx src/hooks/__tests__/useProjectionExport.test.ts`.
- Run `npm run typecheck`, `npm run lint`, and `npm run build`.

### Manual verification

- Inspect an existing projection row after migration and confirm it is version 1.
- Load dashboard/plans and confirm it is replaced by a version-2 result.
- Confirm a new AI summary is generated for version 2 rather than reusing the version-1 cached narrative.
- Confirm repeated page loads do not recalculate or upsert once version and inputs are fresh.

## Risks and rollback considerations

### Result changes

- Funding healthcare and retaining RMD surplus will materially change projected balances. Changes must be presented as a calculation correction and covered by deterministic regression cases.
- Sensitivity, spending-comparison, depletion-feedback, and AI output may change even without direct edits because they consume `runProjection()`.

### RMD approximation

- Applying RMD to the aggregate deferred bucket before retirement may overstate distributions for assets in a current employer plan. Mitigate with the planned warning and keep account-level exceptions explicitly deferred to the later account-aware RMD phase.
- Moving surplus to `taxable` assumes the money remains invested under the existing taxable-bucket return. The record must label this as reinvested surplus, not tax-free cash or tax liability.

### Version rollout

- Deploy the additive migration before code that selects or writes `calculation_version`.
- Existing rows must remain version 1. Defaulting them to 2 would falsely mark legacy calculations current.
- Old application instances do not update the new column and could overwrite version-2 JSON while leaving the version at 2. Minimize the mixed-version window, drain old instances before enabling version-2 writes, and monitor upserts during rollout.
- Lazy refresh can create a calculation burst on first access. The unique plan row/upsert prevents duplicate rows but not redundant concurrent work; monitor calculation latency and database writes.

### Rollback

- The schema change is additive, so rollback should leave the column in place rather than dropping it.
- Rollback code will ignore version-2 fields and can read the existing JSON shape because additions are optional.
- If corrected code is rolled back, disable version-2 promotion and treat newly written results as legacy until the corrected engine returns. Do not relabel version-2 rows as version 1 without an explicit product decision.
- AI summaries created under version 2 may remain stored; version-aware hashing prevents them from colliding with version-1 summaries.

### Compatibility and test churn

- Optional contract fields avoid forcing immediate edits to every direct engine fixture. New production builder tests ensure application paths always populate them.
- Existing tests with exact balance expectations may fail because they previously omitted healthcare from withdrawals. Update expected outcomes only after verifying the corrected formula, not by blindly accepting snapshots.

## Completion Criteria

Phase 0 is complete when all of the following are true:

- [x] Healthcare expenses reduce balances and participate in reserve constraints.
- [x] All retirement income is applied against total spending in protected-first order.
- [x] Actual account contribution destinations are preserved in generated projections.
- [x] RMD start age is cohort-derived and RMDs run even before modeled retirement.
- [x] Excess RMD remains in taxable household assets and is visible in records/exports.
- [x] Already-retired users can calculate projections through the public API.
- [x] Calculate, plans, and dashboard use the shared input builder and produce equivalent inputs for equivalent overrides.
- [x] `projection_results` stores calculation version 1 or 2 with safe legacy backfill.
- [x] Dashboard, plans, staleness API, saved-result API, and AI summary path do not treat version-1 output as current.
- [x] Saved user assumptions survive stale-result refresh.
- [ ] Targeted, full projection, full Vitest, typecheck, lint, migration, and production build checks pass.
- [ ] Manual scenarios for current retirees, birth-year boundaries, healthcare funding, RMD surplus, stale refresh, and AI cache separation are verified.

## Verification Summary

**Overall readiness:** Ready for implementation.

### Findings resolved during verification

- **Critical — projection write authorization:** the calculate POST accepted an unvalidated `planId`, and the projection upsert conflict path was not explicitly ownership-scoped. The plan now requires UUID validation, plan ownership verification before merge/save, defense-in-depth conflict scoping, and authorization tests.
- **Major — phase dependency:** calculation-version schema and persistence work originally occurred after consumers needed it. It now lands in Phase 1, before any version-2 writer or freshness consumer.
- **Major — override provenance:** several consumers could independently reconstruct saved assumptions and diverge. The plan now requires one tested `getStoredProjectionOverrides()` helper.
- **Major — partial override loss:** Plans sends only its three visible assumptions, which could erase previously saved healthcare, contribution-growth, income-stream, or legacy Social Security overrides. Plan-scoped calculations now merge defined request fields over stored overrides and persist the resolved set.
- **Major — builder consolidation regressions:** the shared builder did not preserve the calculate route's legacy Social Security overrides or unknown-account warnings. Both behaviors and their tests are now explicit.
- **Major — initial warning visibility:** Plans cleared warnings whenever assumptions matched initial state, so the new current-employer RMD limitation could remain invisible. The plan now propagates and restores initial server warnings.
- **Major — AI cache correctness:** the current hash strategy is not deeply canonical for nested input data. The plan now requires deterministic deep canonicalization plus nested-change tests and calculation-version input.
- **Major — stale AI behavior:** AI summaries now have an explicit non-mutating HTTP 409 contract for stale or legacy projections, avoiding narratives over obsolete results.
- **Minor — request/domain type drift:** the unused `ProjectionRequest` interface and required `IncomeStream.isGuaranteed` did not match the actual Zod request contract. The plan now removes the duplicate request interface and distinguishes input-facing stream overrides from normalized engine streams.
- **Minor — test specificity:** generic database/API test language has been replaced with concrete new test files and required cases.
- **Minor — export provenance:** calculation version could not reach the existing client export contract. The plan now explicitly threads it from the version-checked Plans page through `PlansClient` and `ExportData`.

### Missing work

No material implementation step remains unspecified for Phase 0. Tax calculation and Roth-conversion optimization remain deliberately scoped to the follow-on phase described above.

### Residual risks

- Aggregate RMD modeling can overstate distributions when current-employer-plan exceptions apply; Phase 0 mitigates this with explicit user messaging but cannot resolve it without new ownership and employment data.
- Correcting healthcare withdrawals and RMD surplus retention will change existing projections and downstream sensitivity/AI results; deterministic regression fixtures are required before rollout.
- Lazy version refresh can cause a first-access calculation burst and mixed-version deployments can corrupt version provenance unless migration-first rollout and old-instance draining are followed.

### Final recommendation

Approve the plan for implementation in the documented phase order. Do not begin Roth-conversion recommendation logic until the Phase 0 completion criteria and version-2 freshness checks pass.
