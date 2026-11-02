import { formatReportingNumber, formatShare } from '../utils/reporting-format';

export interface DonutChartItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  items: DonutChartItem[];
  centerLabel: string;
  centerValue?: string;
  ariaLabel: string;
  emptyLabel?: string;
}

export function DonutChart({
  items,
  centerLabel,
  centerValue,
  ariaLabel,
  emptyLabel = 'Chưa có dữ liệu trong kỳ.',
}: DonutChartProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const visibleItems = items.filter((item) => item.value > 0);
  const segments = visibleItems.map((item, index) => {
    const previousValue = visibleItems
      .slice(0, index)
      .reduce((sum, previous) => sum + previous.value, 0);
    const length = (item.value / total) * circumference;

    return {
      ...item,
      dash: Math.max(0, length - (visibleItems.length > 1 ? 2 : 0)),
      offset: -((previousValue / total) * circumference),
    };
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-center gap-5">
      <div className="relative w-40 h-40 mx-auto">
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 140 140"
          role="img"
          aria-label={ariaLabel}
          data-testid="reporting-donut"
        >
          <circle cx="70" cy="70" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
          {segments.map((segment) => (
            <circle
              key={segment.key}
              cx="70"
              cy="70"
              r={radius}
              fill="transparent"
              stroke={segment.color}
              strokeWidth="18"
              strokeDasharray={`${segment.dash} ${circumference}`}
              strokeDashoffset={segment.offset}
              strokeLinecap="butt"
            >
              <title>{`${segment.label}: ${segment.value}`}</title>
            </circle>
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 leading-none">
            {centerValue ?? formatReportingNumber(total)}
          </span>
          <span className="text-[11px] font-medium text-slate-500 mt-1 px-2">{centerLabel}</span>
        </div>
      </div>

      <div className="space-y-1.5 min-w-0">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-3 text-xs py-1 px-1 rounded hover:bg-slate-50"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="text-slate-700 font-medium truncate" title={item.label}>
                {item.label}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
              <span className="font-semibold text-slate-900">
                {formatReportingNumber(item.value)}
              </span>
              <span className="text-slate-400 text-[11px] w-11 text-right">
                {formatShare(item.value, total)}
              </span>
            </div>
          </div>
        ))}

        {total === 0 && (
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
                  <td>{formatShare(item.value, total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DonutChart;
