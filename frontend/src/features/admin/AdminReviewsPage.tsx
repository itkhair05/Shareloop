import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  MessageSquareWarning,
  RotateCcw,
  Search,
  Star,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDateTime } from '@/lib/utils';
import {
  useAdminReviews,
  useModerateReview,
  useRestoreReview,
} from './hooks/use-admin-reviews';
import { ReviewDetailModal } from './components/ReviewDetailModal';
import { HideReviewDialog } from './components/HideReviewDialog';
import type { AdminReviewResponse } from '@/types/admin-review';

type VisibilityFilter = 'ALL' | 'VISIBLE' | 'HIDDEN';
type RatingFilter = 'ALL' | 1 | 2 | 3 | 4 | 5;

export function AdminReviewsPage() {
  // Search & Filter state
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('ALL');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('ALL');
  const [page, setPage] = useState(0);
  const size = 20;

  // Debounce search input by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Query parameters
  const queryParams = useMemo(() => {
    return {
      search: activeSearch || undefined,
      isHidden:
        visibilityFilter === 'ALL'
          ? undefined
          : visibilityFilter === 'HIDDEN',
      rating: ratingFilter === 'ALL' ? undefined : ratingFilter,
      page,
      size,
      sortBy: 'createdAt' as const,
      sortDirection: 'desc' as const,
    };
  }, [activeSearch, visibilityFilter, ratingFilter, page, size]);

  const {
    data: pageData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useAdminReviews(queryParams);

  const moderateReviewMutation = useModerateReview();
  const restoreReviewMutation = useRestoreReview();

  // Modals & Action states
  const [detailReviewId, setDetailReviewId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [hideReviewId, setHideReviewId] = useState<string | null>(null);
  const [isHideDialogOpen, setIsHideDialogOpen] = useState(false);

  const [reviewToRestore, setReviewToRestore] = useState<AdminReviewResponse | null>(null);

  // Dismissible Feedback Banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleResetFilters = () => {
    setSearchInput('');
    setActiveSearch('');
    setVisibilityFilter('ALL');
    setRatingFilter('ALL');
    setPage(0);
  };

  const handleOpenDetail = (id: string) => {
    setDetailReviewId(id);
    setIsDetailModalOpen(true);
  };

  const handleOpenHideDialog = (id: string) => {
    setHideReviewId(id);
    setIsHideDialogOpen(true);
  };

  const handleConfirmHide = async (reason: string) => {
    if (!hideReviewId) return;
    try {
      await moderateReviewMutation.mutateAsync({
        reviewId: hideReviewId,
        payload: { reason },
      });
      setIsHideDialogOpen(false);
      setHideReviewId(null);
      setFeedback({
        type: 'success',
        text: 'Đã ẩn đánh giá khỏi giao diện công khai và loại trừ khỏi điểm trung bình thành công.',
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi khi ẩn đánh giá';
      setFeedback({
        type: 'error',
        text: errMsg,
      });
    }
  };

  const handleOpenRestoreConfirm = (review: AdminReviewResponse) => {
    setReviewToRestore(review);
  };

  const handleConfirmRestore = async () => {
    if (!reviewToRestore) return;
    try {
      await restoreReviewMutation.mutateAsync({
        reviewId: reviewToRestore.id,
      });
      setReviewToRestore(null);
      setFeedback({
        type: 'success',
        text: 'Đã khôi phục đánh giá thành công! Đánh giá đã xuất hiện lại công khai trên hồ sơ người dùng.',
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi khi khôi phục đánh giá';
      setFeedback({
        type: 'error',
        text: errMsg,
      });
    }
  };

  const reviews = pageData?.content || [];
  const totalElements = pageData?.totalElements || 0;
  const totalPages = pageData?.totalPages || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Kiểm duyệt đánh giá
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Giám sát phản hồi uy tín, ẩn đánh giá vi phạm quy chuẩn và khôi phục hiển thị công khai
          </p>
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
          <div className="flex items-center gap-2.5 text-sm font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-md hover:bg-black/5 text-slate-500 hover:text-slate-800 cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar Card */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo nhận xét, người gửi hoặc người nhận..."
                className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  aria-label="Xóa từ khóa tìm kiếm"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Visibility Filter */}
            <div>
              <select
                value={visibilityFilter}
                onChange={(e) => {
                  setVisibilityFilter(e.target.value as VisibilityFilter);
                  setPage(0);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                aria-label="Lọc theo trạng thái hiển thị"
              >
                <option value="ALL">Tất cả trạng thái hiển thị</option>
                <option value="VISIBLE">Đang công khai</option>
                <option value="HIDDEN">Đã bị ẩn kiểm duyệt</option>
              </select>
            </div>

            {/* Rating Filter */}
            <div>
              <select
                value={ratingFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setRatingFilter(val === 'ALL' ? 'ALL' : (Number(val) as RatingFilter));
                  setPage(0);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                aria-label="Lọc theo số sao đánh giá"
              >
                <option value="ALL">Tất cả số sao (1-5)</option>
                <option value="5">5 sao (Xuất sắc)</option>
                <option value="4">4 sao (Tốt)</option>
                <option value="3">3 sao (Bình thường)</option>
                <option value="2">2 sao (Kém)</option>
                <option value="1">1 sao (Rất tệ)</option>
              </select>
            </div>
          </div>

          {/* Active filter count & Reset button */}
          {(searchInput || visibilityFilter !== 'ALL' || ratingFilter !== 'ALL') && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Đang áp dụng bộ lọc tùy chỉnh. Tìm thấy{' '}
                <strong className="text-slate-900">{totalElements}</strong> kết quả.
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Đặt lại bộ lọc
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviews Data Table Card */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Đánh giá
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Người đánh giá (Reviewer)
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Người nhận (Reviewee)
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Trạng thái
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Thời gian
                </th>
                <th scope="col" className="px-4 py-3 text-right whitespace-nowrap">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                // Skeletons
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-28 bg-slate-200 rounded mb-1.5" />
                      <div className="h-3 w-44 bg-slate-100 rounded" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-24 bg-slate-200 rounded mb-1" />
                      <div className="h-3 w-32 bg-slate-100 rounded" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-24 bg-slate-200 rounded mb-1" />
                      <div className="h-3 w-32 bg-slate-100 rounded" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-5 w-20 bg-slate-200 rounded-full" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-3.5 w-24 bg-slate-200 rounded" />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="h-8 w-16 bg-slate-200 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-red-600">
                      <AlertCircle className="w-8 h-8" />
                      <p className="font-semibold text-sm">Không thể tải danh sách đánh giá</p>
                      <p className="text-xs text-slate-500">{error?.message || 'Lỗi kết nối máy chủ'}</p>
                      <button
                        type="button"
                        onClick={() => refetch()}
                        className="mt-2 inline-flex flex-row items-center justify-center gap-2 h-9 px-4 text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        <span className="whitespace-nowrap">Thử lại</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <MessageSquareWarning className="w-8 h-8 text-slate-400" />
                      <p className="font-semibold text-sm text-slate-700">Không tìm thấy đánh giá nào</p>
                      <p className="text-xs text-slate-400">
                        Thử thay đổi từ khóa tìm kiếm hoặc đặt lại các bộ lọc đang chọn.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-2 inline-flex flex-row items-center justify-center gap-2 h-9 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        <span className="whitespace-nowrap">Đặt lại bộ lọc</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                reviews.map((rev) => (
                  <tr key={rev.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Rating & Comment preview */}
                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="flex items-center gap-1 text-amber-500 mb-1 flex-nowrap">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 shrink-0 ${
                              s <= rev.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        ))}
                        <span className="text-xs font-bold text-slate-700 ml-1 whitespace-nowrap">
                          {rev.rating} sao
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2" title={rev.comment || ''}>
                        {rev.comment || <span className="italic text-slate-400">(Không có văn bản)</span>}
                      </p>
                    </td>

                    {/* Reviewer */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          avatarUrl={rev.reviewerAvatarUrl}
                          name={rev.reviewerDisplayName}
                          size="sm"
                          alt={
                            rev.reviewerDisplayName
                              ? `Ảnh đại diện của ${rev.reviewerDisplayName}`
                              : 'Ảnh đại diện người đánh giá'
                          }
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 text-xs truncate max-w-[150px]">
                            {rev.reviewerDisplayName || 'Chưa cập nhật'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate max-w-[150px]">
                            {rev.reviewerEmail || '—'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Reviewee */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          avatarUrl={rev.revieweeAvatarUrl}
                          name={rev.revieweeDisplayName}
                          size="sm"
                          alt={
                            rev.revieweeDisplayName
                              ? `Ảnh đại diện của ${rev.revieweeDisplayName}`
                              : 'Ảnh đại diện người nhận đánh giá'
                          }
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 text-xs truncate max-w-[150px]">
                            {rev.revieweeDisplayName || 'Chưa cập nhật'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate max-w-[150px]">
                            {rev.revieweeEmail || '—'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Visibility Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {rev.isHidden ? (
                        <Badge variant="destructive" className="text-[11px] gap-1 whitespace-nowrap shrink-0">
                          <EyeOff className="w-3 h-3 shrink-0" />
                          Đã ẩn
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[11px] gap-1 whitespace-nowrap shrink-0">
                          <Eye className="w-3 h-3 shrink-0" />
                          Công khai
                        </Badge>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(rev.createdAt)}
                    </td>

                    {/* Actions - Dùng thẻ button thuần để không bị rớt dòng */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap w-[200px] min-w-[200px]">
                      <div className="flex flex-row flex-nowrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(rev.id)}
                          className="inline-flex flex-row items-center justify-center gap-1 h-8 px-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span className="whitespace-nowrap">Chi tiết</span>
                        </button>

                        {rev.isHidden ? (
                          <button
                            type="button"
                            onClick={() => handleOpenRestoreConfirm(rev)}
                            disabled={restoreReviewMutation.isPending}
                            className="inline-flex flex-row items-center justify-center gap-1 h-8 px-2.5 text-xs font-medium text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50"
                          >
                            <span className="whitespace-nowrap">Khôi phục</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenHideDialog(rev.id)}
                            disabled={moderateReviewMutation.isPending}
                            className="inline-flex flex-row items-center justify-center gap-1 h-8 px-2.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50"
                          >
                            <EyeOff className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap">Ẩn</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {!isLoading && totalElements > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="whitespace-nowrap">
              Hiển thị trang <strong className="text-slate-900">{page + 1}</strong> /{' '}
              <strong className="text-slate-900">{Math.max(1, totalPages)}</strong> (Tổng cộng{' '}
              <strong className="text-slate-900">{totalElements}</strong> đánh giá)
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
                className="inline-flex flex-row items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Trước</span>
              </button>

              <span className="px-2 font-medium whitespace-nowrap">
                {page + 1}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isFetching}
                className="inline-flex flex-row items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="whitespace-nowrap">Sau</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Review Detail Modal */}
      <ReviewDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailReviewId(null);
        }}
        reviewId={detailReviewId}
        onHideClick={(id) => handleOpenHideDialog(id)}
        onRestoreClick={(id) => {
          const rev = reviews.find((r) => r.id === id);
          if (rev) handleOpenRestoreConfirm(rev);
        }}
      />

      {/* Hide Review Reason Dialog */}
      <HideReviewDialog
        isOpen={isHideDialogOpen}
        onClose={() => {
          setIsHideDialogOpen(false);
          setHideReviewId(null);
        }}
        onConfirm={handleConfirmHide}
        reviewId={hideReviewId}
        isLoading={moderateReviewMutation.isPending}
      />

      {/* Restore Review Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(reviewToRestore)}
        onClose={() => setReviewToRestore(null)}
        onConfirm={handleConfirmRestore}
        title="Khôi phục hiển thị đánh giá"
        message={
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              Bạn có chắc chắn muốn khôi phục hiển thị đánh giá này?
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div><strong>Người đánh giá:</strong> {reviewToRestore?.reviewerDisplayName} ({reviewToRestore?.rating} sao)</div>
              <div><strong>Nội dung:</strong> {reviewToRestore?.comment || 'Không có lời nhận xét'}</div>
            </div>
            <p className="text-xs text-amber-700">
              * Sau khi khôi phục, đánh giá này sẽ ngay lập tức được tính lại vào điểm trung bình và danh sách công khai của đối tác nhận đánh giá.
            </p>
          </div>
        }
        confirmText="Xác nhận khôi phục"
        cancelText="Hủy"
        variant="primary"
        isLoading={restoreReviewMutation.isPending}
      />
    </div>
  );
}

export default AdminReviewsPage;