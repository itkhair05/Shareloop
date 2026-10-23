import { Star, ShieldAlert, RotateCw } from 'lucide-react';
import { StarRating } from './StarRating';
import { Button } from '@/components/ui/Button';
import type { UserRatingSummaryResponse } from '@/types/review';

export interface RatingSummaryCardProps {
  summary?: UserRatingSummaryResponse | null;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  userName?: string;
  className?: string;
}

export function RatingSummaryCard({
  summary,
  isLoading = false,
  isError = false,
  onRetry,
  userName,
  className = '',
}: RatingSummaryCardProps) {
  if (isLoading) {
    return (
      <div className={`p-6 bg-white rounded-2xl border border-slate-200/90 shadow-xs animate-pulse space-y-4 ${className}`}>
        <div className="h-5 bg-slate-200 rounded w-1/3" />
        <div className="flex flex-col sm:flex-row gap-6 items-center">
          <div className="w-24 h-24 bg-slate-100 rounded-2xl" />
          <div className="flex-1 w-full space-y-2">
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-4/5" />
            <div className="h-3 bg-slate-100 rounded w-3/5" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`p-5 bg-red-50/70 border border-red-200 rounded-2xl text-red-900 space-y-3 ${className}`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
          <span>Không thể tải điểm đánh giá người dùng</span>
        </div>
        <p className="text-xs text-red-700">
          Đã xảy ra lỗi khi kết nối với máy chủ để lấy thông tin đánh giá.
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

  const totalReviews = summary?.totalReviews ?? 0;
  const averageRating = summary?.averageRating ?? 0;
  const starBreakdown = summary?.starBreakdown ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  return (
    <div className={`p-6 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Điểm uy tín người dùng
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Dựa trên các giao dịch thực tế đã hoàn thành trên ShareLoop
          </p>
        </div>
        {totalReviews > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            {totalReviews} đánh giá
          </span>
        )}
      </div>

      {totalReviews === 0 ? (
        <div className="py-6 text-center space-y-2 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 p-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
            <Star className="w-5 h-5 fill-amber-400 stroke-amber-400" aria-hidden="true" />
          </div>
          <div className="font-semibold text-slate-800 text-sm">Chưa có đánh giá nào</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {userName ? `${userName} chưa` : 'Thành viên này chưa'} nhận được đánh giá từ giao dịch nào. Hãy là người đầu tiên trao đổi và để lại nhận xét!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
          {/* Left Column: Big Average Score */}
          <div className="sm:col-span-5 flex flex-col items-center sm:items-start text-center sm:text-left justify-center sm:border-r border-slate-100 sm:pr-6 space-y-2">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                {averageRating.toFixed(1)}
              </span>
              <span className="text-slate-400 text-base font-semibold">/ 5</span>
            </div>

            <StarRating rating={averageRating} size="lg" />

            <div className="text-xs text-slate-500 pt-1">
              Tổng cộng <strong>{totalReviews}</strong> lượt đánh giá
            </div>
          </div>

          {/* Right Column: Star Breakdown Bars */}
          <div className="sm:col-span-7 space-y-2">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = starBreakdown[stars] ?? 0;
              const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;

              return (
                <div key={stars} className="flex items-center gap-2.5 text-xs text-slate-600">
                  <span className="w-4 font-bold text-slate-700 shrink-0 text-right">
                    {stars}
                  </span>
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" aria-hidden="true" />

                  {/* Progress Bar */}
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${stars} sao: ${count} lượt (${percentage}%)`}>
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <span className="w-10 text-right font-medium text-slate-400 shrink-0">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default RatingSummaryCard;
