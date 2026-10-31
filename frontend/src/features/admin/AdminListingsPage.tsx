import { useEffect, useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FolderTree,
  ImageIcon,
  Package,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDateTime, resolveImageUrl } from '@/lib/utils';
import { categoryApi, categoryKeys } from '@/features/categories/api/category-api';
import { useAdminDeleteListing, useAdminListings } from './hooks/use-admin-listings';
import { ListingDetailModal } from './components/ListingDetailModal';
import type {
  AdminListingQueryParams,
  ListingResponse,
  ListingStatus,
  ListingType,
} from '@/types/admin-listing';

const statusOptions: { label: string; value: string }[] = [
  { label: 'Tất cả trạng thái', value: 'ALL' },
  { label: 'Đang hiển thị', value: 'ACTIVE' },
  { label: 'Bản nháp', value: 'DRAFT' },
  { label: 'Đã đặt chỗ', value: 'RESERVED' },
  { label: 'Đã hoàn tất', value: 'COMPLETED' },
  { label: 'Đã hủy', value: 'CANCELLED' },
  { label: 'Đã gỡ', value: 'REMOVED' },
];

const typeOptions: { label: string; value: string }[] = [
  { label: 'Tất cả hình thức', value: 'ALL' },
  { label: 'Tặng đồ', value: 'GIVEAWAY' },
  { label: 'Thanh lý', value: 'SALE' },
  { label: 'Tìm đồ', value: 'WANTED' },
];

export function AdminListingsPage() {
  const searchInputId = useId();
  const typeSelectId = useId();
  const categorySelectId = useId();

  // State: Pagination & Filters
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Modal states
  const [detailListingId, setDetailListingId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [listingToDelete, setListingToDelete] = useState<ListingResponse | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Feedback banner state
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Debounce search input by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(searchInput.trim());
      setPage(0);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load real categories for category dropdown filter
  const { data: categories = [] } = useQuery({
    queryKey: categoryKeys.lists(),
    queryFn: () => categoryApi.getCategories(),
  });

  // Query parameters for the backend API
  const queryParams: AdminListingQueryParams = useMemo(() => {
    return {
      page,
      size,
      keyword: debouncedKeyword.length > 0 ? debouncedKeyword : undefined,
      status: statusFilter !== 'ALL' ? (statusFilter as ListingStatus) : undefined,
      type: typeFilter !== 'ALL' ? (typeFilter as ListingType) : undefined,
      categoryId: categoryFilter !== 'ALL' ? categoryFilter : undefined,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    };
  }, [page, size, debouncedKeyword, statusFilter, typeFilter, categoryFilter]);

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminListings(queryParams);
  const deleteMutation = useAdminDeleteListing();

  const listings = data?.content || [];
  const totalElements = data?.totalElements || 0;
  const totalPages = data?.totalPages || 0;

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setPage(0);
  };

  const handleTypeFilterChange = (type: string) => {
    setTypeFilter(type);
    setPage(0);
  };

  const handleCategoryFilterChange = (categoryId: string) => {
    setCategoryFilter(categoryId);
    setPage(0);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedKeyword('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setCategoryFilter('ALL');
    setPage(0);
  };

  const handleOpenDetail = (id: string) => {
    setDetailListingId(id);
    setIsDetailOpen(true);
  };

  const handleOpenDelete = (listing: ListingResponse) => {
    setListingToDelete(listing);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!listingToDelete) return;

    try {
      await deleteMutation.mutateAsync(listingToDelete.id);
      setIsDeleteDialogOpen(false);
      setListingToDelete(null);
      setFeedback({
        type: 'success',
        text: `Đã xử lý gỡ bỏ tin đăng "${listingToDelete.title}" thành công.`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: (err as Error)?.message || 'Có lỗi xảy ra khi gỡ bỏ tin đăng. Vui lòng thử lại.',
      });
    }
  };

  const getStatusBadgeVariant = (status?: ListingStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'RESERVED':
        return 'warning';
      case 'COMPLETED':
        return 'default';
      case 'REMOVED':
        return 'destructive';
      case 'CANCELLED':
        return 'neutral';
      case 'DRAFT':
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status?: ListingStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'Đang hiển thị';
      case 'RESERVED':
        return 'Đã đặt chỗ';
      case 'COMPLETED':
        return 'Đã hoàn tất';
      case 'REMOVED':
        return 'Đã gỡ';
      case 'CANCELLED':
        return 'Đã hủy';
      case 'DRAFT':
        return 'Bản nháp';
      default:
        return status || 'Không rõ';
    }
  };

  const getTypeBadgeVariant = (type?: ListingType) => {
    switch (type) {
      case 'GIVEAWAY':
        return 'success';
      case 'SALE':
        return 'default';
      case 'WANTED':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const getTypeLabel = (type?: ListingType) => {
    switch (type) {
      case 'GIVEAWAY':
        return 'Tặng đồ';
      case 'SALE':
        return 'Thanh lý';
      case 'WANTED':
        return 'Tìm đồ';
      default:
        return type || 'Khác';
    }
  };

  const formatPrice = (price?: number | null, currency?: string | null, type?: ListingType) => {
    if (type === 'GIVEAWAY') return 'Miễn phí';
    if (price == null || price === 0) {
      return type === 'WANTED' ? 'Thương lượng' : 'Chưa định giá';
    }
    return `${Number(price).toLocaleString('vi-VN')} ${currency || 'VND'}`;
  };

  // Safe deletion predicate: do not allow deletion of RESERVED, COMPLETED, or REMOVED listings
  const isDeletable = (listing: ListingResponse) =>
    listing.status !== 'RESERVED' &&
    listing.status !== 'COMPLETED' &&
    listing.status !== 'REMOVED';

  const getDeleteDisabledTooltip = (listing: ListingResponse) => {
    if (listing.status === 'RESERVED') {
      return 'Không thể gỡ: tin đăng đang có giao dịch đang diễn ra (RESERVED).';
    }
    if (listing.status === 'COMPLETED') {
      return 'Không thể gỡ: tin đăng đã hoàn tất giao dịch (COMPLETED).';
    }
    if (listing.status === 'REMOVED') {
      return 'Tin đăng đã được gỡ bỏ trước đó.';
    }
    return undefined;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Quản lý tin đăng
            </h1>
            <Badge variant="neutral" className="font-mono text-xs shrink-0 whitespace-nowrap">
              {totalElements.toLocaleString('vi-VN')} tin đăng
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tra cứu, kiểm duyệt nội dung, theo dõi trạng thái và quản lý tin đăng trên toàn nền tảng ShareLoop
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex flex-row items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-xs disabled:opacity-50"
            title="Làm mới danh sách tin đăng"
            aria-label="Làm mới danh sách tin đăng"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="whitespace-nowrap">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Dismissible Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Card */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 space-y-3.5">
          {/* Search Row */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <label htmlFor={searchInputId} className="sr-only">
                Tìm kiếm tin đăng
              </label>
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id={searchInputId}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo tiêu đề tin đăng, mô tả..."
                className="w-full text-xs text-slate-900 pl-9 pr-8 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  aria-label="Xóa từ khóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Type & Category Selects */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <label htmlFor={typeSelectId} className="sr-only">
                  Lọc theo hình thức
                </label>
                <select
                  id={typeSelectId}
                  value={typeFilter}
                  onChange={(e) => handleTypeFilterChange(e.target.value)}
                  className="text-xs text-slate-700 bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                >
                  {typeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <label htmlFor={categorySelectId} className="sr-only">
                  Lọc theo danh mục
                </label>
                <select
                  id={categorySelectId}
                  value={categoryFilter}
                  onChange={(e) => handleCategoryFilterChange(e.target.value)}
                  className="text-xs text-slate-700 bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer max-w-[180px]"
                >
                  <option value="ALL">Tất cả danh mục</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {(searchInput ||
                statusFilter !== 'ALL' ||
                typeFilter !== 'ALL' ||
                categoryFilter !== 'ALL') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-xs text-slate-500 hover:text-slate-700 shrink-0"
                >
                  Đặt lại
                </Button>
              )}
            </div>
          </div>

          {/* Status Tabs / Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {statusOptions.map((opt) => {
              const isActive = statusFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleStatusFilterChange(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
            <p className="text-xs font-medium">Đang tải danh sách tin đăng...</p>
          </div>
        ) : isError ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-900">Không thể tải danh sách tin đăng</p>
            <p className="text-xs text-slate-500 max-w-sm">
              {(error as Error)?.message || 'Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Thử lại
            </Button>
          </div>
        ) : listings.length === 0 ? (
          <div className="py-20 px-4 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-900">Không tìm thấy tin đăng nào</p>
            <p className="text-xs text-slate-500 max-w-xs">
              {debouncedKeyword || statusFilter !== 'ALL' || typeFilter !== 'ALL' || categoryFilter !== 'ALL'
                ? 'Không có tin đăng nào phù hợp với bộ lọc hiện tại. Hãy thử thay đổi hoặc đặt lại bộ lọc.'
                : 'Chưa có tin đăng nào trên hệ thống.'}
            </p>
            {(debouncedKeyword || statusFilter !== 'ALL' || typeFilter !== 'ALL' || categoryFilter !== 'ALL') && (
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-2">
                Đặt lại bộ lọc
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th scope="col" className="py-3 px-4">Tin đăng</th>
                  <th scope="col" className="py-3 px-4">Người đăng</th>
                  <th scope="col" className="py-3 px-4">Hình thức & Giá</th>
                  <th scope="col" className="py-3 px-4">Danh mục</th>
                  <th scope="col" className="py-3 px-4">Trạng thái</th>
                  <th scope="col" className="py-3 px-4">Ngày đăng</th>
                  <th scope="col" className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {listings.map((item) => {
                  const deletable = isDeletable(item);
                  const deleteTooltip = getDeleteDisabledTooltip(item);
                  const primaryImg = item.images && item.images.length > 0
                    ? resolveImageUrl(item.images[0].imageUrl)
                    : null;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/60 transition-colors group"
                    >
                      {/* Thumbnail & Title */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                            {primaryImg ? (
                              <img
                                src={primaryImg}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p
                              className="font-medium text-slate-900 truncate group-hover:text-emerald-700 transition-colors"
                              title={item.title}
                            >
                              {item.title}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                              ID: {item.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            avatarUrl={item.owner?.avatarUrl}
                            name={item.owner?.displayName}
                            size="sm"
                            alt={
                              item.owner?.displayName
                                ? `Ảnh đại diện của ${item.owner.displayName}`
                                : 'Ảnh đại diện người đăng tin'
                            }
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">
                              {item.owner?.displayName || 'Ẩn danh'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {item.city || 'Chưa có địa điểm'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Type & Price */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <Badge variant={getTypeBadgeVariant(item.listingType)}>
                            {getTypeLabel(item.listingType)}
                          </Badge>
                          <p className="text-[11px] font-semibold text-slate-700 font-mono">
                            {formatPrice(item.price, item.currency, item.listingType)}
                          </p>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <FolderTree className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.category?.name || 'Chưa phân loại'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge variant={getStatusBadgeVariant(item.status)}>
                          {getStatusLabel(item.status)}
                        </Badge>
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        {formatDateTime(item.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(item.id)}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Xem chi tiết tin đăng"
                            aria-label={`Xem chi tiết tin đăng ${item.title}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDelete(item)}
                            disabled={!deletable}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              deletable
                                ? 'text-slate-600 hover:text-red-600 hover:bg-red-50'
                                : 'text-slate-300 cursor-not-allowed opacity-50'
                            }`}
                            title={deleteTooltip || 'Gỡ bỏ tin đăng'}
                            aria-label={`Gỡ bỏ tin đăng ${item.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Hiển thị trang <span className="font-semibold text-slate-900">{page + 1}</span> /{' '}
              <span className="font-semibold text-slate-900">{totalPages}</span> (Tổng số{' '}
              <span className="font-semibold text-slate-900">{totalElements.toLocaleString('vi-VN')}</span> tin đăng)
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
                className="gap-1 px-2.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Trước</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isFetching}
                className="gap-1 px-2.5"
              >
                <span>Sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Listing Detail Modal */}
      <ListingDetailModal
        listingId={detailListingId}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailListingId(null);
        }}
        onOpenDeleteModal={(listing) => {
          setListingToDelete(listing);
          setIsDeleteDialogOpen(true);
        }}
      />

      {/* Delete / Moderation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setIsDeleteDialogOpen(false);
            setListingToDelete(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Gỡ bỏ tin đăng"
        variant="danger"
        confirmText="Xác nhận gỡ tin"
        cancelText="Hủy bỏ"
        isLoading={deleteMutation.isPending}
        message={
          <div className="space-y-2">
            <p>
              Bạn có chắc chắn muốn gỡ bỏ tin đăng{' '}
              <strong className="text-slate-900">"{listingToDelete?.title}"</strong>?
            </p>
            <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg">
              Lưu ý: Nếu tin đăng đã có yêu cầu giao dịch liên quan, trạng thái sẽ được chuyển thành{' '}
              <span className="font-semibold">Đã gỡ (REMOVED)</span> để bảo toàn tính toàn vẹn dữ liệu. Nếu chưa có giao dịch, tin đăng sẽ được xóa hoàn toàn khỏi cơ sở dữ liệu.
            </p>
          </div>
        }
      />
    </div>
  );
}

export default AdminListingsPage;
