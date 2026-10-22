import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

/**
 * Accessible Loading Spinner
 */
export function LoadingSpinner({
  size = 'md',
  label = 'Loading...',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}) {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center gap-2 text-slate-500', className)}
    >
      <Loader2 className={cn('animate-spin text-emerald-600', sizeMap[size])} aria-hidden="true" />
      <span className="text-sm font-medium">{label}</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Empty State Container
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  className,
}: {
  title: string;
  description: string;
  icon?: React.ElementType;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50',
        className
      )}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center mb-3">
          <Icon className="w-6 h-6" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Recoverable Error Alert with Retry Action
 */
export function ErrorAlert({
  title = 'Something went wrong',
  message,
  onRetry,
  isRetrying = false,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3',
        className
      )}
    >
      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-red-950">{title}</h4>
        <p className="text-sm text-red-800 mt-0.5 leading-relaxed">{message}</p>
        {onRetry && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              isLoading={isRetrying}
              leftIcon={<RotateCw className="w-3.5 h-3.5" />}
              className="bg-white border-red-200 text-red-800 hover:bg-red-100"
            >
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Informative or Warning Status Banner
 */
export function StatusBanner({
  type = 'info',
  message,
  className,
}: {
  type?: 'info' | 'warning' | 'success';
  message: string;
  className?: string;
}) {
  const styles = {
    info: 'bg-sky-50 border-sky-200 text-sky-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  };

  const icons = {
    info: <Info className="w-4 h-4 text-sky-600 shrink-0" aria-hidden="true" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />,
  };

  return (
    <div
      className={cn('p-3 rounded-lg border text-sm flex items-center gap-2.5', styles[type], className)}
    >
      {icons[type]}
      <span className="font-medium">{message}</span>
    </div>
  );
}
