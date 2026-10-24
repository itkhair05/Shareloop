import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Filter, LayoutGrid, MapPin, Search, X } from 'lucide-react';
import { cn, isValidUuid } from '@/lib/utils';
import { useDebounce } from '@/lib/use-debounce';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorAlert, LoadingSpinner } from '@/components/ui/Feedback';
import { useCategories } from '@/features/categories';
import { ListingCard, useListings } from '@/features/listings';
import type { ListingQueryParams, ListingType } from '@/types/listing';

const VALID_TYPES: ListingType[] = ['GIVEAWAY', 'SALE', 'WANTED'];
const PAGE_SIZE = 12;

export function ExplorePlaceholderPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL search params
  const urlKeyword = searchParams.get('keyword') || '';
  const urlCity = searchParams.get('city') || '';
  const rawType = searchParams.get('type') as ListingType | null;
  const selectedType = rawType && VALID_TYPES.includes(rawType) ? rawType : undefined;

  const rawCategoryId = searchParams.get('categoryId') || undefined;
  const selectedCategoryId = isValidUuid(rawCategoryId) ? rawCategoryId : undefined;

  // Safe zero-based page parsing
  const rawPage = searchParams.get('page');
  const currentPage = useMemo(() => {
    if (rawPage === null) return 0;
    const parsed = parseInt(rawPage, 10);
    return !isNaN(parsed) && parsed >= 0 ? parsed : 0;
  }, [rawPage]);

  // Local controlled inputs for debouncing
  const [keywordInput, setKeywordInput] = useState(() => urlKeyword);
  const [cityInput, setCityInput] = useState(() => urlCity);

  // Sync inputs when URL changes externally (e.g. back/forward, reset button)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKeywordInput(urlKeyword);
  }, [urlKeyword]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCityInput(urlCity);
  }, [urlCity]);

  // Debounced values (300ms)
  const debouncedKeyword = useDebounce(keywordInput.trim(), 300);
  const debouncedCity = useDebounce(cityInput.trim(), 300);

  // Sync debounced keyword to URL and reset page to 0
  useEffect(() => {
    const currentInUrl = searchParams.get('keyword') || '';
    if (debouncedKeyword !== currentInUrl) {
      const nextParams = new URLSearchParams(searchParams);
      if (debouncedKeyword) {
        nextParams.set('keyword', debouncedKeyword);
      } else {
        nextParams.delete('keyword');
      }
      nextParams.delete('page'); // Reset to page 0 on filter change
      setSearchParams(nextParams, { replace: true });
    }
  }, [debouncedKeyword, searchParams, setSearchParams]);

  // Sync debounced city to URL and reset page to 0
  useEffect(() => {
    const currentInUrl = searchParams.get('city') || '';
    if (debouncedCity !== currentInUrl) {
      const nextParams = new URLSearchParams(searchParams);
      if (debouncedCity) {
        nextParams.set('city', debouncedCity);
      } else {
        nextParams.delete('city');
      }
      nextParams.delete('page'); // Reset to page 0 on filter change
      setSearchParams(nextParams, { replace: true });
    }
  }, [debouncedCity, searchParams, setSearchParams]);

  // Fetch Categories
  const {
    data: categories,
    isLoading: isCategoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useCategories();

  const activeCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter((category) => category.isActive);
  }, [categories]);

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId || !activeCategories) return undefined;
    return activeCategories.find((c) => c.id === selectedCategoryId);
  }, [activeCategories, selectedCategoryId]);

  // Build listing query params with pagination and verified filters
  const listingParams = useMemo(() => {
    const params: ListingQueryParams = {
      page: currentPage,
      size: PAGE_SIZE,
    };
    if (urlKeyword.trim()) params.keyword = urlKeyword.trim();
    if (selectedType) params.type = selectedType;
    if (selectedCategoryId) params.categoryId = selectedCategoryId;
    if (urlCity.trim()) params.city = urlCity.trim();
    return params;
  }, [currentPage, urlKeyword, selectedType, selectedCategoryId, urlCity]);

  // Fetch Listings with query parameters
  const {
    data: listingsData,
    isLoading: isListingsLoading,
    isFetching: isListingsFetching,
    error: listingsError,
    refetch: refetchListings,
  } = useListings(listingParams);

  const listings = useMemo(() => {
    return listingsData?.content ?? [];
  }, [listingsData]);

  // Pagination navigation handler
  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage || newPage < 0) return;
    if (listingsData && newPage >= listingsData.totalPages) return;
    const nextParams = new URLSearchParams(searchParams);
    if (newPage === 0) {
      nextParams.delete('page');
    } else {
      nextParams.set('page', String(newPage));
    }
    setSearchParams(nextParams, { replace: true });
  };

  // Filter mutation handlers (automatically reset page to 0)
  const handleSelectType = (type: ListingType | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (!type || selectedType === type) {
      nextParams.delete('type');
    } else {
      nextParams.set('type', type);
    }
    nextParams.delete('page');
    setSearchParams(nextParams, { replace: true });
  };

  const handleSelectCategory = (id: string | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (!id || selectedCategoryId === id) {
      nextParams.delete('categoryId');
    } else {
      nextParams.set('categoryId', id);
    }
    nextParams.delete('page');
    setSearchParams(nextParams, { replace: true });
  };

  const handleClearKeyword = () => {
    setKeywordInput('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('keyword');
    nextParams.delete('page');
    setSearchParams(nextParams, { replace: true });
  };

  const handleClearCity = () => {
    setCityInput('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('city');
    nextParams.delete('page');
    setSearchParams(nextParams, { replace: true });
  };

  const handleClearAllFilters = () => {
    setKeywordInput('');
    setCityInput('');
    setSearchParams({}, { replace: true });
  };

  const hasActiveFilters = Boolean(
    urlKeyword.trim() || selectedType || selectedCategoryId || urlCity.trim()
  );

  // Generate pagination page numbers
  const pageNumbers = useMemo(() => {
    if (!listingsData || listingsData.totalPages <= 1) return [];
    const total = listingsData.totalPages;
    const current = currentPage;
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 0; i < total; i++) {
      if (i === 0 || i === total - 1 || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    for (const i of range) {
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  }, [listingsData, currentPage]);

  return (
    <div className="space-y-6">
      {/* Page Heading (Cleaned of internal progress tags) */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Khám phá đồ dùng cộng đồng</h1>
        <p className="text-sm text-slate-500 mt-1">
          Duyệt tìm đồ dùng cho tặng, trao đổi hoặc các món đồ đang cần tìm trong khu dân cư.
        </p>
      </div>

      {/* Search & Filter Controls Card */}
      <section
        aria-label="Bộ lọc tìm kiếm bài đăng"
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
          <Filter className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900">Bộ lọc tìm kiếm</h2>
        </div>

        {/* Text Search Inputs: Keyword & City */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="Tìm kiếm theo tên món đồ, mô tả..."
              aria-label="Tìm kiếm đồ dùng"
              className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/20 focus:outline-none transition-all text-slate-900 placeholder:text-slate-400"
            />
            {keywordInput && (
              <button
                type="button"
                onClick={handleClearKeyword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* City Filter */}
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="Lọc theo thành phố (Hà Nội, TP. HCM...)"
              aria-label="Lọc theo thành phố"
              className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/20 focus:outline-none transition-all text-slate-900 placeholder:text-slate-400"
            />
            {cityInput && (
              <button
                type="button"
                onClick={handleClearCity}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                aria-label="Xóa lọc thành phố"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Listing Type Selectors */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-600">Hình thức bài đăng:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectType(null)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                !selectedType
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
            >
              Tất cả hình thức
            </button>
            <button
              type="button"
              onClick={() => handleSelectType('GIVEAWAY')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                selectedType === 'GIVEAWAY'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
            >
              Cho tặng
            </button>
            <button
              type="button"
              onClick={() => handleSelectType('SALE')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                selectedType === 'SALE'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
            >
              Thanh lý
            </button>
            <button
              type="button"
              onClick={() => handleSelectType('WANTED')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                selectedType === 'WANTED'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
            >
              Cần tìm
            </button>
          </div>
        </div>

        {/* Categories Section */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Danh mục đồ dùng:</span>
            {activeCategories.length > 0 && (
              <span className="text-[11px] text-slate-400">
                {activeCategories.length} danh mục khả dụng
              </span>
            )}
          </div>

          {/* Categories Loading */}
          {isCategoriesLoading && (
            <div className="py-2 flex items-center gap-2">
              <LoadingSpinner size="sm" label="Đang tải danh mục..." />
            </div>
          )}

          {/* Categories Error */}
          {categoriesError && !isCategoriesLoading && (
            <p className="text-xs text-red-600">
              Không thể tải danh mục.{' '}
              <button type="button" onClick={() => refetchCategories()} className="underline font-medium">
                Thử lại
              </button>
            </p>
          )}

          {/* Categories List */}
          {!isCategoriesLoading && !categoriesError && activeCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectCategory(null)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                  !selectedCategoryId
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
              >
                Tất cả danh mục
              </button>

              {activeCategories.map((category) => {
                const isSelected = selectedCategoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleSelectCategory(category.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                      isSelected
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    )}
                    title={category.description || category.name}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
            <span className="font-semibold text-slate-600">Đang lọc theo:</span>

            {urlKeyword.trim() && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span>
                  Từ khóa: <strong>{urlKeyword.trim()}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleClearKeyword}
                  className="hover:text-emerald-950 p-0.5 rounded-xs"
                  aria-label="Xóa bộ lọc từ khóa"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedType && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span>
                  Hình thức:{' '}
                  <strong>
                    {selectedType === 'GIVEAWAY'
                      ? 'Cho tặng'
                      : selectedType === 'SALE'
                      ? 'Thanh lý'
                      : 'Cần tìm'}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectType(null)}
                  className="hover:text-emerald-950 p-0.5 rounded-xs"
                  aria-label="Xóa bộ lọc hình thức"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedCategory && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span>
                  Danh mục: <strong>{selectedCategory.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectCategory(null)}
                  className="hover:text-emerald-950 p-0.5 rounded-xs"
                  aria-label="Xóa bộ lọc danh mục"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {urlCity.trim() && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span>
                  Khu vực: <strong>{urlCity.trim()}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleClearCity}
                  className="hover:text-emerald-950 p-0.5 rounded-xs"
                  aria-label="Xóa bộ lọc khu vực"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-xs text-red-600 hover:text-red-800 font-semibold underline ml-auto cursor-pointer"
            >
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}
      </section>

      {/* Listing Feed Section */}
      <section aria-labelledby="listings-heading" className="space-y-4">
        {/* Feed Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-2 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
              <h2 id="listings-heading" className="text-lg font-semibold text-slate-900">
                Bảng tin đồ dùng cộng đồng
              </h2>
            </div>
            {!isListingsLoading && listingsData && (
              <Badge variant="neutral" className="text-xs self-start sm:self-auto shrink-0">
                {listingsData.totalElements} bài đăng
              </Badge>
            )}
          </div>

          {/* Top Pagination Summary */}
          {!isListingsLoading && listingsData && listingsData.totalElements > 0 && (
            <span className="text-xs sm:text-sm text-slate-500 mt-1 sm:mt-0">
              Hiển thị {currentPage * PAGE_SIZE + 1} -{' '}
              {Math.min((currentPage + 1) * PAGE_SIZE, listingsData.totalElements)} trên{' '}
              {listingsData.totalElements} bài đăng
            </span>
          )}
        </div>

        {/* Listings Loading State */}
        {isListingsLoading && (
          <div className="space-y-4">
            <div className="py-6 flex justify-center">
              <LoadingSpinner size="md" label="Đang tải danh sách bài đăng..." />
            </div>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
              aria-hidden="true"
            >
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs animate-pulse flex flex-col"
                >
                  <div className="aspect-4/3 bg-slate-200 w-full" />
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-4/5" />
                      <div className="h-4 bg-slate-200 rounded w-2/5" />
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="h-3 bg-slate-200 rounded w-1/3" />
                      <div className="h-3 bg-slate-200 rounded w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Listings Error State */}
        {listingsError && !isListingsLoading && (
          <ErrorAlert
            title="Không thể tải danh sách bài đăng"
            message={
              listingsError instanceof Error
                ? listingsError.message
                : 'Đã có lỗi xảy ra khi kết nối máy chủ để lấy bài đăng. Vui lòng thử lại.'
            }
            onRetry={() => refetchListings()}
            retryLabel="Thử lại"
            isRetrying={isListingsFetching}
          />
        )}

        {/* Listings Empty State */}
        {!isListingsLoading && !listingsError && listings.length === 0 && (
          <EmptyState
            icon={Search}
            title={
              currentPage > 0
                ? 'Trang này không có bài đăng nào'
                : hasActiveFilters
                ? 'Không tìm thấy bài đăng phù hợp'
                : 'Chưa có bài đăng nào trên cộng đồng'
            }
            description={
              currentPage > 0
                ? `Không có bài đăng ở trang ${currentPage + 1}. Bạn có thể quay về trang đầu tiên.`
                : hasActiveFilters
                ? 'Không có kết quả nào khớp với các tiêu chí tìm kiếm và bộ lọc đã chọn. Hãy thử thay đổi từ khóa hoặc xóa bớt bộ lọc.'
                : 'Hiện tại chưa có bài đăng nào được chia sẻ trong khu vực lân cận. Vui lòng quay lại sau.'
            }
            actionLabel={currentPage > 0 ? 'Quay về trang đầu' : hasActiveFilters ? 'Xóa tất cả bộ lọc' : undefined}
            onAction={currentPage > 0 ? () => handlePageChange(0) : hasActiveFilters ? handleClearAllFilters : undefined}
          />
        )}

        {/* Listings Grid (Real Data) */}
        {!isListingsLoading && !listingsError && listings.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {/* Backend-Driven Pagination Controls */}
        {!isListingsLoading && !listingsError && listingsData && listingsData.totalPages > 1 && (
          <nav
            aria-label="Phân trang bài đăng"
            className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100"
          >
            <span className="text-xs text-slate-500 font-medium">
              Trang {currentPage + 1} trên tổng số {listingsData.totalPages} trang
            </span>

            <div className="flex items-center gap-1.5">
              {/* Previous Page Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0 || listingsData.first}
                aria-label="Trang trước"
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                Trước
              </Button>

              {/* Numbered Page Buttons */}
              <div className="flex items-center gap-1">
                {pageNumbers.map((p, idx) => {
                  if (typeof p === 'string') {
                    return (
                      <span key={`dots-${idx}`} className="px-2 text-xs text-slate-400 select-none">
                        ...
                      </span>
                    );
                  }

                  const isCurrent = p === currentPage;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePageChange(p)}
                      aria-current={isCurrent ? 'page' : undefined}
                      aria-label={`Đến trang ${p + 1}`}
                      className={cn(
                        'w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {p + 1}
                    </button>
                  );
                })}
              </div>

              {/* Next Page Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= listingsData.totalPages - 1 || listingsData.last}
                aria-label="Trang sau"
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Sau
              </Button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}

export default ExplorePlaceholderPage;
