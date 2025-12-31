import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectionExport, type ExportData } from '../useProjectionExport';

// Mock jspdf and jspdf-autotable
const mockSave = vi.fn();
vi.mock('jspdf', () => {
  return {
    default: class MockJsPDF {
      setFontSize = vi.fn();
      setTextColor = vi.fn();
      text = vi.fn();
      save = mockSave;
    },
  };
});

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
  let mockCreateObjectURL: (obj: Blob | MediaSource) => string;
  let mockRevokeObjectURL: (url: string) => void;
  let mockClick: () => void;
  let mockAnchor: { href: string; download: string; click: () => void };
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    mockRevokeObjectURL = vi.fn();
    mockClick = vi.fn();

    // Store original createElement
    originalCreateElement = document.createElement.bind(document);

    // Create mock anchor element
    mockAnchor = {
      href: '',
      download: '',
      click: mockClick,
    };

    // Mock URL methods
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    // Mock document.createElement
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return mockAnchor as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exportCSV', () => {
    it('creates CSV with metadata header and triggers download', () => {
      const { result } = renderHook(() => useProjectionExport());

      act(() => {
        result.current.exportCSV(mockExportData, { retirementAge: 65 });
      });

      expect(vi.mocked(mockCreateObjectURL)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(mockClick)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(mockRevokeObjectURL)).toHaveBeenCalledTimes(1);
    });

    it('generates correct filename with retirement age and date', () => {
      const { result } = renderHook(() => useProjectionExport());

      act(() => {
        result.current.exportCSV(mockExportData, { retirementAge: 65 });
      });

      expect(mockAnchor.download).toMatch(/^projection-age65-\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it('creates blob with correct MIME type', () => {
      const { result } = renderHook(() => useProjectionExport());

      act(() => {
        result.current.exportCSV(mockExportData, { retirementAge: 65 });
      });

      expect(vi.mocked(mockCreateObjectURL)).toHaveBeenCalledWith(
        expect.any(Blob)
      );

      const blobArg = vi.mocked(mockCreateObjectURL).mock.calls[0][0] as Blob;
      expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    });
  });

  describe('exportPDF', () => {
    it('generates PDF and triggers download', async () => {
      const { result } = renderHook(() => useProjectionExport());

      await act(async () => {
        await result.current.exportPDF(mockExportData, { retirementAge: 65 });
      });

      // Verify save was called with correct filename pattern
      expect(mockSave).toHaveBeenCalledWith(
        expect.stringMatching(/^projection-age65-\d{4}-\d{2}-\d{2}\.pdf$/)
      );

      // Verify jspdf-autotable was called
      const autoTable = await import('jspdf-autotable');
      expect(autoTable.default).toHaveBeenCalled();
    });
  });
});
