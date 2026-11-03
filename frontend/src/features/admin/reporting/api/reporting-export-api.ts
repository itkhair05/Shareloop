import { rawAxiosClient } from '@/lib/api-client';
import {
  buildReportingExportParams,
  resolveReportingExportFilename,
} from '../utils/reporting-export';
import type {
  ReportingCsvDownload,
  ReportingExportDataset,
  ReportingExportFilters,
  ReportingExportSection,
} from '@/types/reporting';

const BASE_PATH = '/api/v1/admin/reporting';

export async function exportReportingCsv(
  section: ReportingExportSection,
  dataset: ReportingExportDataset,
  filters: ReportingExportFilters
): Promise<ReportingCsvDownload> {
  const params = buildReportingExportParams(section, dataset, filters);

  const response = await rawAxiosClient.get<Blob>(`${BASE_PATH}/export/${section}`, {
    params,
    responseType: 'blob',
    headers: { Accept: 'text/csv' },
  });

  const rawDisposition = response.headers?.['content-disposition'];
  const disposition = Array.isArray(rawDisposition) ? rawDisposition[0] : rawDisposition;

  return {
    blob: response.data,
    filename: resolveReportingExportFilename(
      typeof disposition === 'string' ? disposition : null,
      section,
      filters.from,
      filters.to
    ),
  };
}
