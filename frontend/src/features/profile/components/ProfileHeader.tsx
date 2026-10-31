import { Calendar, Mail, Pencil, Phone, Shield, Star } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/common/Avatar';
import { StarRating } from '@/features/reviews';
import type { UserProfile } from '@/types/auth';
import type { UserRatingSummaryResponse } from '@/types/review';

export interface ProfileHeaderProps {
  user: UserProfile;
  ratingSummary?: UserRatingSummaryResponse | null;
  isLoadingRating?: boolean;
  className?: string;
  onEditProfile?: () => void;
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

export function ProfileHeader({
  user,
  ratingSummary,
  isLoadingRating = false,
  className = '',
  onEditProfile,
}: ProfileHeaderProps) {
  const initial = user.displayName?.trim().charAt(0).toUpperCase() || 'U';
  const phoneDisplay = user.phoneNumber?.trim() ? user.phoneNumber : 'Chưa cập nhật';

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

  return (
    <section
      aria-label="Thông tin người dùng"
      className={`bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        {/* User Avatar */}
        {user.avatarUrl ? (
          <Avatar
            avatarUrl={user.avatarUrl}
            name={user.displayName}
            size="2xl"
            alt={`Ảnh đại diện của ${user.displayName}`}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ring-4 ring-emerald-50 shrink-0 select-none shadow-md"
          />
        ) : (
          <div
            role="img"
            aria-label={`Ảnh đại diện chữ cái của ${user.displayName}`}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold text-2xl sm:text-3xl flex items-center justify-center shadow-md ring-4 ring-emerald-50 shrink-0 select-none"
          >
            {initial}
          </div>
        )}

        {/* User Details */}
        <div className="flex-1 min-w-0 space-y-3 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                {user.displayName}
              </h2>
              <Badge variant={roleVariant} className="font-semibold">
                <Shield className="w-3 h-3 mr-1" aria-hidden="true" />
                {roleLabel}
              </Badge>
              <Badge variant={statusVariant} withDot className="font-semibold">
                {statusLabel}
              </Badge>
            </div>

            {onEditProfile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEditProfile}
                leftIcon={<Pencil className="w-3.5 h-3.5" aria-hidden="true" />}
                className="shrink-0 self-start sm:self-auto shadow-2xs"
              >
                Chỉnh sửa hồ sơ
              </Button>
            )}
          </div>

          {/* Contact and Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-sm text-slate-600">
            <div className="flex items-center gap-2 truncate">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              <span className="truncate" title={user.email}>
                {user.email}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              <span
                className={user.phoneNumber?.trim() ? 'font-medium text-slate-800' : 'text-slate-400 italic'}
              >
                {phoneDisplay}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              <span>Tham gia: {formatJoinDate(user.createdAt)}</span>
            </div>
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
    </section>
  );
}

export default ProfileHeader;
