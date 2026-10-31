import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Package,
  RotateCw,
  ShieldAlert,
} from 'lucide-react';
import { StarRating } from './StarRating';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/common/Avatar';
import { useAuth } from '@/features/auth';
import { CreateReportModal } from '@/features/reports';
import { formatDateTime } from '@/lib/utils';
import type { ReviewResponse } from '@/types/review';

export interface UserReviewsListProps {
  reviews: ReviewResponse[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  userName?: string;
  className?: string;
}

export function UserReviewsList({
  reviews = [],
  totalElements = 0,
  totalPages = 0,
  currentPage = 0,
  onPageChange = () => {},
  isLoading = false,
  isError = false,
  onRetry,
  userName,
  className = '',
}: UserReviewsListProps) {
  const { user: currentUser } = useAuth();
  const [reportingReview, setReportingReview] = useState<ReviewResponse | null>(null);

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="h-5 bg-slate-200 rounded w-1/4" />
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs animate-pulse space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 bg-slate-200 rounded w-1/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/6" />
                </div>
              </div>
              <div className="h-3.5 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`p-5 bg-red-50/70 border border-red-200 rounded-2xl text-red-900 space-y-3 ${className}`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
          <span>Không thể tải danh sách nhận xét</span>
        </div>
        <p className="text-xs text-red-700">
          Đã xảy ra lỗi khi tải nhận xét từ cộng đồng. Vui lòng thử lại.
        </p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            leftIcon={<RotateCw className="w-3.5 h-3.5" />}
            className="text-xs border-red-200 text-red-800 hover:bg-red-100"
          >
            Thử lại
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-emerald-600" aria-hidden="true" />
          <h3 className="text-base font-bold text-slate-900">
            Nhận xét từ người nhận & đối tác
          </h3>
          {totalElements > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {totalElements}
            </span>
          )}
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <MessageSquare className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="font-semibold text-slate-800 text-sm">Chưa có nhận xét nào</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {userName ? `${userName}` : 'Thành viên này'} chưa có phản hồi nào từ các giao dịch hoàn thành.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-3 transition-shadow hover:shadow-sm"
            >
              {/* Reviewer Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {review.reviewer?.id ? (
                    <Link
                      to={`/users/${review.reviewer.id}`}
                      className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg"
                      aria-label={`Hồ sơ của ${review.reviewer.displayName}`}
                    >
                      <Avatar
                        avatarUrl={review.reviewer.avatarUrl}
                        name={review.reviewer.displayName}
                        size="sm"
                        alt={`Ảnh đại diện của ${review.reviewer.displayName}`}
                        className="w-9 h-9 text-sm shrink-0 group-hover:ring-2 group-hover:ring-emerald-500 transition-all shadow-xs"
                      />
                      <div>
                        <span className="font-bold text-slate-900 text-sm block group-hover:text-emerald-700 transition-colors">
                          {review.reviewer.displayName}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDateTime(review.createdAt)}
                        </span>
                      </div>
                    </Link>
                  ) : (
                    <>
                      <Avatar
                        avatarUrl={review.reviewer?.avatarUrl}
                        name={review.reviewer?.displayName}
                        size="sm"
                        alt={`Ảnh đại diện của ${review.reviewer?.displayName || 'Thành viên'}`}
                        className="w-9 h-9 text-sm shrink-0 shadow-xs"
                      />
                      <div>
                        <span className="font-bold text-slate-900 text-sm block">
                          {review.reviewer?.displayName || 'Thành viên ẩn danh'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDateTime(review.createdAt)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Rating & Actions */}
                <div className="flex items-center gap-2">
                  <StarRating rating={review.rating} size="sm" showScore />
                  {currentUser && currentUser.id !== review.reviewer?.id && (
                    <button
                      type="button"
                      onClick={() => setReportingReview(review)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
                      title="Báo cáo nhận xét này nếu vi phạm tiêu chuẩn cộng đồng"
                      aria-label="Báo cáo nhận xét này"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Review Comment */}
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line pl-12">
                {review.comment ? (
                  review.comment
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    Người dùng không để lại lời bình.
                  </span>
                )}
              </p>

              {/* Referenced Listing Pill */}
              {review.listing && (
                <div className="ml-12 pt-2 border-t border-slate-100">
                  <Link
                    to={`/listings/${review.listing.id}`}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-700 font-medium transition-colors group"
                  >
                    <Package className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" aria-hidden="true" />
                    <span className="truncate max-w-[280px] sm:max-w-md">
                      Giao dịch: <strong className="font-semibold text-slate-700 group-hover:text-emerald-700">{review.listing.title}</strong>
                    </span>
                  </Link>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            Trang <span className="font-semibold text-slate-800">{currentPage + 1}</span> / {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 0}
              onClick={() => onPageChange(currentPage - 1)}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              className="text-xs h-8 px-2.5"
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages - 1}
              onClick={() => onPageChange(currentPage + 1)}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              className="text-xs h-8 px-2.5"
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportingReview && (
        <CreateReportModal
          isOpen={Boolean(reportingReview)}
          onClose={() => setReportingReview(null)}
          targetType="REVIEW"
          targetId={reportingReview.id}
          targetTitle={`Đánh giá từ ${reportingReview.reviewer?.displayName || 'Thành viên'}`}
        />
      )}
    </div>
  );
}

export default UserReviewsList;
