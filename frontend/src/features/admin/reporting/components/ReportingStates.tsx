import type { ReactNode } from 'react';
import { AlertCircle, Inbox, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ErrorAlert, LoadingSpinner } from '@/components/ui/Feedback';
import { getReportingErrorMessage } from '../utils/reporting-format';

export function ReportingSectionSkeleton({
  label = 'Đang tải số liệu báo cáo...',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div role="status" aria-label={label} className="py-8 flex justify-center">
        <LoadingSpinner label={label} />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={label}
      className="animate-pulse space-y-4 bg-white border border-slate-200 rounded-xl p-5"
    >
      <div className="h-4 w-40 bg-slate-200 rounded" />
      <div className="h-3 w-64 bg-slate-100 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-lg" />
        ))}
      </div>
      <div className="h-52 bg-slate-100 rounded-lg" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ReportingQueryError({
  title,
  error,
  onRetry,
  isRetrying = false,
  className,
}: {
  title: string;
  error: unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}) {
  return (
    <ErrorAlert
      title={title}
      message={getReportingErrorMessage(error)}
      onRetry={onRetry}
      retryLabel="Thử lại"
      isRetrying={isRetrying}
      className={className}
    />
  );
}

export function ReportingEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="py-10 px-4 text-center rounded-lg border border-dashed border-slate-300 bg-slate-50/60">
      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center mb-2.5">
        <Inbox className="w-5 h-5" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">{description}</p>
    </div>
  );
}

export function ReportingRefetchingIndicator({ label = 'Đang cập nhật số liệu...' }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1"
    >
      <RotateCw className="w-3 h-3 animate-spin text-emerald-600" aria-hidden="true" />
      {label}
    </span>
  );
}

export function ReportingInlineNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
      <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function ReportingRefreshButton({
  onClick,
  isFetching,
  label = 'Làm mới',
}: {
  onClick: () => void;
  isFetching: boolean;
  label?: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isFetching}
      className="cursor-pointer bg-white hover:bg-slate-50"
      aria-label={label}
      leftIcon={<RotateCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />}
    >
      {label}
    </Button>
  );
}
