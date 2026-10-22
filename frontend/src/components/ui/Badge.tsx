import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'neutral';
  withDot?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  withDot = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    destructive: 'bg-red-50 text-red-700 border-red-200',
    outline: 'bg-transparent text-slate-700 border-slate-300',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const dotStyles = {
    default: 'bg-emerald-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    destructive: 'bg-red-500',
    outline: 'bg-slate-400',
    neutral: 'bg-slate-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {withDot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full', dotStyles[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export default Badge;
