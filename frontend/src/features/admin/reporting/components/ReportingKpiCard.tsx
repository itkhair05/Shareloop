import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';
// Định nghĩa các bảng màu cho thẻ
const colorStyles = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-100' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-100' },
};

export interface ReportingKpiCardProps {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  // Thêm 2 prop mới: icon và color
  icon?: LucideIcon;
  color?: keyof typeof colorStyles;
  className?: string;
}

export function ReportingKpiCard({
  label,
  value,
  unit,
  detail,
  icon: Icon,
  color = 'slate', // Mặc định màu xám nếu không truyền
  className,
}: ReportingKpiCardProps) {
  const styles = colorStyles[color];

  return (
    <div
      className={cn(
        'bg-white border rounded-xl p-4 sm:p-5 shadow-sm transition-all hover:shadow-md min-w-0',
        styles.border, // Dùng màu viền theo tone
        className
      )}
    >
      {/* Header: Icon (nếu có) + Label */}
      <div className="flex items-center gap-3 mb-3">
        {Icon && (
          <div className={cn('p-2 rounded-lg shrink-0', styles.bg, styles.text)}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        )}
        <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
          {label}
        </h3>
      </div>

      {/* Con số chính */}
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums break-words">
          {value}
        </span>
        {unit && <span className="text-xs font-medium text-slate-500">{unit}</span>}
      </div>

      {/* Chi tiết phụ (nếu có) */}
      {detail && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
        </div>
      )}
    </div>
  );
}

export default ReportingKpiCard;