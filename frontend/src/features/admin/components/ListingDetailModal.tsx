import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FolderTree,
  ImageIcon,
  MapPin,
  RefreshCw,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime, resolveImageUrl } from '@/lib/utils';
import { useAdminListingDetail } from '../hooks/use-admin-listings';
import type { ListingResponse, ListingStatus, ListingType } from '@/types/admin-listing';

export interface ListingDetailModalProps {
  listingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDeleteModal?: (listing: ListingResponse) => void;
}

export function ListingDetailModal({
  listingId,
  isOpen,
  onClose,
  onOpenDeleteModal,
}: ListingDetailModalProps) {
  const { data: detail, isLoading, isError, error, refetch } = useAdminListingDetail(
    isOpen ? listingId : null
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [prevListingId, setPrevListingId] = useState(listingId);

  if (listingId !== prevListingId) {
    setPrevListingId(listingId);
    setSelectedImageIndex(0);
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!isOpen) return null;

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
        return 'Đã gỡ bỏ';
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
    if (type === 'GIVEAWAY') return 'Miễn phí (Tặng đồ)';
    if (price == null || price === 0) {
      return type === 'WANTED' ? 'Theo thương lượng' : 'Chưa định giá';
    }
    return `${Number(price).toLocaleString('vi-VN')} ${currency || 'VND'}`;
  };

  // Check if listing can be safely deleted/delisted by admin
  const isDeletable =
    detail &&
    detail.status !== 'RESERVED' &&
    detail.status !== 'COMPLETED' &&
    detail.status !== 'REMOVED';

  const deleteDisabledReason =
    detail?.status === 'RESERVED'
      ? 'Tin đăng đang trong giao dịch đã đặt chỗ (RESERVED). Cần giải quyết giao dịch trước.'
      : detail?.status === 'COMPLETED'
        ? 'Tin đăng đã hoàn tất giao dịch (COMPLETED). Không được gỡ bỏ.'
        : detail?.status === 'REMOVED'
          ? 'Tin đăng đã được gỡ bỏ trước đó.'
          : undefined;

  const images = detail?.images || [];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-detail-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 id="listing-detail-modal-title" className="text-sm font-bold text-slate-900">
                Chi tiết tin đăng
              </h3>
              <p className="text-[11px] text-slate-500 font-mono truncate max-w-[300px]">
                {listingId || 'Không có ID'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {listingId && (
              <a
                href={`/listings/${listingId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-row items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                title="Xem bài đăng trên trang công khai"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Xem trên web</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer shrink-0"
              aria-label="Đóng cửa sổ chi tiết"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
              <p className="text-xs">Đang tải thông tin chi tiết tin đăng...</p>
            </div>
          ) : isError || !detail ? (
            <div className="py-12 px-4 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Không thể tải thông tin tin đăng</p>
              <p className="text-xs text-slate-500 max-w-xs">
                {(error as Error)?.message || 'Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.'}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 inline-flex flex-row items-center justify-center gap-2 h-9 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Thử lại</span>
              </button>
            </div>
          ) : (
            <>
              {/* Top Banner Status & Types */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusBadgeVariant(detail.status)} className="whitespace-nowrap shrink-0">
                    {getStatusLabel(detail.status)}
                  </Badge>
                  <Badge variant={getTypeBadgeVariant(detail.listingType)} className="whitespace-nowrap shrink-0">
                    {getTypeLabel(detail.listingType)}
                  </Badge>
                </div>
                <div className="text-xs font-semibold text-emerald-700 font-mono whitespace-nowrap">
                  {formatPrice(detail.price, detail.currency, detail.listingType)}
                </div>
              </div>

              {/* Title & Copy ID */}
              <div>
                <h4 className="text-base font-bold text-slate-900 leading-snug">
                  {detail.title}
                </h4>
                <div className="flex items-center gap-1.5 mt-1 text-slate-500 font-mono text-[11px]">
                  <span className="truncate">ID: {detail.id}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(detail.id, 'id')}
                    className="p-1 hover:text-slate-800 rounded transition-colors cursor-pointer shrink-0"
                    title="Sao chép ID tin đăng"
                    aria-label="Sao chép ID tin đăng"
                  >
                    {copiedField === 'id' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Images Gallery */}
              {images.length > 0 ? (
                <div className="space-y-2">
                  <div className="relative aspect-video max-h-56 w-full overflow-hidden rounded-lg bg-slate-100 border border-slate-200">
                    <img
                      src={resolveImageUrl(images[selectedImageIndex]?.imageUrl) ?? undefined}
                      alt={`${detail.title} - ảnh ${selectedImageIndex + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {images.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {images.map((img, idx) => (
                        <button
                          key={img.id || idx}
                          type="button"
                          onClick={() => setSelectedImageIndex(idx)}
                          className={`relative w-14 h-14 rounded-md overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                            selectedImageIndex === idx
                              ? 'border-emerald-600 ring-2 ring-emerald-600/20'
                              : 'border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          <img
                            src={resolveImageUrl(img.imageUrl) ?? undefined}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400 gap-2">
                  <ImageIcon className="w-5 h-5 text-slate-400" />
                  <span>Tin đăng không có hình ảnh minh họa</span>
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-700">Mô tả chi tiết:</span>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {detail.description || 'Không có mô tả'}
                </div>
              </div>

              {/* Two Column Attributes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category & Location */}
                <div className="space-y-2.5 p-3.5 bg-slate-50/70 rounded-lg border border-slate-200/70">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold">
                    <FolderTree className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Danh mục & Địa điểm</span>
                  </div>
                  <div className="space-y-1 text-slate-600">
                    <div>
                      <span className="text-slate-400">Danh mục: </span>
                      <span className="font-medium text-slate-800">
                        {detail.category?.name || 'Chưa phân loại'}
                      </span>
                    </div>
                    <div className="flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>
                        {[detail.neighborhood, detail.city, detail.stateProvince, detail.country]
                          .filter(Boolean)
                          .join(', ') || 'Chưa cập nhật địa điểm'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Owner Information */}
                <div className="space-y-2.5 p-3.5 bg-slate-50/70 rounded-lg border border-slate-200/70">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold">
                    <User className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Người đăng tin</span>
                  </div>
                  <div className="flex items-start gap-3 text-slate-600">
                    <Avatar
                      avatarUrl={detail.owner?.avatarUrl}
                      name={detail.owner?.displayName}
                      size="md"
                      alt={
                        detail.owner?.displayName
                          ? `Ảnh đại diện của ${detail.owner.displayName}`
                          : 'Ảnh đại diện người đăng tin'
                      }
                    />
                    <div className="min-w-0 space-y-1">
                      <div>
                        <span className="text-slate-400">Họ và tên: </span>
                        <span className="font-medium text-slate-800">
                          {detail.owner?.displayName || 'Ẩn danh'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                        <span className="truncate">ID: {detail.owner?.id}</span>
                        {detail.owner?.id && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(detail.owner!.id, 'ownerId')}
                            className="p-0.5 hover:text-slate-800 rounded transition-colors cursor-pointer shrink-0"
                            title="Sao chép ID người đăng"
                            aria-label="Sao chép ID người đăng"
                          >
                            {copiedField === 'ownerId' ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-slate-500 text-[11px]">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Ngày tạo: {formatDateTime(detail.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Cập nhật: {formatDateTime(detail.updatedAt)}</span>
                </div>
                {detail.expiresAt && (
                  <div className="flex items-center gap-1.5 text-amber-600 whitespace-nowrap">
                    <span>Hết hạn: {formatDateTime(detail.expiresAt)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer - Dùng thẻ button thuần để không bị rớt dòng */}
        <div className="flex flex-row flex-nowrap items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 shrink-0">
          <div className="min-w-0">
            {detail && onOpenDeleteModal && (
              <button
                type="button"
                disabled={!isDeletable}
                onClick={() => {
                  onClose();
                  onOpenDeleteModal(detail);
                }}
                title={deleteDisabledReason}
                className="inline-flex flex-row items-center justify-center gap-2 h-9 px-3.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Gỡ / Xóa tin</span>
              </button>
            )}
            {deleteDisabledReason && (
              <p className="text-[10px] text-amber-600 mt-1 max-w-sm">
                {deleteDisabledReason}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex flex-row items-center justify-center h-9 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <span className="whitespace-nowrap">Đóng</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ListingDetailModal;