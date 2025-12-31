# Story 7: Export Projection Results - Implementation Plan

## Overview

Implement CSV and PDF export functionality for projection results. Users should be able to download their projection data with a timestamp, timezone, input summary (key assumptions + scenario metadata), matching the currently displayed scenario.

## Current State Analysis

### Existing Implementation
- CSV export exists in [ProjectionTable.tsx:35-58](src/components/projections/ProjectionTable.tsx#L35-L58)
- Exports 7 columns: Age, Year, Balance, Income, Expenses, Net Change, Phase
- Uses native browser `Blob` API for download
- Fixed filename: `retirement-projection.csv`
- **Missing**: timestamp, timezone, input summary, scenario metadata

### Data Available in PlansClient
All necessary data for a comprehensive export is available in [plans-client.tsx](src/app/plans/plans-client.tsx):
- `projection.records` - Year-by-year data
- `projection.summary` - Aggregate metrics (starting/ending balance, years until depletion, etc.)
- `assumptions` - Current user assumptions (expectedReturn, inflationRate, retirementAge)
- `defaultAssumptions` - Default values for comparison
- `currentAge` - User's current age
- `monthlySpending` - Monthly expenses
- `inputWarnings` - Validation warnings
- `shortfallAge` - Calculated depletion age

### Dependencies
Current dependencies do not include PDF generation libraries. Need to add `jspdf` with `jspdf-autotable` plugin.

## Desired End State

After implementation:
1. Users can export CSV with metadata header (timestamp, timezone, assumptions)
2. Users can export PDF with professional layout (header, assumptions, summary metrics, year-by-year table)
3. Export buttons are prominently placed in the projection results view
4. Filenames are dynamic: `projection-{retirement_age}-{timestamp}.{csv|pdf}`
5. Exports match currently displayed scenario

### Verification
- Export CSV button produces a file with metadata header followed by data rows
- Export PDF button produces a formatted document with all sections
- Both exports include correct timestamp with timezone
- Changing assumptions and re-exporting reflects the new values

## What We're NOT Doing

- Chart image capture in PDF (would require additional complexity with html2canvas)
- Server-side export generation (keeping it client-side for simplicity)
- Custom filename input dialog (using dynamic naming instead)
- Income stream detailed breakdown (keeping export focused on key data)
- Tax breakdown columns (`balanceByType`) - keeping export simple

## Implementation Approach

1. Create a reusable export hook (`useProjectionExport`) that handles both CSV and PDF generation
2. Add `jspdf` and `jspdf-autotable` dependencies for PDF generation
3. Create an `ExportPanel` component with CSV and PDF buttons
4. Integrate export panel into the projection results view
5. Write comprehensive tests for export functionality

---

## Phase 1: Install Dependencies and Create Export Hook

### Overview
Set up PDF library dependencies and create the core export logic as a reusable hook.

### Changes Required:

#### 1. Install Dependencies
```bash
npm install jspdf jspdf-autotable
npm install -D @types/jspdf @types/jspdf-autotable
```

Note: jspdf-autotable types may be bundled. Check after install.

#### 2. Create Export Hook
**File**: `src/hooks/useProjectionExport.ts`

```typescript
'use client';

import { useCallback } from 'react';
import type { ProjectionRecord, ProjectionSummary } from '@/lib/projections/types';
import type { Assumptions } from '@/components/projections';

export interface ExportData {
  records: ProjectionRecord[];
  summary: ProjectionSummary;
  assumptions: Assumptions;
  defaultAssumptions: Assumptions;
  currentAge: number;
  monthlySpending: number;
}

interface ExportOptions {
  retirementAge: number;
}

function formatTimestamp(): { timestamp: string; timezone: string } {
  const now = new Date();
  const timestamp = now.toISOString();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return { timestamp, timezone };
}

function generateFilename(retirementAge: number, extension: 'csv' | 'pdf'): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return `projection-age${retirementAge}-${dateStr}.${extension}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function useProjectionExport() {
  const exportCSV = useCallback((data: ExportData, options: ExportOptions) => {
    const { timestamp, timezone } = formatTimestamp();
    const { records, summary, assumptions, currentAge, monthlySpending } = data;

    // Build metadata section
    const metadata = [
      ['Export Timestamp', timestamp],
      ['Timezone', timezone],
      [''],
      ['=== ASSUMPTIONS ===', ''],
      ['Expected Return', formatPercent(assumptions.expectedReturn)],
      ['Inflation Rate', formatPercent(assumptions.inflationRate)],
      ['Retirement Age', assumptions.retirementAge.toString()],
      ['Current Age', currentAge.toString()],
      ['Monthly Spending', formatCurrency(monthlySpending)],
      [''],
      ['=== SUMMARY ===', ''],
      ['Starting Balance', formatCurrency(summary.startingBalance)],
      ['Projected Retirement Balance', formatCurrency(summary.projectedRetirementBalance)],
      ['Ending Balance', formatCurrency(summary.endingBalance)],
      ['Total Contributions', formatCurrency(summary.totalContributions)],
      ['Total Withdrawals', formatCurrency(summary.totalWithdrawals)],
      ['Years Until Depletion', summary.yearsUntilDepletion?.toString() ?? 'Never'],
      [''],
      ['=== YEAR-BY-YEAR DATA ===', ''],
    ];

    // Data headers
    const headers = ['Age', 'Year', 'Balance', 'Income', 'Expenses', 'Net Change', 'Phase'];

    // Calculate net change and phase for each record
    const rows = records.map((record, index) => {
      const netChange = index > 0
        ? record.balance - records[index - 1].balance
        : record.inflows - record.outflows;
      const phase = record.age >= assumptions.retirementAge ? 'Retirement' : 'Accumulation';

      return [
        record.age,
        record.year,
        record.balance.toFixed(2),
        record.inflows.toFixed(2),
        record.outflows.toFixed(2),
        netChange.toFixed(2),
        phase,
      ];
    });

    // Combine all sections
    const csvContent = [
      ...metadata.map(row => row.join(',')),
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = generateFilename(options.retirementAge, 'csv');
    link.click();
    URL.revokeObjectURL(link.href);
  }, []);

  const exportPDF = useCallback(async (data: ExportData, options: ExportOptions) => {
    // Dynamic import to reduce initial bundle size
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const { timestamp, timezone } = formatTimestamp();
    const { records, summary, assumptions, currentAge, monthlySpending } = data;

    const doc = new jsPDF();
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.text('Retirement Projection Report', 14, y);
    y += 10;

    // Export info
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${timestamp}`, 14, y);
    y += 5;
    doc.text(`Timezone: ${timezone}`, 14, y);
    y += 10;

    // Assumptions section
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Assumptions', 14, y);
    y += 8;

    doc.setFontSize(10);
    const assumptionLines = [
      `Expected Return: ${formatPercent(assumptions.expectedReturn)}`,
      `Inflation Rate: ${formatPercent(assumptions.inflationRate)}`,
      `Retirement Age: ${assumptions.retirementAge}`,
      `Current Age: ${currentAge}`,
      `Monthly Spending: ${formatCurrency(monthlySpending)}`,
    ];
    assumptionLines.forEach(line => {
      doc.text(line, 14, y);
      y += 5;
    });
    y += 5;

    // Summary section
    doc.setFontSize(14);
    doc.text('Summary', 14, y);
    y += 8;

    doc.setFontSize(10);
    const summaryLines = [
      `Starting Balance: ${formatCurrency(summary.startingBalance)}`,
      `Projected Retirement Balance: ${formatCurrency(summary.projectedRetirementBalance)}`,
      `Ending Balance: ${formatCurrency(summary.endingBalance)}`,
      `Total Contributions: ${formatCurrency(summary.totalContributions)}`,
      `Total Withdrawals: ${formatCurrency(summary.totalWithdrawals)}`,
      `Years Until Depletion: ${summary.yearsUntilDepletion ?? 'Never'}`,
    ];
    summaryLines.forEach(line => {
      doc.text(line, 14, y);
      y += 5;
    });
    y += 10;

    // Year-by-year table
    doc.setFontSize(14);
    doc.text('Year-by-Year Projection', 14, y);
    y += 5;

    const tableData = records.map((record, index) => {
      const netChange = index > 0
        ? record.balance - records[index - 1].balance
        : record.inflows - record.outflows;
      const phase = record.age >= assumptions.retirementAge ? 'Retirement' : 'Accumulation';

      return [
        record.age.toString(),
        record.year.toString(),
        formatCurrency(record.balance),
        formatCurrency(record.inflows),
        formatCurrency(record.outflows),
        formatCurrency(netChange),
        phase,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Age', 'Year', 'Balance', 'Income', 'Expenses', 'Net Change', 'Phase']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    // Save
    doc.save(generateFilename(options.retirementAge, 'pdf'));
  }, []);

  return { exportCSV, exportPDF };
}
```

### Success Criteria:

#### Automated Verification:
- [x] Dependencies install successfully: `npm install jspdf jspdf-autotable`
- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Hook file created at correct location
- [ ] No TypeScript errors in IDE

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Create Export Panel Component

### Overview
Create a UI component with CSV and PDF export buttons that integrates with the export hook.

### Changes Required:

#### 1. Create ExportPanel Component
**File**: `src/components/projections/ExportPanel.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2 } from 'lucide-react';
import { useProjectionExport, type ExportData } from '@/hooks/useProjectionExport';

interface ExportPanelProps {
  data: ExportData;
}

export function ExportPanel({ data }: ExportPanelProps) {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const { exportCSV, exportPDF } = useProjectionExport();

  const handleExportCSV = () => {
    exportCSV(data, { retirementAge: data.assumptions.retirementAge });
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      await exportPDF(data, { retirementAge: data.assumptions.retirementAge });
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportCSV}
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        Export CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPDF}
        disabled={isExportingPDF}
        className="flex items-center gap-2"
      >
        {isExportingPDF ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        Export PDF
      </Button>
    </div>
  );
}
```

#### 2. Export from Index
**File**: `src/components/projections/index.ts`

Add export for the new component:

```typescript
export { ExportPanel } from './ExportPanel';
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Component renders two buttons (CSV and PDF)
- [ ] Buttons have appropriate icons

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Integrate Export Panel into Plans Client

### Overview
Add the ExportPanel to the projection results view, replacing or supplementing the existing CSV export in ProjectionTable.

### Changes Required:

#### 1. Update PlansClient
**File**: `src/app/plans/plans-client.tsx`

Add import for ExportPanel:
```typescript
import { ProjectionChart, ProjectionTable, AssumptionsPanel, ExportPanel, type Assumptions } from '@/components/projections';
```

Add ExportPanel in the projection results section (after the status card, before the chart):

```typescript
{/* Export Panel */}
<div className="flex justify-end">
  <ExportPanel
    data={{
      records: projection.records,
      summary: projection.summary,
      assumptions,
      defaultAssumptions,
      currentAge,
      monthlySpending,
    }}
  />
</div>
```

#### 2. Remove Old CSV Export from ProjectionTable
**File**: `src/components/projections/ProjectionTable.tsx`

Remove the following:
- The `handleExportCSV` function (lines 35-58)
- The export button in the header (lines 77-87)
- The `Download` icon import if no longer used

The ProjectionTable should focus only on displaying the table, not export functionality.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`
- [x] Build succeeds: `npm run build`

#### Manual Verification:
- [ ] Export buttons appear in projection results view
- [ ] CSV export works and includes metadata header
- [ ] PDF export works and includes all sections
- [ ] Filenames are dynamic with retirement age and date
- [ ] Exports reflect current assumption values
- [ ] Changing assumptions and re-exporting shows updated values

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Write Tests

### Overview
Add unit tests for the export hook to ensure export logic is correct.

### Changes Required:

#### 1. Create Export Hook Tests
**File**: `src/hooks/__tests__/useProjectionExport.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectionExport, type ExportData } from '../useProjectionExport';

// Mock jspdf and jspdf-autotable
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    save: vi.fn(),
  })),
}));

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

const mockExportData: ExportData = {
  records: [
    {
      age: 30,
      year: 2025,
      balance: 100000,
      inflows: 20000,
      outflows: 0,
      balanceByType: { taxDeferred: 70000, taxFree: 20000, taxable: 10000 },
    },
    {
      age: 31,
      year: 2026,
      balance: 127000,
      inflows: 20000,
      outflows: 0,
      balanceByType: { taxDeferred: 88900, taxFree: 25400, taxable: 12700 },
    },
  ],
  summary: {
    startingBalance: 100000,
    endingBalance: 2500000,
    totalContributions: 700000,
    totalWithdrawals: 800000,
    yearsUntilDepletion: null,
    projectedRetirementBalance: 1500000,
  },
  assumptions: {
    expectedReturn: 0.07,
    inflationRate: 0.025,
    retirementAge: 65,
  },
  defaultAssumptions: {
    expectedReturn: 0.07,
    inflationRate: 0.025,
    retirementAge: 65,
  },
  currentAge: 30,
  monthlySpending: 5000,
};

describe('useProjectionExport', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let capturedBlob: Blob | null = null;

  beforeEach(() => {
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    mockRevokeObjectURL = vi.fn();
    mockClick = vi.fn();
    capturedBlob = null;

    // Mock URL methods
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    // Mock document.createElement to capture the blob
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: mockClick,
          set href(value: string) {
            // Store for assertions
          },
        } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exportCSV', () => {
    it('creates CSV with metadata header', () => {
      const { result } = renderHook(() => useProjectionExport());

      act(() => {
        result.current.exportCSV(mockExportData, { retirementAge: 65 });
      });

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      expect(mockClick).toHaveBeenCalledTimes(1);
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it('generates correct filename with retirement age', () => {
      const { result } = renderHook(() => useProjectionExport());

      let downloadFilename = '';
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          return {
            href: '',
            set download(value: string) {
              downloadFilename = value;
            },
            get download() {
              return downloadFilename;
            },
            click: mockClick,
          } as unknown as HTMLAnchorElement;
        }
        return document.createElement(tag);
      });

      act(() => {
        result.current.exportCSV(mockExportData, { retirementAge: 65 });
      });

      expect(downloadFilename).toMatch(/^projection-age65-\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });

  describe('exportPDF', () => {
    it('generates PDF with correct filename', async () => {
      const { result } = renderHook(() => useProjectionExport());

      await act(async () => {
        await result.current.exportPDF(mockExportData, { retirementAge: 65 });
      });

      // Verify jsPDF was instantiated and save was called
      const jsPDF = await import('jspdf');
      expect(jsPDF.default).toHaveBeenCalled();
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Tests pass: `npm test -- --run src/hooks/__tests__/useProjectionExport.test.ts`
- [x] Type checking passes: `npm run typecheck`
- [x] Linting passes: `npm run lint`

#### Manual Verification:
- [ ] Tests cover CSV metadata generation
- [ ] Tests cover filename generation
- [ ] Tests cover PDF generation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for final manual testing.

---

## Testing Strategy

### Unit Tests:
- Export hook metadata generation
- Filename generation with retirement age and date
- CSV content structure
- PDF section generation

### Manual Testing Steps:
1. Navigate to projection results page
2. Click "Export CSV" - verify file downloads with correct name
3. Open CSV - verify metadata section at top, then data rows
4. Click "Export PDF" - verify loading state, then download
5. Open PDF - verify header, assumptions, summary, and table sections
6. Change retirement age assumption
7. Export again - verify new exports reflect changed assumption
8. Verify timestamp and timezone in both export formats

## Performance Considerations

- PDF library is dynamically imported to reduce initial bundle size
- PDF generation shows loading state during async operation
- CSV export is synchronous and near-instant

## Migration Notes

- Existing CSV export in ProjectionTable will be removed
- No data migration needed - this is a new feature
- Users who have bookmarked the old export flow will find the new buttons in a more prominent location

## References

- Research document: `thoughts/shared/research/2025-12-30-story-7-export-projection-results.md`
- Story scope: `thoughts/personal/tickets/epic-3/projection-modeling/story-7-scope.md`
- Current export implementation: `src/components/projections/ProjectionTable.tsx:35-58`
- Plans client: `src/app/plans/plans-client.tsx`
