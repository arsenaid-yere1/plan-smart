---
date: 2025-12-30T00:00:00-08:00
researcher: Claude
git_commit: f9be8739e76bc279c903f92847e653e8270d8646
branch: main
repository: plan-smart
topic: "Export Projection Results - Story 7 Implementation Research"
tags: [research, codebase, export, csv, pdf, projections]
status: complete
last_updated: 2025-12-30
last_updated_by: Claude
---

# Research: Export Projection Results - Story 7

**Date**: 2025-12-30
**Researcher**: Claude
**Git Commit**: f9be8739e76bc279c903f92847e653e8270d8646
**Branch**: main
**Repository**: plan-smart

## Research Question

How should we implement CSV and PDF export functionality for projection results to satisfy Story 7 requirements?

## Summary

The codebase already has a basic CSV export implementation in `ProjectionTable.tsx` using native browser APIs. The story requires enhancing this with:
1. **Timestamp and timezone** in export files
2. **Input summary** (assumptions + scenario metadata)
3. **Scenario awareness** (baseline vs alternative, selected retirement age)
4. **PDF export** capability (new - no libraries currently installed)

The existing CSV export only includes year-by-year data without assumptions or metadata. PDF export is completely unimplemented.

## Detailed Findings

### Existing Export Implementation

**Location**: [ProjectionTable.tsx:35-58](src/components/projections/ProjectionTable.tsx#L35-L58)

Current CSV export functionality:
- Uses native browser `Blob` API
- Exports only 7 columns: Age, Year, Balance, Income, Expenses, Net Change, Phase
- No timestamp or timezone
- No input assumptions included
- Fixed filename: `retirement-projection.csv`

```typescript
const handleExportCSV = () => {
  const headers = ['Age', 'Year', 'Balance', 'Income', 'Expenses', 'Net Change', 'Phase'];
  // ... generates CSV and triggers download
};
```

**Missing from current implementation:**
- Export timestamp with timezone
- Input summary / key assumptions
- Scenario metadata (baseline vs alternative)
- Currently selected scenario parameters

### Data Structures Available for Export

**ProjectionRecord** ([types.ts:130-140](src/lib/projections/types.ts#L130-L140)):
```typescript
interface ProjectionRecord {
  age: number;
  year: number;
  balance: number;
  inflows: number;
  outflows: number;
  balanceByType: BalanceByType;
  withdrawalsByType?: BalanceByType;
}
```

**ProjectionSummary** ([types.ts:145-152](src/lib/projections/types.ts#L145-L152)):
```typescript
interface ProjectionSummary {
  startingBalance: number;
  endingBalance: number;
  totalContributions: number;
  totalWithdrawals: number;
  yearsUntilDepletion: number | null;
  projectedRetirementBalance: number;
}
```

**ProjectionAssumptions** ([types.ts:173-180](src/lib/projections/types.ts#L173-L180)):
```typescript
interface ProjectionAssumptions {
  expectedReturn: number;
  inflationRate: number;
  healthcareInflationRate: number;
  contributionGrowthRate: number;
  retirementAge: number;
  maxAge: number;
}
```

**IncomeStream** ([types.ts:22-30](src/lib/projections/types.ts#L22-L30)):
```typescript
interface IncomeStream {
  id: string;
  name: string;
  type: IncomeStreamType;
  annualAmount: number;
  startAge: number;
  endAge?: number;
  inflationAdjusted: boolean;
}
```

### Projection Results View Architecture

**Main Client Component**: [plans-client.tsx](src/app/plans/plans-client.tsx)
- Displays `ProjectionChart`, `ProjectionTable`, `AssumptionsPanel`
- Has access to full projection data including assumptions and summary
- Calculates `shortfallAge` from projection summary

**Components that would need export enhancement:**
1. [ProjectionTable.tsx](src/components/projections/ProjectionTable.tsx) - Current CSV export location
2. [ProjectionChart.tsx](src/components/projections/ProjectionChart.tsx) - Chart visualization
3. [AssumptionsPanel.tsx](src/components/projections/AssumptionsPanel.tsx) - Displays current assumptions

### Package Dependencies

**Framework**: Next.js 15.1.0 with React 19.0.0

**Available for export:**
- `lucide-react` - Icons (Download icon already used)
- `recharts` - Chart library (potential for chart image export)
- Native browser APIs (Blob, URL.createObjectURL)

**Missing - would need to add:**
- **PDF generation**: `jspdf` or `@react-pdf/renderer`
- **Enhanced CSV**: Native APIs are sufficient, no library needed

### Scenario Handling

**Current state:**
- No explicit "baseline vs alternative" scenario types
- Single projection per plan (one-to-one relationship)
- What-if exploration via ephemeral POST requests with parameter overrides
- Assumptions can be modified via `AssumptionsPanel`

**For export, we need to capture:**
- Currently displayed scenario parameters
- Which assumptions are modified from defaults
- The retirement age being viewed

### API Routes Available

- **POST `/api/projections/calculate`** - Returns full projection with inputs and warnings
- **GET `/api/projections/[planId]`** - Returns stored projection with all metadata
- **POST `/api/projections/save`** - Upserts projection result

All routes return comprehensive data including inputs, assumptions, records, and summary.

## Code References

- [ProjectionTable.tsx](src/components/projections/ProjectionTable.tsx) - Current CSV export implementation
- [types.ts](src/lib/projections/types.ts) - All projection type definitions
- [plans-client.tsx](src/app/plans/plans-client.tsx) - Main projection view container
- [AssumptionsPanel.tsx](src/components/projections/AssumptionsPanel.tsx) - Assumptions display/edit
- [ProjectionChart.tsx](src/components/projections/ProjectionChart.tsx) - Chart visualization
- [package.json](package.json) - Current dependencies

## Architecture Insights

### Recommended Implementation Approach

**1. Enhanced CSV Export:**
- Extend existing `handleExportCSV` function
- Add metadata section at top of CSV:
  ```
  Export Date,2025-12-30T15:30:00-08:00
  Retirement Age,65
  Expected Return,7.00%
  Inflation Rate,2.50%
  ...
  [blank line]
  Age,Year,Balance,...
  ```
- Dynamic filename: `projection-{retirement_age}-{timestamp}.csv`

**2. PDF Export (New):**
- Install `jspdf` or `@react-pdf/renderer`
- Create professional report layout:
  - Header with export timestamp + timezone
  - Assumptions summary section
  - Key metrics (summary data)
  - Year-by-year table
  - Optional: Chart image capture via `recharts` `toDataURL()`

**3. Export Component Refactor:**
- Extract export logic from `ProjectionTable` into dedicated component/hook
- Create `useProjectionExport` hook or `ExportPanel` component
- Accept full projection data including assumptions and summary
- Support both CSV and PDF formats

### Data Flow for Export

```
plans-client.tsx
    ├── Has: records, summary, assumptions, inputs
    ├── Pass to: ExportPanel / useProjectionExport
    └── Export generates file with:
        ├── Timestamp (new Date().toISOString())
        ├── Timezone (Intl.DateTimeFormat().resolvedOptions().timeZone)
        ├── Assumptions summary
        ├── Scenario metadata (retirement age, modified params)
        └── Year-by-year data
```

### PDF Library Comparison

| Library | Pros | Cons |
|---------|------|------|
| `jspdf` | Simple API, small bundle, widely used | Manual positioning, limited styling |
| `@react-pdf/renderer` | React components, styled-components like API | Larger bundle, more complex setup |
| `pdfmake` | Declarative layout, tables built-in | Medium bundle size |

**Recommendation**: `jspdf` with `jspdf-autotable` plugin for simple table generation.

## Open Questions

1. **Chart in PDF**: Should the PDF include a visual chart, or just tabular data?
2. **Tax breakdown**: Should export include `balanceByType` columns (taxDeferred/taxFree/taxable)?
3. **Income streams detail**: Should export list all income streams with parameters?
4. **Export button location**: Should export be at top of projection view (prominent) or stay with table?
5. **Filename customization**: Should user be able to name the export file?

## Implementation Checklist

- [ ] Install PDF library (`npm install jspdf jspdf-autotable`)
- [ ] Create `useProjectionExport` hook with CSV and PDF functions
- [ ] Add timezone-aware timestamp to exports
- [ ] Include assumptions summary section in exports
- [ ] Add scenario metadata (retirement age, modified assumptions)
- [ ] Create `ExportPanel` component with CSV/PDF buttons
- [ ] Update `ProjectionTable` or `plans-client` to use new export component
- [ ] Write tests for export functionality
- [ ] Update story-7-scope.md with implementation notes
