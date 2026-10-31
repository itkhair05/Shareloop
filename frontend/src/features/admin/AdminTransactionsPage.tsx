import { useEffect, useId, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  Ban,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { useAdminTransactions } from './hooks/use-admin-transactions';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { CancelTransactionDialog } from './components/CancelTransactionDialog';
import type { AdminTransactionResponse } from '@/types/admin-transaction';
import type { TransactionStatus } from '@/types/transaction';

export function AdminTransactionsPage() {
  const searchInputId = useId();
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal states
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [selectedCancelTx, setSelectedCancelTx] = useState<AdminTransactionResponse | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  // Feedback banner state
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Debounce search input by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(0);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryParams = {
    page,
    size,
    status: statusFilter !== 'ALL' ? (statusFilter as TransactionStatus) : undefined,
    search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminTransactions(queryParams);

  const transactions = data?.content || [];
  const totalElements = data?.totalElements || 0;
  const totalPages = data?.totalPages || 0;

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setPage(0);
  };

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setSearchInput('');
    setDebouncedSearch('');
    setPage(0);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenDetail = (id: string) => {
    setDetailTransactionId(id);
    setIsDetailOpen(true);
  };

  const handleOpenCancel = (tx: AdminTransactionResponse) => {
    setSelectedCancelTx(tx);
    setIsCancelOpen(true);
  };

  const handleCancelSuccess = () => {
    setFeedback({
      type: 'success',
      text: 'Giao dịch đã được hủy thành công theo quyết định can thiệp quản trị.',
    });
    refetch();
  };

  const getStatusBadgeVariant = (status: TransactionStatus) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'IN_PROGRESS':
        return 'default';
      case 'CANCELLED':
        return 'destructive';
      case 'PENDING':
      default:
        return 'warning';
    }
  };

  const getStatusLabel = (status: TransactionStatus) => {
    switch (status) {
      case 'COMPLETED':
        return 'Hoàn tất';
      case 'IN_PROGRESS':
        return 'Đang diễn ra';
      case 'CANCELLED':
        return 'Đã hủy';
      case 'PENDING':
      default:
        return 'Chờ xử lý';
    }
  };

  const statusOptions: { value: string; label: string }[] = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'PENDING', label: 'Chờ xử lý' },
    { value: 'IN_PROGRESS', label: 'Đang diễn ra' },
    { value: 'COMPLETED', label: 'Hoàn tất' },
    { value: 'CANCELLED', label: 'Đã hủy' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
              Quản lý giao dịch
            </h1>
            <Badge variant="neutral" className="font-mono text-xs shrink-0 whitespace-nowrap">
              {totalElements.toLocaleString('vi-VN')} giao dịch
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Giám sát tiến trình trao đổi giữa các thành viên, theo dõi xác nhận hai chiều và can thiệp hủy giao dịch khi có sự cố
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex flex-row items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-xs disabled:opacity-50"
            title="Làm mới danh sách giao dịch"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="whitespace-nowrap">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Dismissible Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <label htmlFor={searchInputId} className="sr-only">
                Tìm kiếm giao dịch
              </label>
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id={searchInputId}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo mã giao dịch, tiêu đề bài đăng, tên người dùng..."
                className="w-full text-xs text-slate-900 pl-9 pr-8 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  aria-label="Xóa nội dung tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Tabs / Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {statusOptions.map((opt) => {
                const isActive = statusFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleStatusFilterChange(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Filter Indicators */}
          {(statusFilter !== 'ALL' || debouncedSearch) && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500 flex-wrap">
              <span className="whitespace-nowrap">Đang lọc:</span>
              {statusFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium whitespace-nowrap">
                  Trạng thái: {statusOptions.find((o) => o.value === statusFilter)?.label}
                </span>
              )}
              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium max-w-xs truncate">
                  Từ khóa: &quot;{debouncedSearch}&quot;
                </span>
              )}
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium ml-auto cursor-pointer whitespace-nowrap"
              >
                Đặt lại tất cả
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Table Card - Đã giảm cột, bỏ min-w, dùng w-full */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Mã giao dịch
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Bài đăng
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Các bên tham gia
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Trạng thái
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Xác nhận
                </th>
                <th scope="col" className="px-4 py-3 text-right whitespace-nowrap w-[160px] min-w-[160px]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                // Loading Skeleton Rows
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-20 bg-slate-200 rounded" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-36 bg-slate-200 rounded mb-1" />
                      <div className="h-3 w-20 bg-slate-100 rounded" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-32 bg-slate-200 rounded mb-1" />
                      <div className="h-3 w-24 bg-slate-100 rounded" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-5 w-20 bg-slate-200 rounded-full" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-16 bg-slate-200 rounded" />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="h-8 w-16 bg-slate-200 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                // Error State
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-red-600">
                      <AlertCircle className="w-8 h-8" />
                      <p className="font-semibold text-sm">Không thể tải danh sách giao dịch</p>
                      <p className="text-xs text-slate-500">{error?.message || 'Lỗi kết nối máy chủ'}</p>
                      <button
                        type="button"
                        onClick={() => refetch()}
                        className="mt-2 inline-flex flex-row items-center justify-center gap-2 h-9 px-4 text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                        <span className="whitespace-nowrap">Thử lại</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                // Empty State
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <ArrowLeftRight className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-sm text-slate-700">Không tìm thấy giao dịch nào</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        {statusFilter !== 'ALL' || debouncedSearch
                          ? 'Không có giao dịch nào phù hợp với bộ lọc hiện tại. Vui lòng thử từ khóa khác hoặc đặt lại bộ lọc.'
                          : 'Hệ thống hiện chưa có giao dịch trao đổi nào.'}
                      </p>
                      {(statusFilter !== 'ALL' || debouncedSearch) && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 inline-flex flex-row items-center justify-center gap-2 h-9 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                        >
                          <span className="whitespace-nowrap">Đặt lại bộ lọc</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                // Data Rows
                transactions.map((tx) => {
                  const shortId = tx.id.substring(0, 8) + '...';
                  const isCopied = copiedId === tx.id;
                  const canCancel = tx.status === 'PENDING' || tx.status === 'IN_PROGRESS';

                  // Calculate confirmation state
                  const confirmedCount = (tx.ownerCompleted ? 1 : 0) + (tx.requesterCompleted ? 1 : 0);

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Transaction ID */}
                      <td className="px-4 py-3.5 font-mono">
                        <div className="flex items-center gap-1 text-slate-900 font-semibold">
                          <span title={tx.id}>{shortId}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(tx.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                            title="Sao chép toàn bộ mã giao dịch"
                            aria-label={`Sao chép mã giao dịch ${tx.id}`}
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Listing Title */}
                      <td className="px-4 py-3.5 max-w-[200px]">
                        <div
                          className="font-medium text-slate-900 truncate"
                          title={tx.listingTitle}
                        >
                          {tx.listingTitle}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate" title={tx.listingId}>
                          ID: {tx.listingId.substring(0, 8)}...
                        </div>
                      </td>

                      {/* Combined Participants */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Avatar
                              avatarUrl={tx.ownerAvatarUrl ?? tx.owner?.avatarUrl}
                              name={tx.ownerDisplayName}
                              size="xs"
                              alt={`Ảnh đại diện của ${tx.ownerDisplayName}`}
                            />
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-slate-500 shrink-0">Tặng:</span>
                              <span className="font-semibold text-slate-900 truncate max-w-[120px]">{tx.ownerDisplayName}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Avatar
                              avatarUrl={tx.requesterAvatarUrl ?? tx.requester?.avatarUrl}
                              name={tx.requesterDisplayName}
                              size="xs"
                              alt={`Ảnh đại diện của ${tx.requesterDisplayName}`}
                            />
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-slate-500 shrink-0">Nhận:</span>
                              <span className="font-semibold text-slate-900 truncate max-w-[120px]">{tx.requesterDisplayName}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Badge variant={getStatusBadgeVariant(tx.status)} withDot className="whitespace-nowrap shrink-0">
                          {getStatusLabel(tx.status)}
                        </Badge>
                      </td>

                      {/* Confirmation Progress (Compact) */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {tx.status === 'CANCELLED' ? (
                          <span className="text-slate-400 text-xs italic">Đã hủy</span>
                        ) : tx.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>2/2</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{confirmedCount}/2</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap w-[160px] min-w-[160px]">
                        <div className="flex flex-row flex-nowrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(tx.id)}
                            className="inline-flex flex-row items-center justify-center gap-1 h-8 px-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                            title="Xem chi tiết giao dịch"
                            aria-label={`Xem chi tiết giao dịch ${tx.id}`}
                          >
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap">Chi tiết</span>
                          </button>

                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => handleOpenCancel(tx)}
                              className="inline-flex flex-row items-center justify-center gap-1 h-8 px-2.5 text-xs font-medium text-red-600 bg-red-50/60 border border-red-200 hover:bg-red-100/70 hover:text-red-700 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                              title="Can thiệp hủy giao dịch"
                              aria-label={`Hủy giao dịch ${tx.id}`}
                            >
                              <Ban className="w-3.5 h-3.5 shrink-0" />
                              <span className="whitespace-nowrap">Hủy</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-side Pagination Footer */}
        {transactions.length > 0 && (
          <div className="px-4 py-3.5 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="whitespace-nowrap">
              Hiển thị{' '}
              <span className="font-semibold text-slate-900">
                {page * size + 1}
              </span>{' '}
              -{' '}
              <span className="font-semibold text-slate-900">
                {Math.min((page + 1) * size, totalElements)}
              </span>{' '}
              trong tổng số{' '}
              <span className="font-semibold text-slate-900">
                {totalElements.toLocaleString('vi-VN')}
              </span>{' '}
              giao dịch
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page === 0 || isFetching}
                className="inline-flex flex-row items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Trang trước"
              >
                <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Trước</span>
              </button>

              <span className="px-3 py-1 font-mono text-xs font-medium text-slate-700 whitespace-nowrap">
                Trang {page + 1} / {Math.max(1, totalPages)}
              </span>

              <button
                type="button"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={page >= totalPages - 1 || isFetching}
                className="inline-flex flex-row items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Trang tiếp"
              >
                <span className="whitespace-nowrap">Sau</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transactionId={detailTransactionId}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailTransactionId(null);
        }}
        onOpenCancelModal={(tx) => {
          setIsDetailOpen(false);
          setDetailTransactionId(null);
          setSelectedCancelTx(tx);
          setIsCancelOpen(true);
        }}
      />

      {/* Cancel Transaction Dialog */}
      <CancelTransactionDialog
        transaction={selectedCancelTx}
        isOpen={isCancelOpen}
        onClose={() => {
          setIsCancelOpen(false);
          setSelectedCancelTx(null);
        }}
        onSuccess={handleCancelSuccess}
      />
    </div>
  );
}

export default AdminTransactionsPage;