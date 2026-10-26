import { Link } from 'react-router-dom';
import { ArrowRight, Package, ShieldCheck, Star } from 'lucide-react';

export interface ProfileStatsCardsProps {
  totalListings?: number;
  isLoadingListings?: boolean;
  averageRating?: number | null;
  totalReviews?: number;
  isLoadingRating?: boolean;
  className?: string;
}

export function ProfileStatsCards({
  totalListings = 0,
  isLoadingListings = false,
  averageRating = 0,
  totalReviews = 0,
  isLoadingRating = false,
  className = '',
}: ProfileStatsCardsProps) {
  return (
    <section aria-label="Thống kê hoạt động" className={`grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 ${className}`}>
      {/* Listings Stat Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tin đăng của tôi
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isLoadingListings ? (
                <span className="inline-block w-12 h-8 bg-slate-200 rounded animate-pulse" aria-hidden="true" />
              ) : (
                totalListings
              )}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" aria-hidden="true" />
          </div>
        </div>
        <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">Món đồ đã chia sẻ</span>
          <Link
            to="/my-listings"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1 -mx-1 py-0.5"
          >
            <span>Quản lý</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Reviews Stat Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Đánh giá uy tín
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1.5">
              {isLoadingRating ? (
                <span className="inline-block w-16 h-8 bg-slate-200 rounded animate-pulse" aria-hidden="true" />
              ) : totalReviews > 0 && averageRating != null ? (
                <>
                  <span>{averageRating.toFixed(1)}</span>
                  <span className="text-sm font-semibold text-slate-400">/ 5.0</span>
                </>
              ) : (
                <span className="text-lg font-bold text-slate-400">Chưa có</span>
              )}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Star className="w-6 h-6 fill-amber-500 text-amber-500" aria-hidden="true" />
          </div>
        </div>
        <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {isLoadingRating
              ? 'Đang kiểm tra...'
              : totalReviews > 0
              ? `${totalReviews} lượt đánh giá`
              : 'Chưa có lượt đánh giá'}
          </span>
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
            {totalReviews > 0 ? 'Uy tín cộng đồng' : 'Mới tham gia'}
          </span>
        </div>
      </div>

      {/* Account Health Stat Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Trạng thái tài khoản
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Hợp lệ
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" aria-hidden="true" />
          </div>
        </div>
        <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">Bảo mật & tuân thủ chuẩn</span>
          <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60">
            Hoạt động tốt
          </span>
        </div>
      </div>
    </section>
  );
}

export default ProfileStatsCards;
