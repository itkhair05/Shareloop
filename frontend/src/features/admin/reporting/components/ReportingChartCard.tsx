import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export interface ReportingChartCardProps {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function ReportingChartCard({
  title,
  description,
  meta,
  children,
  className,
  contentClassName,
}: ReportingChartCardProps) {
  return (
    <Card className={cn('flex flex-col h-full border-slate-200 shadow-xs min-w-0', className)}>
      <CardHeader className="p-4 sm:p-5 pb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="text-sm sm:text-base font-semibold text-slate-900">
            {title}
          </CardTitle>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
        {meta && <div className="shrink-0">{meta}</div>}
      </CardHeader>

      <CardContent className={cn('p-4 sm:p-5 pt-2 flex-1 min-w-0', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

export default ReportingChartCard;
