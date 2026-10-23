import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Folder,
  MapPin,
  Package,
  ShieldCheck,
  Tag,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorAlert, LoadingSpinner } from '@/components/ui/Feedback';
import { formatDateTime, formatPrice, isValidUuid, resolveImageUrl } from '@/lib/utils';
import { useListing } from '../hooks/use-listings';
import { OwnerRatingBadge, OwnerReputationSection } from '@/features/reviews';
import type { ListingStatus, ListingType } from '@/types/listing';

const listingTypeConfig: Record<
  ListingType,
  { label: string; variant: 'success' | 'warning' | 'neutral' }
> = {
  GIVEAWAY: { label: 'Cho tặng', variant: 'success' },
  SALE: { label: 'Thanh lý', variant: 'warning' },
  WANTED: { label: 'Cần tìm', variant: 'neutral' },
};

const listingStatusConfig: Record<
  ListingStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'neutral' }
> = {
  ACTIVE: { label: 'Đang hiển thị', variant: 'success' },
  DRAFT: { label: 'Bản nháp', variant: 'neutral' },
  RESERVED: { label: 'Đã đặt trước', variant: 'warning' },
  COMPLETED: { label: 'Đã hoàn thành', variant: 'neutral' },
  CANCELLED: { label: 'Đã hủy', variant: 'destructive' },
  REMOVED: { label: 'Đã gỡ', variant: 'destructive' },
};

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageErrorMap, setImageErrorMap] = useState<Record<number, boolean>>({});

  const isIdValid = Boolean(id && isValidUuid(id));

  // Query hook will be disabled automatically if !isIdValid
  const { data: listing, isLoading, isError, error, refetch, isFetching } = useListing(id);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/explore');
    }
  };

  // State: Invalid Listing ID format
  if (!isIdValid) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <EmptyState
          title="Mã bài đăng không hợp lệ"
          description="Đường dẫn bài đăng không đúng định dạng. Vui lòng kiểm tra lại liên kết hoặc quay lại trang khám phá."
          icon={Package}
          actionLabel="Quay lại trang khám phá"
          onAction={() => navigate('/explore')}
        />
      </div>
    );
  }

  // State: Loading skeleton / spinner
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <div className="flex items-center gap-4">
          <div className="h-9 w-24 bg-slate-200 animate-pulse rounded-lg" />
          <div className="h-4 w-48 bg-slate-200 animate-pulse rounded" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            <div className="aspect-4/3 w-full bg-slate-200 animate-pulse rounded-2xl flex items-center justify-center">
              <LoadingSpinner size="lg" label="Đang tải thông tin bài đăng..." />
            </div>
            <div className="h-48 bg-slate-100 animate-pulse rounded-2xl" />
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="h-64 bg-slate-100 animate-pulse rounded-2xl" />
            <div className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // State: Error handling
  if (isError || !listing) {
    const isNotFound = error?.status === 404 || error?.status === 403;

    if (isNotFound) {
      return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <EmptyState
            title="Không tìm thấy bài đăng"
            description="Bài đăng này không tồn tại hoặc đã được gỡ bỏ khỏi hệ thống."
            icon={Package}
            actionLabel="Quay lại trang khám phá"
            onAction={() => navigate('/explore')}
          />
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-6">
        <ErrorAlert
          title="Không thể tải thông tin bài đăng"
          message="Đã xảy ra lỗi khi kết nối với máy chủ. Vui lòng kiểm tra đường truyền và thử lại."
          onRetry={() => refetch()}
          retryLabel="Thử lại"
          isRetrying={isFetching}
        />
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate('/explore')}>
            Quay lại trang khám phá
          </Button>
        </div>
      </div>
    );
  }

  // Extract listing information
  const typeInfo = listingTypeConfig[listing.listingType] || {
    label: listing.listingType,
    variant: 'neutral' as const,
  };

  const statusInfo = listingStatusConfig[listing.status] || {
    label: listing.status,
    variant: 'neutral' as const,
  };

  const locationParts = [
    listing.neighborhood,
    listing.city,
    listing.stateProvince,
    listing.country,
  ].filter(Boolean);
  const locationDisplay = locationParts.join(', ');

  const images = listing.images || [];
  const currentImage = images[selectedImageIndex];
  const currentImageUrl = currentImage ? resolveImageUrl(currentImage.imageUrl) : null;
  const isCurrentImageError = imageErrorMap[selectedImageIndex] ?? false;

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleThumbnailClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  const handleImageError = (index: number) => {
    setImageErrorMap((prev) => ({ ...prev, [index]: true }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      {/* Navigation Header: Back Action & Breadcrumbs */}
      <nav aria-label="Điều hướng bài đăng" className="flex flex-row items-center gap-3 md:gap-6 mb-6 overflow-hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBack}
          className="flex flex-row items-center justify-center gap-2 shrink-0 rounded-full border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-emerald-700 shadow-sm transition-colors font-medium [&>span]:flex [&>span]:flex-row [&>span]:items-center [&>span]:gap-1.5"
          aria-label="Quay lại"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Quay lại</span>
        </Button>

        <ol className="flex items-center gap-1.5 text-sm text-slate-500 whitespace-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0">
          <li className="flex items-center gap-1.5 shrink-0">
            <Link to="/" className="hover:text-emerald-700 transition-colors">
              Trang chủ
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          </li>

          <li className="flex items-center gap-1.5 shrink-0">
            <Link to="/explore" className="hover:text-emerald-700 transition-colors">
              Khám phá
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          </li>

          {listing.category && (
            <li className="flex items-center gap-1.5 shrink-0">
              <Link
                to={`/explore?categoryId=${listing.category.id}`}
                className="hover:text-emerald-700 transition-colors max-w-[120px] md:max-w-[180px] truncate"
              >
                {listing.category.name}
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            </li>
          )}

          <li className="shrink-0 max-w-[150px] md:max-w-xs truncate">
            <span className="text-slate-900 font-semibold truncate block" aria-current="page">
              {listing.title}
            </span>
          </li>
        </ol>
      </nav>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Image Gallery & Detailed Content */}
        <section aria-label="Hình ảnh và mô tả bài đăng" className="lg:col-span-7 space-y-6">
          {/* Gallery Container */}
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="relative aspect-4/3 w-full bg-slate-950/5 flex items-center justify-center overflow-hidden">
              {currentImageUrl && !isCurrentImageError ? (
                <img
                  src={currentImageUrl}
                  alt={`Hình ảnh ${selectedImageIndex + 1} của ${listing.title}`}
                  onError={() => handleImageError(selectedImageIndex)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div
                  className="flex flex-col items-center justify-center text-slate-400 p-8 text-center gap-2"
                  aria-label="Không có hình ảnh"
                >
                  <Package className="w-14 h-14 stroke-1 text-slate-300" aria-hidden="true" />
                  <span className="text-sm font-medium text-slate-500">
                    {images.length === 0
                      ? 'Bài đăng không có hình ảnh'
                      : 'Không thể tải hình ảnh này'}
                  </span>
                </div>
              )}

              {/* Gallery Arrow Controls (only if multiple images) */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    aria-label="Ảnh trước"
                  >
                    <ChevronLeft className="w-6 h-6" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    aria-label="Ảnh tiếp theo"
                  >
                    <ChevronRight className="w-6 h-6" aria-hidden="true" />
                  </button>
                  <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full text-xs font-semibold bg-black/60 text-white backdrop-blur-xs">
                    {selectedImageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail Strip (only if multiple images) */}
            {images.length > 1 && (
              <div
                role="tablist"
                aria-label="Danh sách ảnh thu nhỏ"
                className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center gap-2 overflow-x-auto"
              >
                {images.map((img, idx) => {
                  const thumbUrl = resolveImageUrl(img.imageUrl);
                  const isThumbSelected = idx === selectedImageIndex;
                  const isThumbError = imageErrorMap[idx] ?? false;

                  return (
                    <button
                      key={img.id || idx}
                      type="button"
                      role="tab"
                      aria-selected={isThumbSelected}
                      aria-label={`Xem ảnh ${idx + 1}`}
                      onClick={() => handleThumbnailClick(idx)}
                      className={`relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                        isThumbSelected
                          ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                      }`}
                    >
                      {thumbUrl && !isThumbError ? (
                        <img
                          src={thumbUrl}
                          alt={`Ảnh thu nhỏ ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={() => handleImageError(idx)}
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400">
                          <Package className="w-5 h-5 stroke-1" aria-hidden="true" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Description Section */}
          <article className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              <span>Mô tả chi tiết</span>
            </h2>

            <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-base break-words whitespace-pre-line">
              {listing.description?.trim() ? (
                listing.description
              ) : (
                <p className="text-slate-400 italic">
                  Người đăng chưa cung cấp mô tả chi tiết cho bài đăng này.
                </p>
              )}
            </div>
          </article>

          {/* Detailed Specifications Section */}
          <section aria-label="Thông số và thời gian đăng" className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              <span>Thông tin bài đăng</span>
            </h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Danh mục</dt>
                <dd className="mt-1 font-semibold text-slate-900 flex items-center gap-1.5">
                  <Folder className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <Link
                    to={`/explore?categoryId=${listing.category.id}`}
                    className="hover:text-emerald-700 transition-colors"
                  >
                    {listing.category.name}
                  </Link>
                </dd>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái bài đăng</dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                </dd>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ngày đăng</dt>
                <dd className="mt-1 font-medium text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  <time dateTime={listing.createdAt}>{formatDateTime(listing.createdAt)}</time>
                </dd>
              </div>

              {listing.updatedAt && listing.updatedAt !== listing.createdAt && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cập nhật lần cuối</dt>
                  <dd className="mt-1 font-medium text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                    <time dateTime={listing.updatedAt}>{formatDateTime(listing.updatedAt)}</time>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Owner Reputation, Ratings & Reviews Section (Phase 3F) */}
          <OwnerReputationSection
            userId={listing.owner.id}
            ownerName={listing.owner.displayName}
          />
        </section>

        {/* Right Column: Sticky Sidebar with Title, Price, Owner, Location & Safety */}
        <aside aria-label="Thông tin nhanh và liên hệ" className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
          {/* Primary Quick Info Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-5">
            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={typeInfo.variant} className="font-semibold text-xs px-2.5 py-1">
                {typeInfo.label}
              </Badge>

              {listing.status !== 'ACTIVE' && (
                <Badge variant={statusInfo.variant} className="font-semibold text-xs px-2.5 py-1">
                  {statusInfo.label}
                </Badge>
              )}

              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                {listing.category.name}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {listing.title}
            </h1>

            {/* Price Row */}
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
              {listing.listingType === 'GIVEAWAY' ? (
                <div>
                  <div className="text-3xl font-black text-emerald-600 tracking-tight">Miễn phí</div>
                  <p className="text-xs text-emerald-800 font-medium mt-1">
                    Món đồ được người đăng chia sẻ tặng miễn phí cho cộng đồng.
                  </p>
                </div>
              ) : listing.listingType === 'SALE' ? (
                <div>
                  {listing.price != null ? (
                    <div>
                      <div className="text-3xl font-black text-emerald-700 tracking-tight">
                        {formatPrice(listing.price, listing.currency)}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Giá bán được đặt bởi người đăng.</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-2xl font-bold text-slate-800">Giá thương lượng</div>
                      <p className="text-xs text-slate-500 mt-1">Liên hệ với người đăng để trao đổi chi tiết.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {listing.price != null ? (
                    <div>
                      <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">
                        Ngân sách mong muốn
                      </span>
                      <div className="text-2xl font-black text-emerald-700 tracking-tight mt-0.5">
                        {formatPrice(listing.price, listing.currency)}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xl font-bold text-slate-800">Cần tìm đồ</div>
                      <p className="text-xs text-slate-500 mt-1">
                        Người đăng đang tìm món đồ này với ngân sách thương lượng.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Location Display */}
            {locationDisplay && (
              <div className="flex items-start gap-2.5 pt-4 border-t border-slate-100 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
                <span className="font-medium text-slate-700">{locationDisplay}</span>
              </div>
            )}
          </div>

          {/* Owner Profile Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Người đăng bài
            </h2>

            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 font-bold text-lg flex items-center justify-center shrink-0 border border-emerald-200"
                aria-hidden="true"
              >
                {listing.owner.displayName?.charAt(0).toUpperCase() || (
                  <User className="w-6 h-6 text-emerald-700" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 text-base truncate">
                  {listing.owner.displayName}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  Thành viên cộng đồng ShareLoop
                </div>
              </div>
            </div>

            {/* Quick Rating Badge in Owner Card */}
            <div className="pt-3 border-t border-slate-100">
              <OwnerRatingBadge userId={listing.owner.id} />
            </div>
          </div>

          {/* Community Safety Tip Card */}
          <div className="bg-emerald-50/70 rounded-2xl border border-emerald-100/90 p-5 text-emerald-950 text-xs space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>Giao dịch an toàn</span>
            </div>
            <ul className="space-y-1.5 text-emerald-800 list-disc list-inside leading-relaxed">
              <li>Ưu tiên gặp gỡ trực tiếp tại địa điểm công cộng an toàn.</li>
              <li>Kiểm tra cẩn thận món đồ trước khi nhận hoặc hoàn tất trao đổi.</li>
              <li>Không chuyển khoản đặt cọc trước khi xác thực món đồ.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default ListingDetailPage;
