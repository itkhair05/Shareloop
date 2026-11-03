import { useId, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { domainSelectClassName } from './ReportingFilterBar';
import { useReportingCsvExport } from '../hooks/use-reporting-export';
import {
  REPORTING_EXPORT_DATASETS,
  REPORTING_EXPORT_DATASET_LABELS,
} from '../utils/reporting-export';
import type {
  ReportGranularity,
  ReportingExportDataset,
  ReportingExportFilters,
  ReportingExportSection,
  ReportingRangeQuery,
} from '@/types/reporting';

export interface ReportingExportControlProps {
  section: ReportingExportSection;
  range: ReportingRangeQuery;
  granularity: ReportGranularity;
  filters?: Omit<ReportingExportFilters, keyof ReportingRangeQuery | 'granularity'>;
}

export function ReportingExportControl({
  section,
  range,
  granularity,
  filters,
}: ReportingExportControlProps) {
  const datasets = REPORTING_EXPORT_DATASETS[section];
  const [selectedDataset, setSelectedDataset] =
    useState<ReportingExportDataset>('summary');
  const selectId = useId();
  const { isExporting, error, exportCsv, clearError } = useReportingCsvExport();

  const dataset = datasets.length === 1 ? datasets[0] : selectedDataset;

  const handleExport = () => {
    void exportCsv(section, dataset, { ...range, granularity, ...filters });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {datasets.length > 1 && (
          <>
            <label htmlFor={selectId} className="text-[11px] font-semibold text-slate-500">
              Dữ liệu xuất
            </label>
            <select
              id={selectId}
              value={dataset}
              disabled={isExporting}
              onChange={(event) => {
                setSelectedDataset(event.target.value as ReportingExportDataset);
                clearError();
              }}
              className={domainSelectClassName}
            >
              {datasets.map((value) => (
                <option key={value} value={value}>
                  {REPORTING_EXPORT_DATASET_LABELS[value]}
                </option>
              ))}
            </select>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          isLoading={isExporting}
          leftIcon={<Download className="w-3.5 h-3.5" />}
          className="cursor-pointer bg-white hover:bg-slate-50"
          title="Xuất dữ liệu đang áp dụng ra tệp CSV"
        >
          {isExporting ? 'Đang xuất...' : 'Xuất CSV'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-red-700 text-right">
          {error}
        </p>
      )}
    </div>
  );
}

export default ReportingExportControl;
