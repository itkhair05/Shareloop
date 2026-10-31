import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  MessageSquare,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorAlert, LoadingSpinner } from '@/components/ui/Feedback';
import { useListingRequests, useUpdateRequestStatus } from '../hooks/use-requests';
import { formatDateTime } from '@/lib/utils';
import { ApiError } from '@/lib/api-error';
import type { ListingResponse } from '@/types/listing';
import type { ListingRequestResponse, ListingRequestStatus } from '@/types/request';

export interface ListingRequestsManagerProps {
  listing: ListingResponse;
  onRequestUpdated?: () => void;
}

const PAGE_SIZE = 5;

const requestStatusConfig: Record<
  ListingRequestStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'neutral' }
> = {
  PENDING: { label: 'Chờ phản hồi', variant: 'warning' },
  ACCEPTED: { label: 'Đã chấp nhận', variant: 'success' },
  REJECTED: { label: 'Đã từ chối', variant: 'destructive' },
  WITHDRAWN: { label: 'Đã rút lại', variant: 'neutral' },
  CANCELLED: { label: 'Đã hủy', variant: 'neutral' },
};

export function ListingRequestsManager({
  listing,
  onRequestUpdated,
}: ListingRequestsManagerProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Dialog states for confirming accept / reject
  const [requestToAccept, setRequestToAccept] = useState<ListingRequestResponse | null>(null);
  const [requestToReject, setRequestToReject] = useState<ListingRequestResponse | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useListingRequests(
    listing.id,
    {
      page: currentPage,
      size: PAGE_SIZE,
    }
  );

  const updateStatusMutation = useUpdateRequestStatus();

  const handleConfirmAccept = async () => {
    if (!requestToAccept) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      await updateStatusMutation.mutateAsync({
        requestId: requestToAccept.id,
        payload: { status: 'ACCEPTED' },
      });
      setActionSuccess(
        `Đã chấp nhận yêu cầu của "${requestToAccept.requester.displayName}". Bài đăng đã được chuyển sang trạng thái Đã đặt trước.`
      );
      setRequestToAccept(null);
      if (onRequestUpdated) onRequestUpdated();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(
          err.message || 'Không thể chấp nhận yêu cầu này. Có thể bài đăng đã có giao dịch đang hoạt động.'
        );
      } else {
        setActionError('Đã xảy ra lỗi không xác định khi chấp nhận yêu cầu.');
      }
    }
  };

  const handleConfirmReject = async () => {
    if (!requestToReject) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      await updateStatusMutation.mutateAsync({
        requestId: requestToReject.id,
        payload: { status: 'REJECTED' },
      });
      setActionSuccess(
        `Đã từ chối yêu cầu của "${requestToReject.requester.displayName}".`
      );
      setRequestToReject(null);
      if (onRequestUpdated) onRequestUpdated();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.message || 'Không thể từ chối yêu cầu này.');
      } else {
        setActionError('Đã xảy ra lỗi không xác định khi từ chối yêu cầu.');
      }
    }
  };

  const requests = data?.content || [];
  const totalElements = data?.totalElements || 0;
  const totalPages = data?.totalPages || 0;
  const isListingActive = listing.status === 'ACTIVE';

  return (
    <section
      aria-label="Quản lý yêu cầu nhận món từ cộng đồng"
      className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              Yêu cầu từ cộng đồng
            </h2>
            <Badge variant="neutral" className="text-xs font-semibold px-2">
              {totalElements} yêu cầu
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Xem xét và phản hồi các yêu cầu nhận đồ hoặc đề nghị mua được gửi đến bài đăng của bạn.
          </p>
        </div>

        {isFetching && !isLoading && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <LoadingSpinner size="sm" label="Đang cập nhật..." />
          </div>
        )}
      </div>

      {/* Warning banner when listing is RESERVED or not ACTIVE */}
      {!isListingActive && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="leading-relaxed">
            <span className="font-bold">Lưu ý:</span> Bài đăng hiện ở trạng thái{' '}
            <span className="font-semibold underline">{listing.status}</span>. Bạn không thể chấp nhận
            thêm yêu cầu khác trừ khi giao dịch trước đó bị hủy.
          </div>
        </div>
      )}

      {/* Success notification */}
      {actionSuccess && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start justify-between gap-2.5 animate-in fade-in"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="font-medium leading-relaxed">{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 p-0.5 rounded cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error notification */}
      {actionError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start justify-between gap-2.5 animate-in fade-in"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="font-medium leading-relaxed">{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-700 hover:text-red-900 p-0.5 rounded cursor-pointer"
            aria-label="Đóng thông báo lỗi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="py-12 flex justify-center items-center">
          <LoadingSpinner size="md" label="Đang tải danh sách yêu cầu..." />
        </div>
      ) : isError ? (
        <ErrorAlert
          title="Không thể tải danh sách yêu cầu"
          message={
            error?.message || 'Đã xảy ra lỗi khi kết nối tới máy chủ. Vui lòng thử lại.'
          }
          onRetry={() => refetch()}
          retryLabel="Tải lại"
          isRetrying={isFetching}
        />
      ) : requests.length === 0 ? (
        <EmptyState
          title="Chưa có yêu cầu nào"
          description="Bài đăng này hiện chưa nhận được yêu cầu nào từ người dùng khác."
          icon={Inbox}
        />
      ) : (
        /* Requests List */
        <div className="space-y-4">
          {requests.map((request) => {
            const statusConfig = requestStatusConfig[request.status] || {
              label: request.status,
              variant: 'neutral' as const,
            };
            const isPending = request.status === 'PENDING';
            const canAccept = isPending && isListingActive;

            return (
              <div
                key={request.id}
                className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-3"
              >
                {/* Header: Requester Name, Date, Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar
                      avatarUrl={request.requester.avatarUrl}
                      name={request.requester.displayName}
                      size="sm"
                      alt={
                        request.requester.displayName
                          ? `Ảnh đại diện của ${request.requester.displayName}`
                          : 'Ảnh đại diện người dùng'
                      }
                      className="shrink-0"
                    />
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">
                        {request.requester.displayName}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                        <time dateTime={request.createdAt}>
                          {formatDateTime(request.createdAt)}
                        </time>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Badge variant={statusConfig.variant} className="text-xs font-semibold">
                      {statusConfig.label}
                    </Badge>
                  </div>
                </div>

                {/* Optional Message */}
                {request.message ? (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs sm:text-sm text-slate-700 leading-relaxed flex items-start gap-2">
                    <MessageSquare
                      className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <p className="whitespace-pre-line break-words flex-1 italic">
                      "{request.message}"
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic pl-1">
                    (Người yêu cầu không để lại lời nhắn)
                  </p>
                )}

                {/* Actions (Only for PENDING requests) */}
                {isPending && (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRequestToReject(request)}
                      disabled={updateStatusMutation.isPending}
                      className="flex flex-row items-center justify-center gap-2 text-slate-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 [&>span]:flex [&>span]:flex-row [&>span]:items-center [&>span]:gap-1.5"
                    >
                      <X className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                      <span>Từ chối</span>
                    </Button>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setRequestToAccept(request)}
                      disabled={!canAccept || updateStatusMutation.isPending}
                      title={
                        !canAccept
                          ? 'Không thể chấp nhận vì bài đăng không ở trạng thái Đang hiển thị'
                          : undefined
                      }
                      className={`flex flex-row items-center justify-center gap-2 [&>span]:flex [&>span]:flex-row [&>span]:items-center [&>span]:gap-1.5 ${
                        !canAccept ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Chấp nhận</span>
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500">
              <div>
                Trang {currentPage + 1} / {totalPages} ({totalElements} yêu cầu)
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0 || isFetching}
                  className="px-2.5"
                  aria-label="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1 || isFetching}
                  className="px-2.5"
                  aria-label="Trang kế tiếp"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog: Accept Request */}
      {requestToAccept && (
        <ConfirmDialog
          isOpen={Boolean(requestToAccept)}
          onClose={() => setRequestToAccept(null)}
          onConfirm={handleConfirmAccept}
          title="Chấp nhận yêu cầu này?"
          message={
            <span>
              Bạn có chắc chắn muốn chấp nhận yêu cầu từ{' '}
              <strong className="text-slate-900">{requestToAccept.requester.displayName}</strong>?
              <br />
              <br />
              Khi chấp nhận, bài đăng này sẽ tự động chuyển sang trạng thái{' '}
              <strong className="text-emerald-700">Đã đặt trước</strong> và một giao dịch mới sẽ được
              tạo giữa bạn và người nhận.
            </span>
          }
          confirmText="Chấp nhận yêu cầu"
          cancelText="Đóng"
          variant="primary"
          isLoading={updateStatusMutation.isPending}
        />
      )}

      {/* Confirmation Dialog: Reject Request */}
      {requestToReject && (
        <ConfirmDialog
          isOpen={Boolean(requestToReject)}
          onClose={() => setRequestToReject(null)}
          onConfirm={handleConfirmReject}
          title="Từ chối yêu cầu này?"
          message={
            <span>
              Bạn có chắc chắn muốn từ chối yêu cầu từ{' '}
              <strong className="text-slate-900">{requestToReject.requester.displayName}</strong>?
              <br />
              <br />
              Bài đăng vẫn sẽ tiếp tục hiển thị để đón nhận các yêu cầu khác từ cộng đồng.
            </span>
          }
          confirmText="Từ chối yêu cầu"
          cancelText="Hủy"
          variant="danger"
          isLoading={updateStatusMutation.isPending}
        />
      )}
    </section>
  );
}

export default ListingRequestsManager;
