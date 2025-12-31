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
