import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StarRatingProps {
  rating: number; // 0 to 5
  maxStars?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showScore?: boolean;
  scoreText?: string;
  totalReviews?: number;
  className?: string;
}

const sizeConfig = {
  xs: { star: 'w-3 h-3', text: 'text-[11px]' },
  sm: { star: 'w-3.5 h-3.5', text: 'text-xs' },
  md: { star: 'w-4 h-4', text: 'text-sm' },
  lg: { star: 'w-5 h-5', text: 'text-base font-semibold' },
};

export function StarRating({
  rating,
  maxStars = 5,
  size = 'md',
  showScore = false,
  scoreText,
  totalReviews,
  className,
}: StarRatingProps) {
  const normalizedRating = Math.max(0, Math.min(maxStars, rating || 0));
  const roundedRating = Math.round(normalizedRating * 10) / 10;
  const config = sizeConfig[size];

  const ariaLabel =
    scoreText ||
    `${roundedRating} trên ${maxStars} sao${
      totalReviews !== undefined ? ` (${totalReviews} đánh giá)` : ''
    }`;

  return (
    <div
      className={cn('inline-flex items-center gap-1.5', className)}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxStars }).map((_, index) => {
          const starNumber = index + 1;
          const isFull = normalizedRating >= starNumber;
          const isPartial = !isFull && normalizedRating > index;
          const fillPercentage = isPartial
            ? Math.round((normalizedRating - index) * 100)
            : 0;

          return (
            <div key={index} className="relative inline-block">
              {/* Empty background star */}
              <Star
                className={cn(config.star, 'text-slate-200 fill-slate-100')}
                aria-hidden="true"
              />

              {/* Full star */}
              {isFull && (
                <Star
                  className={cn(
                    config.star,
                    'absolute inset-0 text-amber-400 fill-amber-400'
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Partial star via clipping */}
              {isPartial && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fillPercentage}%` }}
                >
                  <Star
                    className={cn(config.star, 'text-amber-400 fill-amber-400')}
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showScore && (
        <span className={cn('text-slate-700 font-bold ml-0.5', config.text)}>
          {roundedRating.toFixed(1)}
        </span>
      )}

      {totalReviews !== undefined && (
        <span className={cn('text-slate-500 text-xs font-normal', config.text)}>
          ({totalReviews})
        </span>
      )}
    </div>
  );
}

export default StarRating;
