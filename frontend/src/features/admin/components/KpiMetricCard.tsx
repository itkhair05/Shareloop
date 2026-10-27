import { cn } from '@/lib/utils';

export interface KpiMetricBreakdown {
  label: string;
  value: number;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export interface KpiMetricCardProps {
  title: string;
  value: number;
  unit?: string;
  subtitle?: string;
  breakdowns?: KpiMetricBreakdown[];
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: 'text-slate-600 bg-slate-50 border-slate-200',
  success: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  warning: 'text-amber-800 bg-amber-50 border-amber-200',
  error: 'text-rose-700 bg-rose-50 border-rose-200',
  info: 'text-sky-700 bg-sky-50 border-sky-200',
};

export function KpiMetricCard({
  title,
  value,
  unit,
  subtitle,
  breakdowns,
  className,
}: KpiMetricCardProps) {
  const formattedValue = value.toLocaleString('vi-VN');

  return (
    <div
      className={cn(
        'bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs transition-colors hover:border-slate-300',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
      </div>

      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
          {formattedValue}
        </span>
        {unit && (
          <span className="text-xs font-medium text-slate-500">{unit}</span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          {subtitle}
        </p>
      )}

      {breakdowns && breakdowns.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
          {breakdowns.map((item, idx) => (
            <span
              key={idx}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border',
                variantStyles[item.variant || 'default']
              )}
            >
              <span>{item.label}:</span>
              <strong className="font-mono tabular-nums">
                {item.value.toLocaleString('vi-VN')}
              </strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default KpiMetricCard;
