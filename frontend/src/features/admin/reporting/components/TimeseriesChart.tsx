import { useState } from 'react';
import type { ReportGranularity, ReportTimeseriesPoint } from '@/types/reporting';
import {
  formatBucketLabel,
  formatDateVN,
  formatReportingNumber,
  formatShortDateVN,
} from '../utils/reporting-format';
import { GRANULARITY_LABELS } from '../utils/reporting-labels';

export interface TimeseriesChartProps {
  points: ReportTimeseriesPoint[];
  granularity: ReportGranularity;
  metricLabel: string;
  color?: string;
  emptyLabel?: string;
}

const WIDTH = 720;
const HEIGHT = 260;
const MARGIN = { top: 18, right: 14, bottom: 36, left: 54 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

export function TimeseriesChart({
  points,
  granularity,
  metricLabel,
  color = '#059669',
  emptyLabel = 'Chưa có dữ liệu trong khoảng thời gian đã chọn.',
}: TimeseriesChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const maxValue = Math.max(...values, 0);
  const step = Math.max(1, Math.ceil(maxValue / 4));
  const yMax = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((index) => index * step);
  const total = values.reduce((sum, value) => sum + value, 0);
  const peakIndex = values.indexOf(Math.max(...values));
  const peak = points[peakIndex];

  const x = (index: number) =>
    points.length === 1
      ? MARGIN.left + PLOT_WIDTH / 2
      : MARGIN.left + (index / (points.length - 1)) * PLOT_WIDTH;

  const y = (value: number) =>
    MARGIN.top + PLOT_HEIGHT - (Math.min(value, yMax) / yMax) * PLOT_HEIGHT;

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`)
    .join(' ');

  const areaPath = `M ${x(0).toFixed(2)} ${y(0).toFixed(2)} ${points
    .map((point, index) => `L ${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`)
    .join(' ')} L ${x(points.length - 1).toFixed(2)} ${y(0).toFixed(2)} Z`;

  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  const labelIndices = points
    .map((_, index) => index)
    .filter((index) => index % labelStep === 0 || index === points.length - 1);

  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const activeX = activeIndex !== null ? x(activeIndex) : 0;
  const activeY = activePoint ? y(activePoint.value) : 0;
  const tooltipWidth = 172;
  const tooltipHeight = 40;
  const tooltipX = Math.min(
    Math.max(activeX + 10, MARGIN.left),
    WIDTH - MARGIN.right - tooltipWidth
  );
  const tooltipY = Math.max(MARGIN.top, activeY - tooltipHeight - 10);

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="group"
        aria-label={`Biểu đồ ${metricLabel} ${GRANULARITY_LABELS[granularity].toLowerCase()}, tổng ${total}`}
        data-testid="reporting-timeseries"
      >
        {ticks.map((tick) => (
          <g key={`tick-${tick}`}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? '#cbd5e1' : '#f1f5f9'}
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={y(tick) + 3}
              textAnchor="end"
              fontSize={10}
              fill="#64748b"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {tick.toLocaleString('vi-VN')}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={color} fillOpacity={0.08} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((point, index) => (
          <g key={`point-${point.bucketStart}`}>
            <circle
              cx={x(index)}
              cy={y(point.value)}
              r={points.length > 60 ? 1.5 : 2.5}
              fill="#ffffff"
              stroke={color}
              strokeWidth={1.5}
            >
              <title>
                {`${formatDateVN(point.bucketStart)}: ${formatReportingNumber(point.value)}`}
              </title>
            </circle>
            <rect
              x={Math.max(MARGIN.left, x(index) - PLOT_WIDTH / Math.max(1, points.length) / 2)}
              y={MARGIN.top}
              width={PLOT_WIDTH / Math.max(1, points.length)}
              height={PLOT_HEIGHT}
              fill="transparent"
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            />
          </g>
        ))}

        {activePoint && activeIndex !== null && (
          <g pointerEvents="none">
            <line
              x1={activeX}
              x2={activeX}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_HEIGHT}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <circle cx={activeX} cy={activeY} r={4} fill={color} stroke="#ffffff" strokeWidth={1.5} />
            <g transform={`translate(${tooltipX}, ${tooltipY})`}>
              <rect width={tooltipWidth} height={tooltipHeight} rx={6} fill="#0f172a" />
              <text x={10} y={16} fontSize={10} fill="#cbd5e1">
                {formatDateVN(activePoint.bucketStart)}
              </text>
              <text
                x={10}
                y={31}
                fontSize={11}
                fill="#ffffff"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {formatReportingNumber(activePoint.value)} {metricLabel}
              </text>
            </g>
          </g>
        )}

        {labelIndices.map((index) => (
          <text
            key={`label-${points[index].bucketStart}`}
            x={x(index)}
            y={HEIGHT - 14}
            textAnchor="middle"
            fontSize={10}
            fill="#64748b"
          >
            {formatBucketLabel(points[index].bucketStart, granularity)}
          </text>
        ))}
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          Tổng trong kỳ:{' '}
          <strong className="font-mono tabular-nums text-slate-900">
            {formatReportingNumber(total)}
          </strong>{' '}
          {metricLabel.toLowerCase()}
        </span>
        {maxValue > 0 && (
          <span>
            Cao nhất:{' '}
            <strong className="font-mono tabular-nums text-slate-900">
              {formatReportingNumber(peak.value)}
            </strong>{' '}
            vào {formatShortDateVN(peak.bucketStart)}
          </span>
        )}
      </div>

      {maxValue === 0 && (
        <p className="text-xs text-slate-500 italic">
          Không có phát sinh trong kỳ. Biểu đồ hiển thị đầy đủ các mốc thời gian với giá trị 0.
        </p>
      )}

      <div className="sr-only">
        <table>
          <caption>{metricLabel} theo từng mốc thời gian</caption>
          <thead>
            <tr>
              <th scope="col">Mốc thời gian</th>
              <th scope="col">Giá trị</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={`sr-${point.bucketStart}`}>
                <td>{formatDateVN(point.bucketStart)}</td>
                <td>{point.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TimeseriesChart;
