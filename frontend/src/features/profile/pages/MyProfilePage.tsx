import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  LifeBuoy,
  Package,
  Pencil,
  Plus,
  ShieldAlert,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useMyListings, ListingCard } from '@/features/listings';
import {
  useUserRatingSummary,
  useUserReviews,
  RatingSummaryCard,
  UserReviewsList,
} from '@/features/reviews';
import { MySupportRequestsList } from '@/features/support';
import { MyReportsList } from '@/features/reports';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileStatsCards } from '../components/ProfileStatsCards';
import { GoogleAccountLinkingCard } from '../components/GoogleAccountLinkingCard';
import { EditProfileModal } from '../components/EditProfileModal';
import { EmptyState, ErrorAlert, LoadingSpinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';

export type ProfileTab = 'overview' | 'support' | 'reports';

export function MyProfilePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();

  const tabParam = searchParams.get('tab');
  const activeTab: ProfileTab =
    tabParam === 'support' || tabParam === 'reports' ? tabParam : 'overview';

  const handleTabChange = (tab: ProfileTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'overview') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    });
  };

  // Edit profile modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => setIsEditModalOpen(true)}
            leftIcon={<Pencil className="w-4 h-4 shrink-0" aria-hidden="true" />}
            className="shadow-2xs whitespace-nowrap"
          >
            Chỉnh sửa hồ sơ
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/listings/new')}
            leftIcon={<Plus className="w-4 h-4 shrink-0" />}
            className="shadow-sm whitespace-nowrap"
          >
            Đăng tin mới
          </Button>
        </div>
      </div>

      {/* Success notification */}
      {successMessage && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between text-sm font-medium shadow-xs animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Profile Header (Avatar, Details, Badges) */}
      <ProfileHeader
        user={user}
        ratingSummary={ratingSummary}
        isLoadingRating={isLoadingRating}
        onEditProfile={() => setIsEditModalOpen(true)}
      />

      {/* Tabs Navigation - ĐÃ SỬA ĐỂ CUỘN NGANG TRÊN MOBILE */}
      <div className="border-b border-slate-200">
        {/* Thêm overflow-x-auto để cuộn ngang nếu các tab quá dài, scrollbar-hide để ẩn thanh cuộn */}
        <nav className="flex overflow-x-auto scrollbar-hide -mb-px" aria-label="Tabs hồ sơ cá nhân">
          <button
            type="button"
            onClick={() => handleTabChange('overview')}
            className={`flex items-center gap-2 py-4 px-4 border-b-2 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <UserIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Tổng quan & Tin đăng</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('support')}
            className={`flex items-center gap-2 py-4 px-4 border-b-2 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'support'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <LifeBuoy className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Yêu cầu hỗ trợ của tôi</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('reports')}
            className={`flex items-center gap-2 py-4 px-4 border-b-2 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'reports'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Báo cáo vi phạm của tôi</span>
          </button>
        </nav>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Linked Accounts & Security */}
          <GoogleAccountLinkingCard />

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 id="my-listings-heading" className="text-xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
                  Tin đăng gần đây
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit whitespace-nowrap">
                  {totalListings} món đồ
                </span>
              </div>

              {totalListings > 0 && (
                <Link
                  to="/my-listings"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1.5 py-0.5 w-fit whitespace-nowrap shrink-0"
                >
                  <span>Xem tất cả ({totalListings})</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4">
              <h2 id="my-reviews-heading" className="text-xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
                Đánh giá & Uy tín cộng đồng
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 w-fit whitespace-nowrap shrink-0">
                <Sparkles className="w-3 h-3 text-amber-600 shrink-0" aria-hidden="true" />
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
        </div>
      )}

      {/* Tab 2: My Support Requests */}
      {activeTab === 'support' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Yêu cầu hỗ trợ của tôi
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Theo dõi tiến trình giải quyết và phản hồi từ Ban quản trị cho các câu hỏi hoặc khiếu nại của bạn.
            </p>
          </div>
          <MySupportRequestsList />
        </div>
      )}

      {/* Tab 3: My Violation Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Báo cáo vi phạm của tôi
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Xem lại các phản ánh vi phạm bạn đã gửi về người dùng, tin đăng hoặc giao dịch bất thường.
            </p>
          </div>
          <MyReportsList />
        </div>
      )}

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={user}
        onSuccess={() => {
          setSuccessMessage('Cập nhật thông tin hồ sơ thành công!');
        }}
      />
    </main>
  );
}

export default MyProfilePage;