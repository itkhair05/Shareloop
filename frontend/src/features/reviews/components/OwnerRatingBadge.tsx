import { Star } from 'lucide-react';
import { useUserRatingSummary } from '../hooks/use-reviews';

export interface OwnerRatingBadgeProps {
  userId: string;
  className?: string;
}

export function OwnerRatingBadge({ userId, className = '' }: OwnerRatingBadgeProps) {
  const { data: summary, isLoading, isError } = useUserRatingSummary(userId);

  if (isLoading) {
    return (
      <div className={`h-4 bg-slate-100 rounded w-24 animate-pulse ${className}`} />
    );
  }

  if (isError || !summary || summary.totalReviews === 0) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-slate-400 font-medium ${className}`}>
        <Star className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
        <span>Chưa có đánh giá</span>
      </span>
    );
  }

  const averageRating = (summary.averageRating ?? 0).toFixed(1);

  return (
    <a
      href="#owner-reviews"
      aria-label={`Điểm uy tín: ${averageRating} trên 5 sao (${summary.totalReviews} đánh giá). Xem chi tiết đánh giá.`}
      className={`inline-flex items-center gap-1.5 text-xs text-slate-700 hover:text-emerald-700 transition-colors group ${className}`}
      title={`Điểm uy tín: ${averageRating} trên 5 sao (${summary.totalReviews} đánh giá)`}
    >
      <span className="flex items-center gap-1 font-bold text-amber-600 bg-amber-50/80 border border-amber-200/60 px-1.5 py-0.5 rounded-md">
        <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" aria-hidden="true" />
        <span>{averageRating}</span>
      </span>
      <span className="text-slate-400 group-hover:text-emerald-600 font-normal">
        ({summary.totalReviews} đánh giá)
      </span>
    </a>
  );
}

export default OwnerRatingBadge;
