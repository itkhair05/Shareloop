import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useUnreadNotificationCount } from '../hooks/use-notifications';
import { NotificationDropdown } from './NotificationDropdown';
import { cn } from '@/lib/utils';

export interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const { isAuthenticated } = useAuth();

  const { data: countData } = useUnreadNotificationCount({
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 30000 : false,
  });

  const unreadCount = countData?.unreadCount ?? 0;
  const displayCount = unreadCount > 99 ? '99+' : unreadCount;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <button
        ref={bellRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer',
          isOpen && 'bg-slate-100 text-slate-900'
        )}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0
            ? `Thông báo: ${unreadCount} chưa đọc`
            : 'Thông báo: Không có thông báo mới'
        }
      >
        <Bell className="w-5 h-5" aria-hidden="true" />

        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full border-2 border-white shadow-xs animate-in zoom-in-75 duration-150"
            aria-hidden="true"
          >
            {displayCount}
          </span>
        )}
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <NotificationDropdown
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            triggerRef={bellRef}
          />,
          document.body
        )}
    </div>
  );
}

export default NotificationBell;