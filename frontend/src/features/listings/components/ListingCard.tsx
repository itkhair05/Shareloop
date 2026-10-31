import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Package } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/common/Avatar';
import { formatDateTime, formatPrice, resolveImageUrl } from '@/lib/utils';
import type { ListingSummaryResponse, ListingType } from '@/types/listing';

interface ListingCardProps {
  listing: ListingSummaryResponse;
}

const listingTypeConfig: Record<
  ListingType,
  { label: string; variant: 'success' | 'warning' | 'neutral' }
> = {
  GIVEAWAY: { label: 'Cho tặng', variant: 'success' },
  SALE: { label: 'Thanh lý', variant: 'warning' },
  WANTED: { label: 'Cần tìm', variant: 'neutral' },
};

export function ListingCard({ listing }: ListingCardProps) {
  const [imageError, setImageError] = useState(false);

  const resolvedImageUrl = resolveImageUrl(listing.primaryImageUrl);
  const typeInfo = listingTypeConfig[listing.listingType] || {
    label: listing.listingType,
    variant: 'neutral',
  };

  const locationDisplay = [listing.city, listing.country].filter(Boolean).join(', ');

  return (
    <article className="bg-white border border-slate-200 rounded-xl shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col overflow-hidden group">
      <Link
        to={`/listings/${listing.id}`}
        className="flex flex-col h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
        aria-label={`Xem chi tiết bài đăng: ${listing.title}`}
      >
        {/* Primary Image Container */}
      <div className="relative aspect-4/3 w-full bg-slate-100 overflow-hidden">
        {resolvedImageUrl && !imageError ? (
          <img
            src={resolvedImageUrl}
            alt={`Hình ảnh của ${listing.title}`}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 p-4"
            aria-label="Không có hình ảnh"
          >
            <Package className="w-8 h-8 stroke-1 text-slate-300" aria-hidden="true" />
            <span className="text-xs text-slate-400">Không có hình ảnh</span>
          </div>
        )}

        {/* Listing Type Badge */}
        <div className="absolute top-2.5 left-2.5">
          <Badge variant={typeInfo.variant} className="shadow-xs font-semibold">
            {typeInfo.label}
          </Badge>
        </div>

        {/* Category Pill */}
        <div className="absolute top-2.5 right-2.5">
          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-black/60 text-white backdrop-blur-xs">
            {listing.category.name}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <h3
            className="font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors"
            title={listing.title}
          >
            {listing.title}
          </h3>

          {/* Pricing Row */}
          <div className="mt-2 flex items-baseline gap-1.5">
            {listing.listingType === 'GIVEAWAY' ? (
              <span className="text-emerald-600 font-bold text-base">Miễn phí</span>
            ) : listing.listingType === 'SALE' ? (
              listing.price != null ? (
                <span className="text-emerald-700 font-bold text-base">
                  {formatPrice(listing.price, listing.currency)}
                </span>
              ) : (
                <span className="text-slate-600 font-medium text-sm">Thương lượng</span>
              )
            ) : listing.price != null ? (
              <span className="text-sm text-slate-600">
                Ngân sách: <strong className="text-emerald-700 font-semibold">{formatPrice(listing.price, listing.currency)}</strong>
              </span>
            ) : (
              <span className="text-sm font-medium text-slate-600">Cần tìm đồ</span>
            )}
          </div>
        </div>

        {/* Metadata Footer */}
        <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
          {locationDisplay && (
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              <span className="truncate">{locationDisplay}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1.5 truncate">
              <Avatar
                avatarUrl={listing.owner.avatarUrl}
                name={listing.owner.displayName}
                size="xs"
                alt={
                  listing.owner.displayName
                    ? `Ảnh đại diện của ${listing.owner.displayName}`
                    : 'Ảnh đại diện người dùng'
                }
                className="shrink-0"
              />
              <span className="truncate">{listing.owner.displayName}</span>
            </div>
            <time className="text-slate-400 text-[11px] shrink-0" dateTime={listing.createdAt}>
              {formatDateTime(listing.createdAt)}
            </time>
          </div>
        </div>
      </div>
      </Link>
    </article>
  );
}

export default ListingCard;
