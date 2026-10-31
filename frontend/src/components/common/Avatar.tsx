import React, { useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import { cn, resolveImageUrl } from '@/lib/utils';
import { getInitials } from '@/lib/avatar';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Effective avatar image URL (custom avatar or Google avatar) */
  avatarUrl?: string | null;
  /** User display name used for initials fallback */
  name?: string | null;
  /** Size variant */
  size?: AvatarSize;
  /** Custom class names to merge onto outer container */
  className?: string;
  /** Accessible label/alt text for the avatar */
  alt?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-24 h-24 text-3xl',
};

const iconSizes: Record<AvatarSize, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
  '2xl': 'w-12 h-12',
};

/**
 * Reusable, production-quality Avatar component for ShareLoop.
 *
 * Rendering Priority:
 * 1. Resolved effective avatar URL (`avatarUrl`).
 * 2. Uppercase Initials derived from `name` (Unicode and Vietnamese name safe).
 * 3. Default neutral visual icon fallback (`User` icon from lucide-react).
 */
export function Avatar({
  avatarUrl,
  name,
  size = 'md',
  className,
  alt,
  ...props
}: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const resolvedUrl = resolveImageUrl(avatarUrl);
  const initials = getInitials(name);
  const accessibleLabel = alt || name || 'Ảnh đại diện người dùng';

  const hasImageError = Boolean(resolvedUrl && failedUrl === resolvedUrl);
  const shouldRenderImage = Boolean(resolvedUrl && !hasImageError);

  return (
    <div
      {...(!shouldRenderImage ? { role: 'img', 'aria-label': accessibleLabel } : {})}
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 rounded-full aspect-square overflow-hidden select-none',
        'bg-slate-100 text-slate-700 border border-slate-200/80',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {shouldRenderImage ? (
        <img
          src={resolvedUrl!}
          alt={accessibleLabel}
          className="w-full h-full object-cover rounded-full"
          onError={() => setFailedUrl(resolvedUrl)}
          referrerPolicy="no-referrer"
        />
      ) : initials ? (
        <span
          className="font-semibold tracking-tight text-emerald-800 leading-none select-none uppercase"
          aria-hidden="true"
        >
          {initials}
        </span>
      ) : (
        <UserIcon
          className={cn(iconSizes[size], 'text-slate-400 shrink-0')}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default Avatar;
