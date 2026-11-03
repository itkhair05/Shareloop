import { useCallback, useRef, useState } from 'react';
import { exportReportingCsv } from '../api/reporting-export-api';
import {
  downloadReportingCsv,
  getReportingExportErrorMessage,
} from '../utils/reporting-export';
import type {
  ReportingExportDataset,
  ReportingExportFilters,
  ReportingExportSection,
} from '@/types/reporting';

export function useReportingCsvExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const exportCsv = useCallback(
    async (
      section: ReportingExportSection,
      dataset: ReportingExportDataset,
      filters: ReportingExportFilters
    ) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setIsExporting(true);
      setError(null);

      try {
        const { blob, filename } = await exportReportingCsv(section, dataset, filters);
        downloadReportingCsv(blob, filename);
      } catch (caught) {
        setError(getReportingExportErrorMessage(caught));
      } finally {
        inFlight.current = false;
        setIsExporting(false);
      }
    },
    []
  );

  return { isExporting, error, exportCsv, clearError };
}
