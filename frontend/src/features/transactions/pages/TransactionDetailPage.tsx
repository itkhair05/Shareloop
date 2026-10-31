import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Handshake,
  MapPin,
  Package,
  RotateCw,
  ShieldCheck,
  Star,
  XCircle,
  LifeBuoy,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/common/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorAlert, LoadingSpinner } from '@/components/ui/Feedback';
import {
  useCompleteTransaction,
  useTransactionDetails,
} from '../hooks/use-transactions';
import { CancelTransactionModal } from '../components/CancelTransactionModal';
import { CreateReviewModal, useTransactionReviews } from '@/features/reviews';
import { CreateSupportRequestModal } from '@/features/support';
import { CreateReportModal } from '@/features/reports';
import { useAuth } from '@/features/auth';
import { formatDateTime, formatPrice, isValidUuid } from '@/lib/utils';
import type { TransactionStatus } from '@/types/transaction';
import { ApiError } from '@/lib/api-error';

const statusBadgeConfig: Record<
  TransactionStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'neutral' }
> = {
  PENDING: { label: 'Chờ bàn giao', variant: 'warning' },
  IN_PROGRESS: { label: 'Đang thực hiện', variant: 'default' },
  COMPLETED: { label: 'Đã hoàn tất', variant: 'success' },
  CANCELLED: { label: 'Đã hủy', variant: 'destructive' },
};

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isConfirmCompleteOpen, setIsConfirmCompleteOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const isIdValid = Boolean(id && isValidUuid(id));

  const {
    data: transaction,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useTransactionDetails(id);

  const completeMutation = useCompleteTransaction();

  const { data: transactionReviews } = useTransactionReviews(
    id,
    Boolean(transaction?.status === 'COMPLETED')
  );

  // Handle invalid UUID early
  if (!isIdValid) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <EmptyState
          title="Mã giao dịch không hợp lệ"
          description="Đường dẫn giao dịch không đúng định dạng. Vui lòng kiểm tra lại liên kết hoặc quay lại danh sách giao dịch."
          icon={Package}
          actionLabel="Quay lại danh sách giao dịch"
          onAction={() => navigate('/transactions')}
        />
      </div>
    );
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-9 w-24 bg-slate-200 animate-pulse rounded-lg" />
          <div className="h-4 w-48 bg-slate-200 animate-pulse rounded" />
        </div>
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center">
          <LoadingSpinner size="lg" label="Đang tải thông tin giao dịch..." />
        </div>
      </div>
    );
  }

  // Error State
  if (isError || !transaction) {
    const is404 = error?.status === 404;
    const is403 = error?.status === 403;

    if (is404) {
      return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <EmptyState
            title="Không tìm thấy giao dịch"
            description="Giao dịch này không tồn tại hoặc đã bị xóa khỏi hệ thống."
            icon={Package}
            actionLabel="Quay lại danh sách giao dịch"
            onAction={() => navigate('/transactions')}
          />
        </div>
      );
    }

    if (is403) {
      return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <EmptyState
            title="Không có quyền truy cập"
            description="Bạn không phải là người tham gia hoặc không có quyền xem thông tin giao dịch này."
            icon={ShieldCheck}
            actionLabel="Quay lại danh sách giao dịch"
            onAction={() => navigate('/transactions')}
          />
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-4">
        <ErrorAlert
          title="Không thể tải thông tin giao dịch"
          message={
            error?.message ||
            'Đã xảy ra lỗi trong quá trình tải dữ liệu. Vui lòng kiểm tra lại kết nối.'
          }
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
        <Button variant="outline" size="sm" onClick={() => navigate('/transactions')}>
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  const { listing, status, owner, requester, myRole } = transaction;

  const isOwner = myRole === 'OWNER';
  const isRequester = myRole === 'REQUESTER';
  const isAdmin = user?.role === 'ADMIN' || myRole === 'ADMIN';

  // Completion Eligibility:
  // ONLY participants (isOwner or isRequester) can confirm. Admin cannot confirm completion.
  // Transaction must be in PENDING or IN_PROGRESS.
  // Current participant must NOT have already confirmed.
  const isParticipant = isOwner || isRequester;
  const isAlreadyConfirmedByMe =
    (isOwner && transaction.ownerCompleted) || (isRequester && transaction.requesterCompleted);

  const canComplete =
    isParticipant &&
    !isAlreadyConfirmedByMe &&
    (status === 'PENDING' || status === 'IN_PROGRESS');

  // Cancellation Eligibility:
  // Allowed for owner, requester, or ADMIN.
  // Status must be PENDING or IN_PROGRESS.
  const canCancel = (isOwner || isRequester || isAdmin) && (status === 'PENDING' || status === 'IN_PROGRESS');

  // Review Eligibility:
  // ONLY participants (isOwner or isRequester) can review. Admin cannot review on behalf of participants.
  // Transaction must be in COMPLETED status.
  const canReview = status === 'COMPLETED' && isParticipant;

  const myExistingReview = transactionReviews?.find(
    (r) => r.reviewer?.id === user?.id
  );
  const hasReviewed = Boolean(myExistingReview);

  const statusConfig = statusBadgeConfig[status] || {
    label: status,
    variant: 'neutral' as const,
  };

  const roleBadgeText = isOwner
    ? 'Bạn là Người cho / bán'
    : isRequester
    ? 'Bạn là Người nhận / mua'
    : isAdmin
    ? 'Quản trị viên'
    : 'Thành viên';

  const handleConfirmComplete = async () => {
    setActionErrorMessage(null);
    try {
      await completeMutation.mutateAsync(transaction.id);
      setIsConfirmCompleteOpen(false);
      setActionSuccessMessage('Đã xác nhận hoàn thành bàn giao thành công!');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionErrorMessage(
          err.message || 'Không thể xác nhận hoàn thành giao dịch. Vui lòng thử lại.'
        );
      } else {
        setActionErrorMessage('Đã xảy ra lỗi khi hoàn tất giao dịch.');
      }
      setIsConfirmCompleteOpen(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      {/* Navigation Header */}
      <div className="flex flex-row items-center gap-3 md:gap-4 overflow-hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/transactions')}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          className="shrink-0 rounded-full border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          Quay lại danh sách
        </Button>
        <nav aria-label="Điều hướng giao dịch" className="text-xs text-slate-500 truncate">
          <Link to="/transactions" className="hover:text-emerald-700">
            Giao dịch của tôi
          </Link>
          <span className="mx-1.5 text-slate-400">/</span>
          <span className="text-slate-800 font-semibold truncate">Mã #{transaction.id.slice(0, 8)}</span>
        </nav>
      </div>

      {/* Main Title & Status Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Chi tiết giao dịch
              </h1>
              <Badge variant={statusConfig.variant} className="text-xs font-semibold px-2.5 py-0.5">
                {statusConfig.label}
              </Badge>
              <Badge variant="neutral" className="text-xs px-2 py-0.5 font-medium">
                {roleBadgeText}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Mã giao dịch: <span className="font-mono text-slate-700">{transaction.id}</span>
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            leftIcon={<RotateCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />}
            className="self-start sm:self-auto text-xs"
          >
            {isFetching ? 'Đang cập nhật...' : 'Làm mới'}
          </Button>
        </div>

        {/* Action Success Alert */}
        {actionSuccessMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span className="font-medium">{actionSuccessMessage}</span>
          </div>
        )}

        {/* Action Error Alert */}
        {actionErrorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-center gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
            <span className="font-medium">{actionErrorMessage}</span>
          </div>
        )}

        {/* Section 1: Listing Information Card */}
        <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-4 sm:p-5 space-y-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Món đồ giao dịch
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 mt-0.5">
              <Package className="w-6 h-6" aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/listings/${listing.id}`}
                  className="text-base sm:text-lg font-bold text-slate-900 hover:text-emerald-700 transition-colors flex items-center gap-1.5 group"
                >
                  <span>{listing.title}</span>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 shrink-0" />
                </Link>
                <Badge
                  variant={listing.listingType === 'GIVEAWAY' ? 'success' : 'warning'}
                  className="text-xs"
                >
                  {listing.listingType === 'GIVEAWAY' ? 'Cho tặng' : 'Thanh lý'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-0.5">
                {listing.price !== null && listing.price !== undefined && (
                  <span className="font-semibold text-emerald-700">
                    Giá: {formatPrice(listing.price, listing.currency || 'VND')}
                  </span>
                )}
                {listing.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{listing.city}</span>
                  </span>
                )}
                <span className="text-slate-400">•</span>
                <span>Người đăng: <strong>{listing.owner.displayName}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Dual Confirmation Handoff Progress */}
        <div className="border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Handshake className="w-5 h-5 text-emerald-600 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Tiến độ xác nhận bàn giao trực tiếp
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Owner Confirmation */}
            <div
              className={`p-4 rounded-xl border ${
                transaction.ownerCompleted
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              } space-y-2`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Bên cho / bán</span>
                {transaction.ownerCompleted ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Đã xác nhận
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-4 h-4" />
                    Chưa xác nhận
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5 pt-0.5">
                <Avatar
                  avatarUrl={owner.avatarUrl}
                  name={owner.displayName}
                  size="sm"
                  alt={`Ảnh đại diện của ${owner.displayName}`}
                  className="shrink-0 shadow-xs"
                />
                <div className="text-sm font-bold truncate">{owner.displayName}</div>
              </div>
              {transaction.ownerCompleted && transaction.ownerCompletedAt && (
                <div className="text-[11px] text-emerald-700">
                  Thời gian: {formatDateTime(transaction.ownerCompletedAt)}
                </div>
              )}
            </div>

            {/* Step 2: Requester Confirmation */}
            <div
              className={`p-4 rounded-xl border ${
                transaction.requesterCompleted
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              } space-y-2`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Bên nhận / mua</span>
                {transaction.requesterCompleted ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Đã xác nhận
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-4 h-4" />
                    Chưa xác nhận
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5 pt-0.5">
                <Avatar
                  avatarUrl={requester.avatarUrl}
                  name={requester.displayName}
                  size="sm"
                  alt={`Ảnh đại diện của ${requester.displayName}`}
                  className="shrink-0 shadow-xs"
                />
                <div className="text-sm font-bold truncate">{requester.displayName}</div>
              </div>
              {transaction.requesterCompleted && transaction.requesterCompletedAt && (
                <div className="text-[11px] text-emerald-700">
                  Thời gian: {formatDateTime(transaction.requesterCompletedAt)}
                </div>
              )}
            </div>
          </div>

          {/* Status Progress Explanatory Banner */}
          <div className="pt-1">
            {status === 'COMPLETED' && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>
                    Giao dịch đã được cả hai bên xác nhận hoàn tất. Bài đăng đã chuyển sang trạng thái đã hoàn thành.
                  </span>
                </div>

                {/* Review Prompt or Completed Review */}
                {canReview && (
                  <div>
                    {hasReviewed ? (
                      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 border border-amber-200">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          </div>
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
                              Đánh giá của bạn
                            </div>
                            <div className="text-sm font-semibold text-slate-900 mt-0.5 flex items-center gap-2">
                              <span>{myExistingReview?.rating} sao</span>
                              {myExistingReview?.comment && (
                                <span className="text-xs text-slate-500 font-normal italic truncate max-w-xs">
                                  &quot;{myExistingReview.comment}&quot;
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge variant="success" className="shrink-0 self-start sm:self-center font-semibold">
                          Đã đánh giá
                        </Badge>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 border border-amber-200">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                              Trải nghiệm giao dịch
                            </div>
                            <div className="text-xs text-amber-800 mt-0.5">
                              Giao dịch đã hoàn tất! Hãy để lại đánh giá cho đối phương để xây dựng uy tín cộng đồng.
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => setIsReviewModalOpen(true)}
                          className="w-full sm:w-auto shrink-0 flex flex-row items-center justify-center gap-2 [&>span]:flex [&>span]:flex-row [&>span]:items-center [&>span]:gap-1.5 bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500"
                        >
                          <Star className="w-4 h-4 fill-white text-white" aria-hidden="true" />
                          <span>Viết đánh giá</span>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {status === 'IN_PROGRESS' && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-blue-600 shrink-0" />
                <span>
                  {isAlreadyConfirmedByMe
                    ? 'Bạn đã hoàn tất xác nhận bàn giao. Đang chờ đối phương xác nhận để hoàn tất giao dịch.'
                    : 'Đối phương đã xác nhận hoàn thành bàn giao. Vui lòng bấm "Xác nhận bàn giao thành công" bên dưới nếu bạn đã nhận/trao món đồ.'}
                </span>
              </div>
            )}

            {status === 'PENDING' && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-slate-500 shrink-0" />
                <span>
                  Giao dịch mới được tạo. Hai bên vui lòng hẹn gặp mặt tại địa điểm an toàn để bàn giao món đồ và xác nhận.
                </span>
              </div>
            )}

            {status === 'CANCELLED' && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-950 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-red-900 flex-wrap">
                  <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                  {transaction.cancelledBy && (
                    <Avatar
                      avatarUrl={transaction.cancelledBy.avatarUrl}
                      name={transaction.cancelledBy.displayName}
                      size="xs"
                      alt={`Ảnh đại diện của ${transaction.cancelledBy.displayName}`}
                      className="shrink-0 -my-0.5"
                    />
                  )}
                  <span>
                    Giao dịch đã bị hủy
                    {transaction.cancelledBy ? ` bởi ${transaction.cancelledBy.displayName}` : ''}
                  </span>
                </div>
                {transaction.cancellationReason && (
                  <p className="text-red-800 pl-7">
                    Lý do: &quot;{transaction.cancellationReason}&quot;
                  </p>
                )}
                {transaction.cancelledAt && (
                  <p className="text-red-600 text-[11px] pl-7">
                    Thời gian hủy: {formatDateTime(transaction.cancelledAt)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Action Buttons */}
        {(canComplete || canCancel) && (
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100">
            {canCancel && (
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsCancelModalOpen(true)}
                className="w-full sm:w-auto text-red-700 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                Hủy giao dịch
              </Button>
            )}

            {canComplete && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsConfirmCompleteOpen(true)}
                isLoading={completeMutation.isPending}
                disabled={completeMutation.isPending}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Xác nhận bàn giao thành công
              </Button>
            )}
          </div>
        )}

        {/* Support & Report Action Bar for Transaction Participants */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 flex items-center gap-1.5">
            <LifeBuoy className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <span>Gặp trở ngại hoặc có nghi vấn về giao dịch này?</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsSupportModalOpen(true)}
              leftIcon={<LifeBuoy className="w-3.5 h-3.5 text-emerald-600" />}
              className="text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 cursor-pointer"
            >
              Yêu cầu hỗ trợ
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsReportModalOpen(true)}
              leftIcon={<ShieldAlert className="w-3.5 h-3.5 text-red-500" />}
              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
            >
              Báo cáo vi phạm
            </Button>
          </div>
        </div>

        {/* Section 4: Timestamps & Meta */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Ngày tạo: {formatDateTime(transaction.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Cập nhật lần cuối: {formatDateTime(transaction.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Completing Transaction */}
      <ConfirmDialog
        isOpen={isConfirmCompleteOpen}
        onClose={() => setIsConfirmCompleteOpen(false)}
        onConfirm={handleConfirmComplete}
        title="Xác nhận bàn giao món đồ"
        message={
          <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
            <p>
              Bạn đang xác nhận rằng món đồ{' '}
              <strong className="text-slate-900">&quot;{listing.title}&quot;</strong> đã được bàn giao
              trực tiếp thành công ngoài đời thực.
            </p>
            <p className="font-semibold text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              Lưu ý: Đây là xác nhận bàn giao vật lý giữa hai người dùng, không phải giao dịch chuyển tiền trực tuyến. Sau khi cả hai bên xác nhận, bài đăng sẽ chuyển sang hoàn thành.
            </p>
          </div>
        }
        confirmText="Tôi đã bàn giao xong"
        cancelText="Đóng"
        variant="primary"
        isLoading={completeMutation.isPending}
      />

      {/* Cancel Transaction Modal */}
      <CancelTransactionModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        transaction={transaction}
        isAdmin={isAdmin}
        onSuccess={() => {
          setActionSuccessMessage('Đã hủy giao dịch thành công.');
        }}
      />

      {/* Create Review Modal */}
      {canReview && (
        <CreateReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          transaction={transaction}
          onSuccess={() => {
            setActionSuccessMessage('Cảm ơn bạn đã gửi đánh giá cho giao dịch này!');
          }}
        />
      )}

      {/* Support Request Modal */}
      <CreateSupportRequestModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        defaultTransactionId={transaction.id}
        defaultCategory="TRANSACTION_ISSUE"
      />

      {/* Violation Report Modal */}
      <CreateReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        targetType="TRANSACTION"
        targetId={transaction.id}
        targetTitle={`Giao dịch #${transaction.id.substring(0, 8)} (${listing.title})`}
      />
    </div>
  );
}

export default TransactionDetailPage;
