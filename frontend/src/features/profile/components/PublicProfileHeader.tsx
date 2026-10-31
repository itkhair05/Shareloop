import { useState } from 'react';
import { Calendar, Shield, ShieldAlert, Star } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/common/Avatar';
import { StarRating } from '@/features/reviews';
import { useAuth } from '@/features/auth';
import { CreateReportModal } from '@/features/reports';
import type { PublicUserProfile } from '@/types/auth';
import type { UserRatingSummaryResponse } from '@/types/review';

export interface PublicProfileHeaderProps {
  user: PublicUserProfile;
  ratingSummary?: UserRatingSummaryResponse | null;
  isLoadingRating?: boolean;
  className?: string;
}

function formatJoinDate(dateString?: string): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('vi-VN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function PublicProfileHeader({
  user,
  ratingSummary,
  isLoadingRating = false,
  className = '',
}: PublicProfileHeaderProps) {
  const { user: currentUser } = useAuth();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const roleLabel = user.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên';
  const roleVariant = user.role === 'ADMIN' ? 'warning' : 'neutral';

  const statusLabel =
    user.status === 'ACTIVE'
      ? 'Đang hoạt động'
      : user.status === 'SUSPENDED'
      ? 'Bị tạm khóa'
      : 'Đã vô hiệu hóa';
  const statusVariant =
    user.status === 'ACTIVE'
      ? 'success'
      : user.status === 'SUSPENDED'
      ? 'destructive'
      : 'neutral';

  const averageRating = ratingSummary?.averageRating ?? 0;
  const totalReviews = ratingSummary?.totalReviews ?? 0;

  const canReport = currentUser && currentUser.id !== user.id;

  return (
    <>
      <section
        aria-label={`Hồ sơ công khai của ${user.displayName}`}
        className={`bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 ${className}`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 flex-1 min-w-0">
            {/* User Avatar */}
            <Avatar
              avatarUrl={user.avatarUrl}
              name={user.displayName}
              size="2xl"
              alt={user.avatarUrl ? `Ảnh đại diện của ${user.displayName}` : `Ảnh đại diện chữ cái của ${user.displayName}`}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ring-4 ring-emerald-50 shrink-0 select-none shadow-md"
            />

            {/* User Details */}
            <div className="flex-1 min-w-0 space-y-3 w-full">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                  {user.displayName}
                </h1>
                <Badge variant={roleVariant} className="font-semibold">
                  <Shield className="w-3 h-3 mr-1" aria-hidden="true" />
                  {roleLabel}
                </Badge>
                <Badge variant={statusVariant} withDot className="font-semibold">
                  {statusLabel}
                </Badge>
              </div>

              {/* Join Date Metadata (No email or phone number) */}
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                <span>Tham gia ShareLoop: {formatJoinDate(user.createdAt)}</span>
              </div>

              {/* Rating Summary Snippet */}
              <div className="pt-1 flex items-center gap-3 text-sm">
                {isLoadingRating ? (
                  <span className="text-xs text-slate-400">Đang tải đánh giá...</span>
                ) : totalReviews > 0 ? (
                  <div className="inline-flex items-center gap-2 bg-amber-50/80 border border-amber-200/80 px-3 py-1 rounded-full">
                    <StarRating rating={averageRating} size="sm" showScore />
                    <span className="text-xs font-medium text-amber-900">
                      ({totalReviews} đánh giá)
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Star className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
                    <span>Chưa có đánh giá nào từ cộng đồng</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contextual User Report Action */}
          {canReport && (
            <div className="shrink-0 self-start sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReportModalOpen(true)}
                className="text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 border-slate-200 text-xs sm:text-sm font-medium transition-colors"
                title="Báo cáo người dùng này nếu có hành vi vi phạm tiêu chuẩn cộng đồng"
              >
                <ShieldAlert className="w-4 h-4 mr-1.5 text-slate-400" />
                Báo cáo người dùng
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Report Modal */}
      {canReport && (
        <CreateReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          targetType="USER"
          targetId={user.id}
          targetTitle={user.displayName}
        />
      )}
    </>
  );
}

export default PublicProfileHeader;
