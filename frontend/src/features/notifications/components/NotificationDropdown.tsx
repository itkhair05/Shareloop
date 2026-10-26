import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, ArrowRight } from 'lucide-react';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkAllNotificationsAsRead,
} from '../hooks/use-notifications';
import { NotificationItem } from './NotificationItem';
import { Button } from '@/components/ui/Button';

export interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: countData } = useUnreadNotificationCount({ enabled: isOpen });
  const {
    data: notificationsData,
    isLoading,
    isError,
    refetch,
  } = useNotifications({ page: 0, size: 10 }, { enabled: isOpen });

  const markAllMutation = useMarkAllNotificationsAsRead();
  const unreadCount = countData?.unreadCount ?? 0;
  const notifications = notificationsData?.content ?? [];

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target as Node)
      ) {
        // If click is on the bell trigger button, let the button's onClick handle toggle
        if (target?.closest('[aria-haspopup="dialog"]')) {
          return;
        }
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      role="dialog"
      aria-label="Hộp thông báo"
    >
      {/* Dropdown Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900">Thông báo</h2>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-600 rounded-md border border-rose-100">
              {unreadCount} mới
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-1 h-auto flex flex-row items-center justify-center gap-2 [&>span]:flex [&>span]:flex-row [&>span]:items-center [&>span]:gap-1.5"
            aria-label="Đánh dấu tất cả thông báo là đã đọc"
          >
            {markAllMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <CheckCheck className="w-3 h-3 mr-1" />
            )}
            <span>Đã đọc tất cả</span>
          </Button>
        )}
      </div>

      {/* Dropdown Body */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" aria-hidden="true" />
            <span className="text-xs">Đang tải thông báo...</span>
          </div>
        ) : isError ? (
          <div className="py-8 text-center px-4 space-y-2">
            <p className="text-xs text-rose-600 font-medium">
              Không thể tải thông báo. Vui lòng thử lại.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs h-7"
            >
              Thử lại
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Bell className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-xs text-slate-500 font-medium">Bạn chưa có thông báo nào</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <NotificationItem
              key={notif.id}
              notification={notif}
              onClose={onClose}
            />
          ))
        )}
      </div>

      {/* Dropdown Footer */}
      <div className="p-2.5 border-t border-slate-100 bg-slate-50/70 text-center">
        <Link
          to="/notifications"
          onClick={onClose}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors w-full py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded-md"
        >
          <span>Xem tất cả thông báo</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export default NotificationDropdown;
