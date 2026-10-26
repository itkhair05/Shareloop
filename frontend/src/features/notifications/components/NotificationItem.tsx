import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Package,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { NotificationResponse, NotificationType } from '@/types/notification';
import { useMarkNotificationAsRead } from '../hooks/use-notifications';
import { formatDateTime, cn } from '@/lib/utils';

export interface NotificationItemProps {
  notification: NotificationResponse;
  onClose?: () => void;
  className?: string;
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'REQUEST_RECEIVED':
      return <Package className="w-4 h-4 text-amber-600" aria-hidden="true" />;
    case 'REQUEST_ACCEPTED':
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />;
    case 'REQUEST_REJECTED':
      return <XCircle className="w-4 h-4 text-rose-600" aria-hidden="true" />;
    case 'CHAT_MESSAGE':
      return <MessageCircle className="w-4 h-4 text-sky-600" aria-hidden="true" />;
    case 'TRANSACTION_COMPLETED':
      return <Sparkles className="w-4 h-4 text-emerald-600" aria-hidden="true" />;
    default:
      return <Bell className="w-4 h-4 text-slate-500" aria-hidden="true" />;
  }
}

export function NotificationItem({
  notification,
  onClose,
  className,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const markAsReadMutation = useMarkNotificationAsRead();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleClick = async () => {
    // 1. Mark as read if not already read
    if (!notification.isRead && !markAsReadMutation.isPending) {
      try {
        await markAsReadMutation.mutateAsync(notification.id);
      } catch {
        setFeedbackMessage('Không thể cập nhật trạng thái đã đọc.');
        return;
      }
    }

    // 2. Safe navigation based on verified reference types
    const { referenceType, referenceId } = notification;

    if (referenceType === 'TRANSACTION' && referenceId) {
      onClose?.();
      navigate(`/transactions/${referenceId}`);
      return;
    }

    if (referenceType === 'LISTING_REQUEST') {
      // Listing requests are managed by owners in My Listings
      onClose?.();
      navigate('/my-listings');
      return;
    }

    if (referenceType === 'CONVERSATION' || notification.type === 'CHAT_MESSAGE') {
      onClose?.();
      const cleanRefId = referenceId?.trim();
      if (cleanRefId && cleanRefId !== 'undefined' && cleanRefId !== 'null') {
        navigate(`/messages/${cleanRefId}`);
      } else {
        navigate('/messages');
      }
      return;
    }

    // Default fallback: stay on current page or close dropdown
    onClose?.();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        'group relative flex items-start gap-3 p-3.5 rounded-xl transition-all cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
        notification.isRead
          ? 'bg-white hover:bg-slate-50/80 text-slate-600'
          : 'bg-emerald-50/50 hover:bg-emerald-50/90 text-slate-900 border-l-4 border-l-emerald-600',
        className
      )}
      aria-label={`${notification.isRead ? 'Thông báo đã đọc' : 'Thông báo chưa đọc'}: ${notification.title}`}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-xs',
          notification.isRead ? 'bg-slate-100' : 'bg-white'
        )}
      >
        {markAsReadMutation.isPending ? (
          <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" aria-hidden="true" />
        ) : (
          getNotificationIcon(notification.type)
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              'text-xs leading-snug truncate',
              notification.isRead ? 'font-medium text-slate-700' : 'font-bold text-slate-950'
            )}
          >
            {notification.title}
          </p>
          <time
            dateTime={notification.createdAt}
            className="text-[11px] text-slate-400 whitespace-nowrap shrink-0"
          >
            {formatDateTime(notification.createdAt)}
          </time>
        </div>

        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
          {notification.message}
        </p>

        {feedbackMessage && (
          <p
            role="status"
            className="text-[11px] font-medium text-amber-700 bg-amber-50 p-1.5 rounded-md mt-1 animate-in fade-in"
          >
            {feedbackMessage}
          </p>
        )}
      </div>

      {!notification.isRead && (
        <span
          className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-2"
          aria-hidden="true"
          title="Chưa đọc"
        />
      )}
    </div>
  );
}

export default NotificationItem;
