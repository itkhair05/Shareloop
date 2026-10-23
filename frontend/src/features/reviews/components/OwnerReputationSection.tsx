import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useUserRatingSummary, useUserReviews } from '../hooks/use-reviews';
import { RatingSummaryCard } from './RatingSummaryCard';
import { UserReviewsList } from './UserReviewsList';

export interface OwnerReputationSectionProps {
  userId: string;
  ownerName: string;
  className?: string;
}

export function OwnerReputationSection({
  userId,
  ownerName,
  className = '',
}: OwnerReputationSectionProps) {
  const [reviewPage, setReviewPage] = useState(0);

  const {
    data: ratingSummary,
    isLoading: isLoadingSummary,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useUserRatingSummary(userId);

  const {
    data: reviewsPage,
    isLoading: isLoadingReviews,
    isError: isReviewsError,
    refetch: refetchReviews,
  } = useUserReviews(userId, { page: reviewPage, size: 5 });

  const reviews = reviewsPage?.content || [];
  const totalElements = reviewsPage?.totalElements || 0;
  const totalPages = reviewsPage?.totalPages || 0;

  return (
    <section
      id="owner-reviews"
      aria-label="Đánh giá và uy tín cộng đồng"
      className={`space-y-6 pt-6 border-t border-slate-200/90 ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
          <ShieldCheck className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Đánh giá & Uy tín cộng đồng
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Thông tin uy tín được ghi nhận từ thành viên {ownerName}
          </p>
        </div>
      </div>

      {!userId || !userId.trim() ? (
        <p className="text-xs text-slate-400 italic">
          Không có thông tin định danh người dùng để tải đánh giá.
        </p>
      ) : (
        <>
          {/* Aggregate Rating Summary Card */}
          <RatingSummaryCard
            summary={ratingSummary}
            isLoading={isLoadingSummary}
            isError={isSummaryError}
            onRetry={refetchSummary}
            userName={ownerName}
          />

          {/* Reviews List */}
          <UserReviewsList
            reviews={reviews}
            totalElements={totalElements}
            totalPages={totalPages}
            currentPage={reviewPage}
            onPageChange={setReviewPage}
            isLoading={isLoadingReviews}
            isError={isReviewsError}
            onRetry={refetchReviews}
            userName={ownerName}
          />
        </>
      )}
    </section>
  );
}

export default OwnerReputationSection;
