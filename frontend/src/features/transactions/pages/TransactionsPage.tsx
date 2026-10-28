import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  Package,
  RotateCw,
  Search,
  User,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorAlert, LoadingSpinner } from '@/components/ui/Feedback';
import { useUserTransactions } from '../hooks/use-transactions';
import { formatDateTime, formatPrice } from '@/lib/utils';
import type {
  TransactionQueryParams,
  TransactionResponse,
  TransactionRoleFilter,
  TransactionStatus,
} from '@/types/transaction';

const PAGE_SIZE = 10;

const statusTabs: { label: string; value: TransactionStatus | undefined }[] = [
  { label: 'Tất cả', value: undefined },
  { label: 'Chờ bàn giao', value: 'PENDING' },
  { label: 'Đang thực hiện', value: 'IN_PROGRESS' },
  { label: 'Đã hoàn tất', value: 'COMPLETED' },
  { label: 'Đã hủy', value: 'CANCELLED' },
];

const roleTabs: { label: string; value: TransactionRoleFilter | undefined }[] = [
  { label: 'Tất cả vai trò', value: undefined },
  { label: 'Tôi cho / bán', value: 'owner' },
  { label: 'Tôi nhận / mua', value: 'requester' },
];

const statusBadgeConfig: Record<
  TransactionStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'neutral' }
> = {
  PENDING: { label: 'Chờ bàn giao', variant: 'warning' },
  IN_PROGRESS: { label: 'Đang thực hiện', variant: 'default' },
  COMPLETED: { label: 'Đã hoàn tất', variant: 'success' },
  CANCELLED: { label: 'Đã hủy', variant: 'destructive' },
};

export function TransactionsPage() {
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<TransactionStatus | undefined>(undefined);
  const [selectedRole, setSelectedRole] = useState<TransactionRoleFilter | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(0);

  const queryParams: TransactionQueryParams = {
    status: selectedStatus,
    role: selectedRole,
    page: currentPage,
    size: PAGE_SIZE,
  };

  const { data, isLoading, isError, error, refetch, isFetching } =
    useUserTransactions(queryParams);

  const handleStatusChange = (status: TransactionStatus | undefined) => {
    setSelectedStatus(status);
    setCurrentPage(0);
  };

  const handleRoleChange = (role: TransactionRoleFilter | undefined) => {
    setSelectedRole(role);
    setCurrentPage(0);
  };

  const handleResetFilters = () => {
    setSelectedStatus(undefined);
    setSelectedRole(undefined);
    setCurrentPage(0);
  };

  const transactions = data?.content || [];
  const totalElements = data?.totalElements || 0;
  const totalPages = data?.totalPages || 0;
  const isFiltered = selectedStatus !== undefined || selectedRole !== undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight whitespace-nowrap">
              Giao dịch của tôi
            </h1>
            {!isLoading && (
              <Badge variant="neutral" className="text-xs shrink-0 whitespace-nowrap">
                {totalElements} giao dịch
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi tiến độ trao đổi, nhận và bàn giao đồ dùng cộng đồng
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          leftIcon={<RotateCw className={`w-3.5 h-3.5 shrink-0 ${isFetching ? 'animate-spin' : ''}`} />}
          className="self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          {isFetching ? 'Đang cập nhật...' : 'Làm mới'}
        </Button>
      </div>

      {/* Filter Tabs & Role Selectors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/70 p-3 sm:p-4 rounded-2xl border border-slate-200">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {statusTabs.map((tab) => {
            const isActive = selectedStatus === tab.value;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => handleStatusChange(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                aria-pressed={isActive}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Role Filter Buttons - FIXED: Thêm flex-wrap để các nút xuống dòng nguyên khối */}
        <div className="flex flex-wrap items-center gap-1.5 border-t md:border-t-0 md:border-l border-slate-200 pt-2.5 md:pt-0 md:pl-4 shrink-0">
          <span className="text-xs font-medium text-slate-500 mr-1 hidden sm:inline whitespace-nowrap shrink-0">
            Vai trò:
          </span>
          {roleTabs.map((role) => {
            const isActive = selectedRole === role.value;
            return (
              <button
                key={role.label}
                type="button"
                onClick={() => handleRoleChange(role.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                aria-pressed={isActive}
              >
                {role.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <ErrorAlert
          title="Không thể tải danh sách giao dịch"
          message={
            error?.message ||
            'Đã xảy ra lỗi trong quá trình kết nối máy chủ. Vui lòng kiểm tra lại mạng và thử lại.'
          }
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4 py-8">
          <div className="flex justify-center py-6">
            <LoadingSpinner size="lg" label="Đang tải danh sách giao dịch..." />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-32 bg-slate-100 rounded-2xl animate-pulse border border-slate-200/60"
              />
            ))}
          </div>
        </div>
      )}

      {/* Loaded Content */}
      {!isLoading && !isError && transactions.length === 0 && (
        <div className="py-6">
          {isFiltered ? (
            <EmptyState
              title="Không tìm thấy giao dịch phù hợp"
              description="Không có giao dịch nào khớp với bộ lọc trạng thái hoặc vai trò bạn đã chọn."
              icon={Search}
              actionLabel="Đặt lại bộ lọc"
              onAction={handleResetFilters}
            />
          ) : (
            <EmptyState
              title="Bạn chưa có giao dịch nào"
              description="Khi bạn chấp nhận chia sẻ món đồ hoặc được chủ bài đăng chấp nhận yêu cầu, giao dịch sẽ xuất hiện tại đây."
              icon={Package}
              actionLabel="Khám phá bài đăng"
              onAction={() => navigate('/explore')}
            />
          )}
        </div>
      )}

      {/* Transaction Cards List */}
      {!isLoading && !isError && transactions.length > 0 && (
        <div className="space-y-4">
          {transactions.map((tx) => (
            <TransactionCard key={tx.id} transaction={tx} />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && !isError && totalPages > 1 && (
        <nav
          aria-label="Phân trang giao dịch"
          className="flex items-center justify-between pt-6 border-t border-slate-200"
        >
          <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
            Trang {currentPage + 1} / {totalPages} (Tổng số {totalElements} giao dịch)
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0 || isFetching}
              leftIcon={<ChevronLeft className="w-4 h-4 shrink-0" />}
              aria-label="Trang trước"
              className="whitespace-nowrap shrink-0"
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1 || isFetching}
              rightIcon={<ChevronRight className="w-4 h-4 shrink-0" />}
              aria-label="Trang kế tiếp"
              className="whitespace-nowrap shrink-0"
            >
              Trang kế tiếp
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

/**
 * Individual Transaction Card Component
 */
function TransactionCard({ transaction }: { transaction: TransactionResponse }) {
  const { listing, status, owner, requester, myRole } = transaction;

  const statusConfig = statusBadgeConfig[status] || {
    label: status,
    variant: 'neutral' as const,
  };

  const isOwner = myRole === 'OWNER';
  const isRequester = myRole === 'REQUESTER';
  const isAdmin = myRole === 'ADMIN';

  const roleBadgeText = isOwner
    ? 'Bạn là Người cho / bán'
    : isRequester
    ? 'Bạn là Người nhận / mua'
    : isAdmin
    ? 'Quản trị viên'
    : 'Thành viên';

  return (
    <article className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs p-5 sm:p-6 transition-all duration-150 space-y-4">
      {/* Card Header: Badges & Creation Date */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusConfig.variant} className="text-xs font-semibold px-2.5 py-0.5 whitespace-nowrap shrink-0">
            {statusConfig.label}
          </Badge>
          <Badge variant="neutral" className="text-xs px-2 py-0.5 font-medium whitespace-nowrap shrink-0">
            {roleBadgeText}
          </Badge>
          <Badge
            variant={listing.listingType === 'GIVEAWAY' ? 'success' : 'warning'}
            className="text-[11px] px-2 py-0.5 whitespace-nowrap shrink-0"
          >
            {listing.listingType === 'GIVEAWAY' ? 'Cho tặng' : 'Thanh lý'}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium whitespace-nowrap shrink-0">
          <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Tạo ngày: {formatDateTime(transaction.createdAt)}</span>
        </div>
      </div>

      {/* Main Body: Listing Details & Handoff Confirmation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Listing Info */}
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100 mt-0.5">
              <Package className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <Link
                to={`/listings/${listing.id}`}
                className="text-base sm:text-lg font-bold text-slate-900 hover:text-emerald-700 transition-colors line-clamp-2 leading-snug group flex items-center gap-1.5"
              >
                <span>{listing.title}</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 shrink-0" />
              </Link>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                {listing.price !== null && listing.price !== undefined && (
                  <span className="font-semibold text-emerald-700">
                    {formatPrice(listing.price, listing.currency || 'VND')}
                  </span>
                )}
                {listing.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                    <span>{listing.city}</span>
                  </span>
                )}
                <span className="text-slate-400">•</span>
                <span className="whitespace-nowrap">Mã giao dịch: {transaction.id.slice(0, 8)}...</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dual Confirmation Status */}
        <div className="lg:col-span-5 bg-slate-50 rounded-xl border border-slate-100 p-3.5 space-y-2.5">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Tiến độ xác nhận bàn giao
          </div>

          <div className="space-y-2 text-xs">
            {/* Owner Step */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="text-slate-600 truncate">
                  Người cho/bán: <strong className="text-slate-800">{owner.displayName}</strong>
                </span>
              </div>
              <div className="shrink-0 whitespace-nowrap">
                {transaction.ownerCompleted ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>Đã xác nhận</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Chờ xác nhận</span>
                  </span>
                )}
              </div>
            </div>

            {/* Requester Step */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="text-slate-600 truncate">
                  Người nhận/mua:{' '}
                  <strong className="text-slate-800">{requester.displayName}</strong>
                </span>
              </div>
              <div className="shrink-0 whitespace-nowrap">
                {transaction.requesterCompleted ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>Đã xác nhận</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Chờ xác nhận</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer: Overall Status Explainer or Cancellation Reason */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex-1">
          {status === 'COMPLETED' && (
            <div className="text-emerald-800 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>Giao dịch đã được cả hai bên xác nhận hoàn tất thành công.</span>
            </div>
          )}

          {status === 'IN_PROGRESS' && (
            <div className="text-amber-800 font-medium flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span>
                {transaction.myCompleted
                  ? 'Bạn đã xác nhận bàn giao. Đang chờ đối phương xác nhận để hoàn tất giao dịch.'
                  : 'Đối phương đã xác nhận. Vui lòng kiểm tra và xác nhận bàn giao.'}
              </span>
            </div>
          )}

          {status === 'PENDING' && (
            <div className="text-slate-600 flex items-center gap-1.5">
              <ArrowLeftRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              <span>Giao dịch đã tạo. Hai bên vui lòng liên hệ gặp mặt để bàn giao món đồ.</span>
            </div>
          )}

          {status === 'CANCELLED' && (
            <div className="text-red-700 flex items-start gap-1.5">
              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span>Giao dịch đã hủy</span>
                {transaction.cancelledBy && (
                  <span> bởi {transaction.cancelledBy.displayName}</span>
                )}
                {transaction.cancellationReason && (
                  <span className="block text-slate-500 mt-0.5">
                    Lý do: &quot;{transaction.cancellationReason}&quot;
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Links */}
        <div className="shrink-0 flex items-center gap-2 sm:gap-3 whitespace-nowrap">
          <Link
            to={`/listings/${listing.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline whitespace-nowrap shrink-0"
          >
            <span>Xem bài đăng</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          </Link>
          <Link
            to={`/transactions/${transaction.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
          >
            <span>Chi tiết giao dịch</span>
            <ChevronRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default TransactionsPage;