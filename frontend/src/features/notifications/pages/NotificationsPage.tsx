import { useState } from 'react';
import {
  Bell,
  CheckCheck,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Inbox,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkAllNotificationsAsRead,
} from '../hooks/use-notifications';
import { NotificationItem } from '../components/NotificationItem';
import { Button } from '@/components/ui/Button';

export function NotificationsPage() {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const { data: countData } = useUnreadNotificationCount();
  const unreadCount = countData?.unreadCount ?? 0;

  const {
    data: notificationsData,
    isLoading,
    isError,
    refetch,
  } = useNotifications({ page, size: pageSize });

  const markAllMutation = useMarkAllNotificationsAsRead();

  const notifications = notificationsData?.content ?? [];
  const totalElements = notificationsData?.totalElements ?? 0;
  const totalPages = notificationsData?.totalPages ?? 1;

  const handleMarkAllRead = async () => {
    try {
      await markAllMutation.mutateAsync();
      setSuccessBanner('Đã đánh dấu tất cả thông báo là đã đọc.');
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch {
      // Mutation handles error state, nothing to reset
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Bell className="w-5 h-5" aria-hidden="true" />
            </div>
            <span>Thông báo của bạn</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi các cập nhật về bài đăng, yêu cầu nhận đồ, tin nhắn và giao dịch của bạn.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markAllMutation.isPending}
            className="shrink-0 border-slate-200 hover:bg-slate-50 hover:text-emerald-700 text-slate-700"
            aria-label="Đánh dấu tất cả thông báo là đã đọc"
          >
            {markAllMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <CheckCheck className="w-4 h-4 text-emerald-600 mr-1.5" />
            )}
            <span>Đánh dấu tất cả đã đọc ({unreadCount})</span>
          </Button>
        )}
      </div>

      {/* Success Feedback Banner */}
      {successBanner && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 animate-in fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <span className="font-medium">{successBanner}</span>
        </div>
      )}

      {/* Error Mutation Alert */}
      {markAllMutation.isError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2 animate-in fade-in"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
          <span className="font-medium">
            Không thể cập nhật trạng thái đã đọc cho tất cả thông báo. Vui lòng thử lại.
          </span>
        </div>
      )}

      {/* Notifications List Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-600" aria-hidden="true" />
            <p className="text-sm font-medium">Đang tải danh sách thông báo...</p>
          </div>
        ) : isError ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-slate-900">
              Không thể tải danh sách thông báo
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Đã có lỗi xảy ra trong quá trình truy xuất dữ liệu. Vui lòng thử lại sau giây lát.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-2"
            >
              Thử lại
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 px-4 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto shadow-xs">
              <Inbox className="w-7 h-7" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Bạn chưa có thông báo nào
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Khi có người gửi yêu cầu đồ dùng, tin nhắn mới hoặc cập nhật giao dịch, thông báo sẽ hiển thị tại đây.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 p-2 sm:p-3 space-y-1">
            {notifications.map((notif) => (
              <NotificationItem
                key={notif.id}
                notification={notif}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!isLoading && !isError && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Hiển thị trang <span className="font-semibold text-slate-800">{page + 1}</span> /{' '}
            <span className="font-semibold text-slate-800">{totalPages}</span> ({totalElements} thông báo)
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              disabled={page === 0}
              className="text-xs"
              aria-label="Trang trước"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span>Trước</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
              disabled={page >= totalPages - 1}
              className="text-xs"
              aria-label="Trang sau"
            >
              <span>Sau</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationsPage;
