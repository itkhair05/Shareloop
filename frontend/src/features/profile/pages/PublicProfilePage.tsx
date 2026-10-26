import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Package, Sparkles } from 'lucide-react';
import { ListingCard } from '@/features/listings';
import {
  useUserRatingSummary,
  useUserReviews,
  RatingSummaryCard,
  UserReviewsList,
} from '@/features/reviews';
import { PublicProfileHeader } from '../components/PublicProfileHeader';
import { usePublicUserProfile, useUserActiveListings } from '../hooks/use-public-profile';
import { EmptyState, ErrorAlert, LoadingSpinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { isValidUuid } from '@/lib/utils';

export function PublicProfilePage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  // Check valid UUID parameter
  const isIdValid = Boolean(userId && isValidUuid(userId));

  // Pagination states
  const [listingsPage, setListingsPage] = useState(0);
  const [reviewsPage, setReviewsPage] = useState(0);

  // Queries
  const {
    data: user,
    isLoading: isLoadingUser,
    isError: isUserError,
    error: userError,
    refetch: refetchUser,
  } = usePublicUserProfile(userId);

  const {
    data: listingsData,
    isLoading: isLoadingListings,
    isError: isListingsError,
    refetch: refetchListings,
  } = useUserActiveListings(userId, { page: listingsPage, size: 8 });

  const {
    data: ratingSummary,
    isLoading: isLoadingRating,
    isError: isRatingError,
    refetch: refetchRating,
  } = useUserRatingSummary(userId);

  const {
    data: reviewsData,
    isLoading: isLoadingReviews,
    isError: isReviewsError,
    refetch: refetchReviews,
  } = useUserReviews(userId, { page: reviewsPage, size: 5 });

  // Handle invalid UUID route parameter
  if (!isIdValid) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-16 text-center">
        <EmptyState
          title="Mã người dùng không hợp lệ"
          description="Đường dẫn hồ sơ không đúng định dạng. Vui lòng kiểm tra lại liên kết."
          actionLabel="Khám phá đồ chia sẻ"
          onAction={() => navigate('/explore')}
        />
      </main>
    );
  }

  // Loading user profile
  if (isLoadingUser) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center p-8" aria-busy="true">
        <LoadingSpinner size="lg" label="Đang tải thông tin thành viên..." />
      </main>
    );
  }

  // User profile error
  if (isUserError || !user) {
    if (userError?.isNotFound) {
      return (
        <main className="max-w-4xl mx-auto px-4 py-16 text-center">
          <EmptyState
            title="Không tìm thấy người dùng"
            description="Tài khoản thành viên này không tồn tại hoặc đã bị ngừng hoạt động."
            actionLabel="Khám phá đồ chia sẻ"
            onAction={() => navigate('/explore')}
          />
        </main>
      );
    }

    return (
      <main className="max-w-4xl mx-auto px-4 py-16">
        <ErrorAlert
          title="Không thể tải hồ sơ người dùng"
          message="Đã xảy ra lỗi khi kết nối với máy chủ. Vui lòng thử lại sau."
          onRetry={refetchUser}
          retryLabel="Thử lại"
        />
      </main>
    );
  }

  const listings = listingsData?.content ?? [];
  const totalListings = listingsData?.totalElements ?? 0;
  const totalListingsPages = listingsData?.totalPages ?? 0;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back navigation */}
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Quay lại</span>
        </button>
      </div>

      {/* Public Profile Header (Avatar, Name, Badges, Join Date, Rating - No PII) */}
      <PublicProfileHeader
        user={user}
        ratingSummary={ratingSummary}
        isLoadingRating={isLoadingRating}
      />

      {/* Section 1: Active Listings */}
      <section aria-labelledby="user-listings-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 id="user-listings-heading" className="text-xl font-bold text-slate-900 tracking-tight">
              Tin đăng đang chia sẻ
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {totalListings} món đồ
            </span>
          </div>
        </div>

        {/* Listings content */}
        {isLoadingListings ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
            <LoadingSpinner size="md" label="Đang tải danh sách tin đăng của thành viên..." />
          </div>
        ) : isListingsError ? (
          <ErrorAlert
            title="Không thể tải tin đăng"
            message="Đã xảy ra lỗi khi kết nối với máy chủ để lấy danh sách tin đăng của thành viên."
            onRetry={refetchListings}
            retryLabel="Thử lại"
          />
        ) : listings.length === 0 ? (
          <EmptyState
            title="Chưa có tin đăng nào đang hoạt động"
            description={`${user.displayName} hiện chưa có tin đăng chia sẻ nào đang khả dụng trên ShareLoop.`}
            icon={Package}
            className="bg-white"
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalListingsPages > 1 && (
              <div className="flex items-center justify-between pt-6 border-t border-slate-200">
                <span className="text-xs text-slate-500">
                  Trang {listingsPage + 1} trên {totalListingsPages} ({totalListings} tin đăng)
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setListingsPage((p) => Math.max(0, p - 1))}
                    disabled={listingsPage === 0}
                    leftIcon={<ChevronLeft className="w-4 h-4" aria-hidden="true" />}
                  >
                    Trang trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setListingsPage((p) => Math.min(totalListingsPages - 1, p + 1))}
                    disabled={listingsPage >= totalListingsPages - 1}
                    rightIcon={<ChevronRight className="w-4 h-4" aria-hidden="true" />}
                  >
                    Trang sau
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 2: Community Reputation & Reviews */}
      <section aria-labelledby="user-reviews-heading" className="space-y-4">
        <div className="flex items-center gap-2.5">
          <h2 id="user-reviews-heading" className="text-xl font-bold text-slate-900 tracking-tight">
            Đánh giá & Uy tín cộng đồng
          </h2>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Sparkles className="w-3 h-3 text-amber-600" aria-hidden="true" />
            <span>Phản hồi từ các giao dịch</span>
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

export default PublicProfilePage;
