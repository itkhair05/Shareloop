import type { ReactNode } from 'react';
import { AlertCircle, CalendarDays, Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ReportGranularity } from '@/types/reporting';
import {
  addDays,
  DEFAULT_RANGE_DAYS,
  formatPeriodDateRange,
  getTodayInTimezone,
  REPORTING_TIMEZONE_LABEL,
  validateReportingRange,
} from '../utils/reporting-format';
import { GRANULARITY_LABELS } from '../utils/reporting-labels';
import { ReportingRefetchingIndicator } from './ReportingStates';

export interface ReportingFilterDraft {
  from: string;
  to: string;
  granularity: ReportGranularity;
}

export interface ReportingFilterBarProps {
  draft: ReportingFilterDraft;
  applied: ReportingFilterDraft;
  onChange: (next: ReportingFilterDraft) => void;
  onApply: () => void;
  onReset: () => void;
  isFetching?: boolean;
}

const PRESETS = [
  { label: '7 ngày', days: 7 },
  { label: '30 ngày', days: DEFAULT_RANGE_DAYS },
  { label: '90 ngày', days: 90 },
];

const selectClassName =
  'py-1.5 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer';

export function DomainFilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={htmlFor} className="text-[11px] font-semibold text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

export function DomainFilterBar({
  children,
  onReset,
  hasActiveFilters,
  isFetching = false,
}: {
  children: ReactNode;
  onReset: () => void;
  hasActiveFilters: boolean;
  isFetching?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div className="flex flex-wrap items-end gap-3 min-w-0">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 pb-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          Bộ lọc
        </span>
        {children}
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        {isFetching && <ReportingRefetchingIndicator />}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            className="cursor-pointer text-slate-600 hover:text-slate-900"
          >
            Xóa bộ lọc
          </Button>
        )}
      </div>
    </div>
  );
}

export { selectClassName as domainSelectClassName };

export function ReportingFilterBar({
  draft,
  applied,
  onChange,
  onApply,
  onReset,
  isFetching = false,
}: ReportingFilterBarProps) {
  const validation = validateReportingRange(draft.from, draft.to, draft.granularity);
  const today = getTodayInTimezone();
  const hasChanges =
    draft.from !== applied.from ||
    draft.to !== applied.to ||
    draft.granularity !== applied.granularity;

  const applyPreset = (days: number) => {
    const to = today;
    onChange({ ...draft, from: addDays(to, -days), to });
  };

  return (
    <section
      aria-label="Bộ lọc báo cáo"
      className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3"
    >
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="reporting-from" className="text-[11px] font-semibold text-slate-500">
                Từ ngày (bao gồm)
              </label>
              <input
                id="reporting-from"
                type="date"
                value={draft.from}
                max={today}
                aria-invalid={!validation.valid}
                aria-describedby={!validation.valid ? 'reporting-range-error' : undefined}
                onChange={(event) => onChange({ ...draft, from: event.target.value })}
                className="py-1.5 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            <span className="text-slate-400 text-xs pb-2" aria-hidden="true">
              đến
            </span>

            <div className="flex flex-col gap-1">
              <label htmlFor="reporting-to" className="text-[11px] font-semibold text-slate-500">
                Đến ngày (không bao gồm)
              </label>
              <input
                id="reporting-to"
                type="date"
                value={draft.to}
                min={draft.from ? addDays(draft.from, 1) : undefined}
                max={today}
                aria-invalid={!validation.valid}
                aria-describedby={!validation.valid ? 'reporting-range-error' : undefined}
                onChange={(event) => onChange({ ...draft, to: event.target.value })}
                className="py-1.5 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg" role="group" aria-label="Chọn nhanh khoảng thời gian">
              {PRESETS.map((preset) => {
                const presetFrom = addDays(today, -preset.days);
                const isActive = draft.from === presetFrom && draft.to === today;
                return (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => applyPreset(preset.days)}
                    aria-pressed={isActive}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              Múi giờ: {REPORTING_TIMEZONE_LABEL}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold text-slate-500">Mức tổng hợp</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg" role="group" aria-label="Mức tổng hợp biểu đồ">
              {(Object.keys(GRANULARITY_LABELS) as ReportGranularity[]).map((granularity) => (
                <button
                  key={granularity}
                  type="button"
                  onClick={() => onChange({ ...draft, granularity })}
                  aria-pressed={draft.granularity === granularity}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    draft.granularity === granularity
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {GRANULARITY_LABELS[granularity]}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-slate-500">
              Đang áp dụng: {formatPeriodDateRange(applied.from, applied.to)}
            </span>

            {isFetching && <ReportingRefetchingIndicator />}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            className="cursor-pointer"
          >
            Đặt lại
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onApply}
            disabled={!validation.valid || !hasChanges}
            leftIcon={<Check className="w-3.5 h-3.5" />}
            className="cursor-pointer"
          >
            Áp dụng
          </Button>
        </div>
      </div>

      {!validation.valid && (
        <p
          id="reporting-range-error"
          role="alert"
          className="flex items-center gap-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {validation.message}
        </p>
      )}

      {validation.valid && hasChanges && (
        <p className="text-[11px] text-amber-700">
          Có thay đổi chưa áp dụng. Nhấn “Áp dụng” để tải lại số liệu.
        </p>
      )}

      <p className="text-[11px] text-slate-500">
        Khoảng thời gian được hiểu theo múi giờ {REPORTING_TIMEZONE_LABEL}; ngày kết thúc không được tính vào số liệu.
        {' '}Mặc định là {DEFAULT_RANGE_DAYS} ngày gần nhất.
      </p>
    </section>
  );
}

export default ReportingFilterBar;
