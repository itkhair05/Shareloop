import { cn } from '@/lib/utils';
import { formatReportingNumber, formatShare } from '../utils/reporting-format';

export interface DistributionBarItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface DistributionBarsProps {
  items: DistributionBarItem[];
  total?: number;
  emptyLabel?: string;
  valueSuffix?: string;
  className?: string;
  ariaLabel?: string;
}

export function DistributionBars({
  items,
  total,
  emptyLabel = 'Chưa có dữ liệu trong kỳ.',
  valueSuffix,
  className,
  ariaLabel = 'Phân bố số liệu',
}: DistributionBarsProps) {
  const computedTotal = total ?? items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className={cn('space-y-3', className)}>
      <div role="list" aria-label={ariaLabel} className="space-y-3">
        {items.map((item) => (
          <div key={item.key} role="listitem" className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium text-slate-700 truncate" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-slate-600">
                <strong className="font-semibold text-slate-900">
                  {formatReportingNumber(item.value)}
                </strong>
                {valueSuffix ? ` ${valueSuffix}` : ''}
                <span className="ml-1.5 text-[11px] text-slate-400">
                  ({formatShare(item.value, computedTotal)})
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: computedTotal > 0 ? `${(item.value / computedTotal) * 100}%` : '0%',
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {computedTotal === 0 && (
        <p className="text-xs text-slate-500 italic pt-1">{emptyLabel}</p>
      )}

      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Hạng mục</th>
              <th scope="col">Giá trị</th>
              <th scope="col">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`sr-${item.key}`}>
                <td>{item.label}</td>
                <td>{item.value}</td>
                <td>{formatShare(item.value, computedTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DistributionBars;
