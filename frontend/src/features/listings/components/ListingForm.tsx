import React, { useState, useRef } from 'react';
import {
  AlertCircle,
  DollarSign,
  Gift,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Search,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ErrorAlert } from '@/components/ui/Feedback';
import { useCategories } from '@/features/categories';
import { useUploadImage } from '../hooks/use-listings';
import { resolveImageUrl } from '@/lib/utils';
import type {
  CreateListingRequest,
  ListingCondition,
  ListingImageDto,
  ListingResponse,
  ListingType,
} from '@/types/listing';

interface ListingFormProps {
  mode: 'create' | 'edit';
  initialData?: ListingResponse;
  onSubmit: (data: CreateListingRequest) => Promise<void>;
  isSubmitting: boolean;
  serverError?: string | null;
  onCancel?: () => void;
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const MAX_IMAGES_COUNT = 10;

export function ListingForm({
  mode,
  initialData,
  onSubmit,
  isSubmitting,
  serverError,
  onCancel,
}: ListingFormProps) {
  const { data: categories = [], isLoading: isCategoriesLoading } = useCategories();
  const uploadImageMutation = useUploadImage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [listingType, setListingType] = useState<ListingType>(
    initialData?.listingType || 'GIVEAWAY'
  );
  const [title, setTitle] = useState(initialData?.title || '');
  const [categoryId, setCategoryId] = useState(initialData?.category?.id || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [price, setPrice] = useState<string>(
    initialData?.price != null ? String(initialData.price) : ''
  );
  const currency = initialData?.currency || 'VND';
  const [size, setSize] = useState(initialData?.size || '');
  const [condition, setCondition] = useState<ListingCondition | ''>(
    initialData?.condition || ''
  );
  const [quantity, setQuantity] = useState<string>(
    initialData?.quantity != null ? String(initialData.quantity) : ''
  );
  const [city, setCity] = useState(initialData?.city || '');
  const [neighborhood, setNeighborhood] = useState(initialData?.neighborhood || '');
  const stateProvince = initialData?.stateProvince || '';
  const postalCode = initialData?.postalCode || '';
  const [images, setImages] = useState<ListingImageDto[]>(
    initialData?.images?.map((img, idx) => ({
      imageUrl: img.imageUrl,
      sortOrder: img.sortOrder ?? idx,
    })) || []
  );

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Field validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Vui lòng nhập tiêu đề bài đăng';
    } else if (title.trim().length < 2 || title.trim().length > 200) {
      newErrors.title = 'Tiêu đề bài đăng phải từ 2 đến 200 ký tự';
    }

    if (!categoryId) {
      newErrors.categoryId = 'Vui lòng chọn danh mục cho món đồ';
    }

    if (!description.trim()) {
      newErrors.description = 'Vui lòng nhập mô tả chi tiết';
    } else if (description.trim().length > 5000) {
      newErrors.description = 'Mô tả không được vượt quá 5000 ký tự';
    }

    if (!city.trim()) {
      newErrors.city = 'Vui lòng nhập thành phố / tỉnh';
    } else if (city.trim().length > 100) {
      newErrors.city = 'Tên thành phố không được vượt quá 100 ký tự';
    }

    if (neighborhood.trim().length > 100) {
      newErrors.neighborhood = 'Tên khu vực không được vượt quá 100 ký tự';
    }

    if (size.trim().length > 30) {
      newErrors.size = 'Kích thước không được vượt quá 30 ký tự';
    }

    if (quantity.trim()) {
      const parsedQuantity = Number(quantity);
      if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
        newErrors.quantity = 'Số lượng phải là số nguyên lớn hơn 0';
      }
    }

    // Price rules based on ListingType
    if (listingType === 'SALE') {
      const parsedPrice = parseFloat(price);
      if (!price.trim() || isNaN(parsedPrice) || parsedPrice <= 0) {
        newErrors.price = 'Bài đăng thanh lý yêu cầu giá bán lớn hơn 0';
      }
    } else if (listingType === 'WANTED') {
      if (price.trim()) {
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
          newErrors.price = 'Ngân sách mong muốn phải là số lớn hơn 0';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageUploadError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > MAX_IMAGES_COUNT) {
      setImageUploadError(`Bài đăng chỉ được chứa tối đa ${MAX_IMAGES_COUNT} hình ảnh.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate MIME type
      if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
        setImageUploadError('Định dạng hình ảnh không hợp lệ. Chỉ chấp nhận tệp JPEG hoặc PNG.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Validate size (5 MiB)
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setImageUploadError(`Dung lượng tệp "${file.name}" vượt quá 5 MB.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setIsUploadingImage(true);
    try {
      const uploadedImages: ListingImageDto[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await uploadImageMutation.mutateAsync(file);
        uploadedImages.push({
          imageUrl: res.url,
          sortOrder: images.length + uploadedImages.length,
        });
      }
      setImages((prev) => [...prev, ...uploadedImages]);
    } catch {
      setImageUploadError('Không thể tải lên hình ảnh. Vui lòng thử lại.');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) =>
      prev
        .filter((_, idx) => idx !== indexToRemove)
        .map((img, idx) => ({ ...img, sortOrder: idx }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || isSubmitting) return;

    let finalPrice: number | null = null;
    let finalCurrency: string | null = null;

    if (listingType === 'SALE') {
      finalPrice = parseFloat(price);
      finalCurrency = currency || 'VND';
    } else if (listingType === 'WANTED') {
      finalPrice = price.trim() ? parseFloat(price) : null;
      finalCurrency = finalPrice != null ? (currency || 'VND') : null;
    }

    const payload: CreateListingRequest = {
      listingType,
      title: title.trim(),
      description: description.trim(),
      categoryId,
      price: finalPrice,
      currency: finalCurrency,
      size: size.trim() || null,
      condition: condition || null,
      quantity: quantity.trim() ? parseInt(quantity, 10) : null,
      city: city.trim(),
      neighborhood: neighborhood.trim() || null,
      stateProvince: stateProvince.trim() || null,
      postalCode: postalCode.trim() || null,
      country: 'VN',
      images: images.map((img, idx) => ({
        imageUrl: img.imageUrl,
        sortOrder: idx,
      })),
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Global Server Error Banner */}
      {serverError && (
        <ErrorAlert
          title="Không thể lưu bài đăng"
          message={serverError}
        />
      )}

      {/* Section 1: Listing Type */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-600" aria-hidden="true" />
            <span>Hình thức bài đăng</span>
            <span className="text-red-500">*</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Chọn hình thức bạn muốn thực hiện cho món đồ này
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => {
              setListingType('GIVEAWAY');
              setPrice('');
            }}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
              listingType === 'GIVEAWAY'
                ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                Cho tặng
              </span>
              <Badge variant="success" className="text-[10px]">Miễn phí</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-snug">
              Tặng miễn phí món đồ bạn không còn sử dụng cho thành viên khác
            </p>
          </button>

          <button
            type="button"
            onClick={() => setListingType('SALE')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
              listingType === 'SALE'
                ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-amber-600" aria-hidden="true" />
                Thanh lý
              </span>
              <Badge variant="warning" className="text-[10px]">Có phí</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-snug">
              Bán lại món đồ còn tốt với mức giá hữu nghị cho cộng đồng
            </p>
          </button>

          <button
            type="button"
            onClick={() => setListingType('WANTED')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
              listingType === 'WANTED'
                ? 'border-slate-700 bg-slate-50 ring-2 ring-slate-400/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Search className="w-4 h-4 text-slate-600" aria-hidden="true" />
                Cần tìm
              </span>
              <Badge variant="neutral" className="text-[10px]">Tìm kiếm</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-snug">
              Tìm kiếm món đồ bạn đang cần từ các thành viên khác
            </p>
          </button>
        </div>
      </div>

      {/* Section 2: General Information */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-5">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <span>Thông tin chi tiết</span>
        </h2>

        {/* Title */}
        <Input
          label="Tiêu đề bài đăng *"
          placeholder="Ví dụ: Bộ tuốc nơ vít đa năng 24 món còn mới 95%"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          maxLength={200}
        />

        {/* Category */}
        <div className="w-full space-y-1.5">
          <label htmlFor="category-select" className="block text-sm font-medium text-slate-700">
            Danh mục *
          </label>
          <select
            id="category-select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={isCategoriesLoading}
            className={`w-full px-3.5 py-2 text-sm bg-white border rounded-lg transition-colors focus:outline-none focus:ring-2 ${
              errors.categoryId
                ? 'border-red-500 focus:ring-red-400 text-red-900'
                : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-400 text-slate-900'
            }`}
          >
            <option value="">-- Chọn danh mục phù hợp --</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <p className="text-xs text-red-600 font-medium">{errors.categoryId}</p>
          )}
        </div>

        {/* Pricing Row (conditional on type) */}
        {listingType === 'GIVEAWAY' ? (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-900 text-sm flex items-center gap-2">
            <Gift className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>Món đồ này sẽ được đăng <strong>miễn phí</strong> (không yêu cầu giá tiền).</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={listingType === 'SALE' ? 'Giá bán (VND) *' : 'Ngân sách mong muốn (VND)'}
              type="number"
              placeholder={listingType === 'SALE' ? 'Ví dụ: 150000' : 'Để trống nếu thương lượng'}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              error={errors.price}
              min="0"
              step="1000"
            />
            <div className="space-y-1.5">
              <label htmlFor="currency-select" className="block text-sm font-medium text-slate-700">
                Đơn vị tiền tệ
              </label>
              <input
                id="currency-select"
                type="text"
                disabled
                value="VND (₫)"
                className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-600 cursor-not-allowed"
              />
            </div>
          </div>
        )}

        {/* Description */}
        <div className="w-full space-y-1.5">
          <label htmlFor="description-input" className="block text-sm font-medium text-slate-700">
            Mô tả chi tiết *
          </label>
          <textarea
            id="description-input"
            rows={5}
            placeholder="Mô tả kỹ tình trạng món đồ, nguồn gốc, kích thước, lý do cho tặng/bán hoặc cần tìm..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`w-full px-3.5 py-2 text-sm bg-white border rounded-lg transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
              errors.description
                ? 'border-red-500 focus:ring-red-400 text-red-900'
                : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-400 text-slate-900'
            }`}
            maxLength={5000}
          />
          <div className="flex items-center justify-between text-xs text-slate-400">
            {errors.description ? (
              <p className="text-red-600 font-medium">{errors.description}</p>
            ) : (
              <span>Giới hạn 5000 ký tự</span>
            )}
            <span>{description.length}/5000</span>
          </div>
        </div>

        {/* Optional item specifications */}
        <div className="pt-2 border-t border-slate-100 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Thông số món đồ (không bắt buộc)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Bỏ trống nếu thông số không phù hợp với loại món đồ này.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Kích thước / Size"
              placeholder="Ví dụ: 30 x 20 x 10 cm hoặc size M"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              error={errors.size}
              maxLength={30}
            />

            <div className="space-y-1.5">
              <label htmlFor="condition-select" className="block text-sm font-medium text-slate-700">
                Tình trạng
              </label>
              <select
                id="condition-select"
                value={condition}
                onChange={(e) => setCondition(e.target.value as ListingCondition | '')}
                className={`w-full px-3.5 py-2 text-sm bg-white border rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                  errors.condition
                    ? 'border-red-500 focus:ring-red-400 text-red-900'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-400 text-slate-900'
                }`}
              >
                <option value="">-- Không xác định --</option>
                <option value="NEW">Mới</option>
                <option value="USED">Đã qua sử dụng</option>
              </select>
              {errors.condition && (
                <p className="text-xs text-red-600 font-medium">{errors.condition}</p>
              )}
            </div>

            <Input
              label="Số lượng"
              type="number"
              placeholder="Ví dụ: 2"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              error={errors.quantity}
              min="1"
              step="1"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Location */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" aria-hidden="true" />
            <span>Địa điểm giao dịch</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Giúp thành viên gần bạn dễ dàng tìm thấy và thuận tiện trao đổi
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Thành phố / Tỉnh *"
            placeholder="Ví dụ: TP. Hồ Chí Minh"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            error={errors.city}
            maxLength={100}
          />
          <Input
            label="Khu vực / Quận huyện"
            placeholder="Ví dụ: Phường Thảo Điền, Quận 2"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            error={errors.neighborhood}
            maxLength={100}
          />
        </div>
      </div>

      {/* Section 4: Images */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              <span>Hình ảnh món đồ</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Đăng tối đa {MAX_IMAGES_COUNT} hình ảnh (JPEG, PNG, tối đa 5 MB/ảnh)
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {images.length}/{MAX_IMAGES_COUNT} ảnh
          </span>
        </div>

        {imageUploadError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
            <span>{imageUploadError}</span>
          </div>
        )}

        {/* Thumbnail Preview Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {images.map((img, index) => {
            const resolved = resolveImageUrl(img.imageUrl);
            return (
              <div
                key={index}
                className="relative aspect-square rounded-xl bg-slate-100 border border-slate-200 overflow-hidden group"
              >
                {resolved ? (
                  <img
                    src={resolved}
                    alt={`Ảnh tải lên ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}

                {/* Primary badge for first image */}
                {index === 0 && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                    Ảnh đại diện
                  </span>
                )}

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer focus:outline-none"
                  aria-label={`Xóa ảnh ${index + 1}`}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}

          {/* Upload Button */}
          {images.length < MAX_IMAGES_COUNT && (
            <label
              className={`aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 flex flex-col items-center justify-center gap-2 p-3 text-center transition-colors cursor-pointer ${
                isUploadingImage ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                multiple
                onChange={handleImageUpload}
                disabled={isUploadingImage}
                className="sr-only"
              />
              {isUploadingImage ? (
                <>
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" aria-hidden="true" />
                  <span className="text-[11px] font-medium text-slate-500">Đang tải lên...</span>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-slate-400" aria-hidden="true" />
                  <span className="text-xs font-semibold text-slate-700">Tải ảnh lên</span>
                  <span className="text-[10px] text-slate-400">Tối đa 5 MB</span>
                </>
              )}
            </label>
          )}
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isSubmitting}
          className="min-w-[140px]"
        >
          {mode === 'create' ? 'Đăng bài ngay' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  );
}

export default ListingForm;
