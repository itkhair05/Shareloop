import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  Folder,
  MapPin,
  Package,
  Plus,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorAlert, LoadingSpinner } from '@/components/ui/Feedback';
import { useDeleteListing, useMyListings } from '../hooks/use-listings';
import { formatDateTime, formatPrice, resolveImageUrl } from '@/lib/utils';
import type { ListingStatus, ListingSummaryResponse, ListingType } from '@/types/listing';

const PAGE_SIZE = 10;

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

const STATUS_TABS: { label: string; value: ListingStatus | undefined }[] = [
  { label: 'Tất cả', value: undefined },
  { label: 'Đang hiển thị', value: 'ACTIVE' },
  { label: 'Đã đặt trước', value: 'RESERVED' },
  { label: 'Đã hoàn thành', value: 'COMPLETED' },
  { label: 'Bản nháp', value: 'DRAFT' },
  { label: 'Đã hủy / gỡ', value: 'REMOVED' },
];

export function MyListingsPage() {
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<ListingStatus | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(0);

  // Deletion modal state
  const [listingToDelete, setListingToDelete] = useState<ListingSummaryResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useMyListings({
    status: selectedStatus,
    page: currentPage,
    size: PAGE_SIZE,
  });

  const deleteListingMutation = useDeleteListing();

  const handleStatusChange = (status: ListingStatus | undefined) => {
    setSelectedStatus(status);
    setCurrentPage(0);
    setDeleteError(null);
    setActionSuccess(null);
  };

  const handleConfirmDelete = async () => {
    if (!listingToDelete) return;
    setDeleteError(null);

    try {
      await deleteListingMutation.mutateAsync(listingToDelete.id);
      setActionSuccess(`Đã xóa bài đăng "${listingToDelete.title}" thành công.`);
      setListingToDelete(null);
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Không thể xóa bài đăng. Vui lòng kiểm tra lại quyền hạn và thử lại.'
      );
    }
  };

  const listings = data?.content || [];
  const totalElements = data?.totalElements || 0;
  const totalPages = data?.totalPages || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Bài đăng của tôi
            </h1>
            {!isLoading && (
              <Badge variant="neutral" className="text-xs">
                {totalElements} bài đăng
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý các món đồ bạn đang chia sẻ, thanh lý hoặc cần tìm kiếm
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => navigate('/listings/new')}
          leftIcon={<Plus className="w-4 h-4" />}
          className="self-start sm:self-auto shadow-xs"
        >
          Đăng bài mới
        </Button>
      </div>

      {/* Success Notification Alert */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Delete Error Alert */}
      {deleteError && (
        <ErrorAlert
          title="Lỗi khi xóa bài đăng"
          message={deleteError}
          className="animate-in fade-in duration-200"
        />
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-slate-200">
        {STATUS_TABS.map((tab) => {
          const isSelected = selectedStatus === tab.value;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => handleStatusChange(tab.value)}
              className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner size="lg" label="Đang tải danh sách bài đăng..." />
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="py-8">
          <ErrorAlert
            title="Không thể tải danh sách bài đăng"
            message={
              error?.message ||
              'Đã xảy ra lỗi khi kết nối với máy chủ. Vui lòng kiểm tra lại kết nối mạng.'
            }
            onRetry={() => refetch()}
            isRetrying={isFetching}
          />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && listings.length === 0 && (
        <div className="py-12">
          <EmptyState
            title="Chưa có bài đăng nào"
            description={
              selectedStatus
                ? `Không có bài đăng nào ở trạng thái "${
                    STATUS_TABS.find((t) => t.value === selectedStatus)?.label
                  }".`
                : 'Bạn chưa tạo bài đăng nào trên ShareLoop. Hãy chia sẻ món đồ đầu tiên để bắt đầu kết nối!'
            }
            icon={Package}
            actionLabel="Đăng bài ngay"
            onAction={() => navigate('/listings/new')}
          />
        </div>
      )}

      {/* Listings List */}
      {!isLoading && !isError && listings.length > 0 && (
        <div className="space-y-4">
          {listings.map((item) => {
            const resolvedImg = resolveImageUrl(item.primaryImageUrl);
            const typeInfo = listingTypeConfig[item.listingType] || {
              label: item.listingType,
              variant: 'neutral' as const,
            };
            const statusInfo = listingStatusConfig[item.status] || {
              label: item.status,
              variant: 'neutral' as const,
            };

            const isLocked = item.status === 'COMPLETED' || item.status === 'REMOVED';

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Thumbnail & Info */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                    {resolvedImg ? (
                      <img
                        src={resolvedImg}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Package className="w-8 h-8 text-slate-300" aria-hidden="true" />
                    )}
                  </div>

                  {/* Text Meta */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={typeInfo.variant} className="text-xs">
                        {typeInfo.label}
                      </Badge>
                      <Badge variant={statusInfo.variant} className="text-xs">
                        {statusInfo.label}
                      </Badge>
                      {item.category && (
                        <span className="text-xs text-slate-500 flex items-center gap-1 truncate">
                          <Folder className="w-3.5 h-3.5 text-slate-400" />
                          {item.category.name}
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/listings/${item.id}`}
                      className="font-bold text-slate-900 text-base hover:text-emerald-700 transition-colors block truncate"
                      title={item.title}
                    >
                      {item.title}
                    </Link>

                    {/* Price display */}
                    <div className="text-sm font-semibold">
                      {item.listingType === 'GIVEAWAY' ? (
                        <span className="text-emerald-600 font-bold">Miễn phí</span>
                      ) : item.listingType === 'SALE' ? (
                        <span className="text-emerald-700 font-bold">
                          {formatPrice(item.price, item.currency)}
                        </span>
                      ) : item.price != null ? (
                        <span className="text-slate-600">
                          Ngân sách:{' '}
                          <strong className="text-emerald-700">
                            {formatPrice(item.price, item.currency)}
                          </strong>
                        </span>
                      ) : (
                        <span className="text-slate-600">Cần tìm đồ</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-0.5">
                      {item.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {[item.city, item.country].filter(Boolean).join(', ')}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 self-end md:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/listings/${item.id}`)}
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                    aria-label={`Xem chi tiết bài đăng ${item.title}`}
                  >
                    Xem
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/listings/${item.id}/edit`)}
                    disabled={isLocked}
                    leftIcon={<Edit className="w-3.5 h-3.5" />}
                    aria-label={`Chỉnh sửa bài đăng ${item.title}`}
                    title={
                      isLocked
                        ? 'Bài đăng đã hoàn thành hoặc đã gỡ không thể chỉnh sửa'
                        : undefined
                    }
                  >
                    Sửa
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setListingToDelete(item)}
                    leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                    className="hover:bg-red-50 hover:border-red-200 text-red-700"
                    aria-label={`Xóa bài đăng ${item.title}`}
                  >
                    Xóa
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                Trang {currentPage + 1} trên {totalPages} ({totalElements} bài đăng)
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Trang sau
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(listingToDelete)}
        onClose={() => setListingToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Xác nhận xóa bài đăng"
        message={
          listingToDelete ? (
            <div className="space-y-2">
              <p>
                Bạn có chắc chắn muốn xóa bài đăng <strong>"{listingToDelete.title}"</strong>?
              </p>
              <p className="text-xs text-slate-500">
                Bài đăng sẽ bị gỡ khỏi hệ thống và không còn hiển thị với cộng đồng.
              </p>
            </div>
          ) : null
        }
        confirmText="Xác nhận xóa"
        cancelText="Hủy"
        variant="danger"
        isLoading={deleteListingMutation.isPending}
      />
    </div>
  );
}

export default MyListingsPage;
