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
    const headers = [
      'Age',
      'Year',
      'Balance',
      'Tax-Deferred',
      'Tax-Free',
      'Taxable',
      'Income',
      'Expenses',
      'RMD Required',
      'RMD Taken',
      'Net Change',
      'Phase',
    ];

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
        record.balanceByType.taxDeferred.toFixed(2),
        record.balanceByType.taxFree.toFixed(2),
        record.balanceByType.taxable.toFixed(2),
        record.inflows.toFixed(2),
        record.outflows.toFixed(2),
        (record.rmd?.rmdRequired ?? 0).toFixed(2),
        (record.rmd?.rmdTaken ?? 0).toFixed(2),
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
        formatCurrency(record.balanceByType.taxDeferred),
        formatCurrency(record.balanceByType.taxFree),
        formatCurrency(record.balanceByType.taxable),
        formatCurrency(record.inflows),
        formatCurrency(record.outflows),
        formatCurrency(record.rmd?.rmdRequired ?? 0),
        formatCurrency(record.rmd?.rmdTaken ?? 0),
        formatCurrency(netChange),
        phase,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Age', 'Year', 'Balance', 'Tax-Def', 'Tax-Free', 'Taxable', 'Income', 'Expenses', 'RMD Req', 'RMD Taken', 'Net Chg', 'Phase']],
      body: tableData,
      styles: { fontSize: 6 },
      headStyles: { fillColor: [66, 66, 66] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    // Save
    doc.save(generateFilename(options.retirementAge, 'pdf'));
  }, []);

  return { exportCSV, exportPDF };
}
