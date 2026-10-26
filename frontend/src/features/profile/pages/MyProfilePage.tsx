import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Package, Plus, Sparkles } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useMyListings, ListingCard } from '@/features/listings';
import {
  useUserRatingSummary,
  useUserReviews,
  RatingSummaryCard,
  UserReviewsList,
} from '@/features/reviews';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileStatsCards } from '../components/ProfileStatsCards';
import { EmptyState, ErrorAlert, LoadingSpinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';

export function MyProfilePage() {
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();

  // Ratings & reviews state
  const [reviewsPage, setReviewsPage] = useState(0);

  const {
    data: ratingSummary,
    isLoading: isLoadingRating,
    isError: isRatingError,
    refetch: refetchRating,
  } = useUserRatingSummary(user?.id);

  const {
    data: reviewsData,
    isLoading: isLoadingReviews,
    isError: isReviewsError,
    refetch: refetchReviews,
  } = useUserReviews(user?.id, { page: reviewsPage, size: 5 });

  // Up to 4 user's own listings for preview
  const {
    data: listingsData,
    isLoading: isLoadingListings,
    isError: isListingsError,
    refetch: refetchListings,
  } = useMyListings({ page: 0, size: 4 });

  if (isAuthLoading) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center p-8" aria-busy="true">
        <LoadingSpinner size="lg" label="Đang tải thông tin hồ sơ cá nhân..." />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-16 text-center">
        <EmptyState
          title="Không tìm thấy thông tin tài khoản"
          description="Vui lòng đăng nhập lại để xem hồ sơ cá nhân của bạn."
          actionLabel="Đăng nhập ngay"
          onAction={() => navigate('/login', { state: { from: { pathname: '/profile' } } })}
        />
      </main>
    );
  }

  const listings = listingsData?.content ?? [];
  const totalListings = listingsData?.totalElements ?? 0;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Title & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Hồ sơ của tôi
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Xem và quản lý thông tin tài khoản, độ tin cậy và các hoạt động chia sẻ trên ShareLoop.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/listings/new')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="shadow-sm"
          >
            Đăng tin mới
          </Button>
        </div>
      </div>

      {/* Profile Header (Avatar, Details, Badges) */}
      <ProfileHeader
        user={user}
        ratingSummary={ratingSummary}
        isLoadingRating={isLoadingRating}
      />

      {/* Stats Cards Overview */}
      <ProfileStatsCards
        totalListings={totalListings}
        isLoadingListings={isLoadingListings}
        averageRating={ratingSummary?.averageRating}
        totalReviews={ratingSummary?.totalReviews}
        isLoadingRating={isLoadingRating}
      />

      {/* Section 1: Recent Listings Preview */}
      <section aria-labelledby="my-listings-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 id="my-listings-heading" className="text-xl font-bold text-slate-900 tracking-tight">
              Tin đăng gần đây
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {totalListings} món đồ
            </span>
          </div>

          {totalListings > 0 && (
            <Link
              to="/my-listings"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1.5 py-0.5"
            >
              <span>Xem tất cả ({totalListings})</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          )}
        </div>

        {/* Listings content */}
        {isLoadingListings ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
            <LoadingSpinner size="md" label="Đang tải danh sách tin đăng của bạn..." />
          </div>
        ) : isListingsError ? (
          <ErrorAlert
            title="Không thể tải tin đăng"
            message="Đã xảy ra lỗi khi kết nối với máy chủ để lấy danh sách tin đăng của bạn."
            onRetry={refetchListings}
            retryLabel="Thử lại"
          />
        ) : listings.length === 0 ? (
          <EmptyState
            title="Bạn chưa có tin đăng nào"
            description="Hãy chia sẻ những món đồ bạn không còn dùng đến với cộng đồng ShareLoop để lan tỏa giá trị."
            icon={Package}
            actionLabel="Đăng tin ngay"
            onAction={() => navigate('/listings/new')}
            className="bg-white"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Reputation & Reviews */}
      <section aria-labelledby="my-reviews-heading" className="space-y-4">
        <div className="flex items-center gap-2.5">
          <h2 id="my-reviews-heading" className="text-xl font-bold text-slate-900 tracking-tight">
            Đánh giá & Uy tín cộng đồng
          </h2>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Sparkles className="w-3 h-3 text-amber-600" aria-hidden="true" />
            <span>Phản hồi thực tế</span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Summary Breakdown Card */}
          <div className="lg:col-span-5">
            <RatingSummaryCard
              summary={ratingSummary}
              isLoading={isLoadingRating}
              isError={isRatingError}
              onRetry={refetchRating}
              userName={user.displayName}
            />
          </div>

          {/* Paginated Reviews List */}
          <div className="lg:col-span-7">
            <UserReviewsList
              reviews={reviewsData?.content ?? []}
              totalElements={reviewsData?.totalElements ?? 0}
              totalPages={reviewsData?.totalPages ?? 0}
              currentPage={reviewsPage}
              onPageChange={setReviewsPage}
              isLoading={isLoadingReviews}
              isError={isReviewsError}
              onRetry={refetchReviews}
              userName={user.displayName}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

export default MyProfilePage;
