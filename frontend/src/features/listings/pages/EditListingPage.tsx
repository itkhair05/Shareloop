import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Edit3, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorAlert, LoadingSpinner, StatusBanner } from '@/components/ui/Feedback';
import { ListingForm } from '../components/ListingForm';
import { useListing, useUpdateListing } from '../hooks/use-listings';
import { useAuth } from '@/features/auth';
import { isValidUuid } from '@/lib/utils';
import type { CreateListingRequest, UpdateListingRequest } from '@/types/listing';

export function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isIdValid = Boolean(id && isValidUuid(id));
  const { data: listing, isLoading, isError, error, refetch } = useListing(id);
  const updateListingMutation = useUpdateListing();
  const [serverError, setServerError] = useState<string | null>(null);

  // Validate UUID
  if (!isIdValid) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <EmptyState
          title="Mã bài đăng không hợp lệ"
          description="Đường dẫn chỉnh sửa không đúng định dạng. Vui lòng kiểm tra lại liên kết."
          actionLabel="Quay lại danh sách bài đăng"
          onAction={() => navigate('/my-listings')}
        />
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <LoadingSpinner size="lg" label="Đang tải thông tin bài đăng để chỉnh sửa..." />
      </div>
    );
  }

  // Error or Not Found
  if (isError || !listing) {
    const isNotFound = error?.status === 404;
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isNotFound ? (
          <EmptyState
            title="Không tìm thấy bài đăng"
            description="Bài đăng này không tồn tại hoặc đã được gỡ bỏ khỏi hệ thống."
            actionLabel="Quay lại danh sách bài đăng"
            onAction={() => navigate('/my-listings')}
          />
        ) : (
          <div className="space-y-4">
            <ErrorAlert
              title="Không thể tải bài đăng"
              message="Đã xảy ra lỗi khi tải dữ liệu bài đăng. Vui lòng thử lại."
              onRetry={() => refetch()}
            />
            <Button variant="outline" onClick={() => navigate('/my-listings')}>
              Quay lại danh sách bài đăng
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Ownership verification
  const isOwner = user?.id === listing.owner.id;
  const isAdmin = user?.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-7 h-7" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Không có quyền chỉnh sửa</h2>
        <p className="text-sm text-slate-600">
          Bạn chỉ có thể chỉnh sửa các bài đăng do chính mình tạo ra.
        </p>
        <div className="pt-2">
          <Button variant="outline" onClick={() => navigate('/my-listings')}>
            Quay lại danh sách bài đăng của tôi
          </Button>
        </div>
      </div>
    );
  }

  // Lifecycle check: COMPLETED or REMOVED listings cannot be edited
  if (listing.status === 'COMPLETED' || listing.status === 'REMOVED') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <StatusBanner
          type="warning"
          message={`Bài đăng này hiện ở trạng thái "${
            listing.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Đã gỡ'
          }" và không thể tiếp tục chỉnh sửa.`}
        />
        <div className="pt-4 flex justify-center gap-3">
          <Button variant="outline" onClick={() => navigate('/my-listings')}>
            Quay lại danh sách bài đăng
          </Button>
          <Button variant="primary" onClick={() => navigate(`/listings/${listing.id}`)}>
            Xem chi tiết bài đăng
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (payload: CreateListingRequest) => {
    setServerError(null);
    try {
      const updatePayload: UpdateListingRequest = {
        listingType: payload.listingType,
        title: payload.title,
        description: payload.description,
        categoryId: payload.categoryId,
        price: payload.price,
        currency: payload.currency,
        size: payload.size,
        condition: payload.condition,
        quantity: payload.quantity,
        city: payload.city,
        neighborhood: payload.neighborhood,
        stateProvince: payload.stateProvince,
        postalCode: payload.postalCode,
        country: payload.country,
        images: payload.images,
      };

      await updateListingMutation.mutateAsync({ id: listing.id, payload: updatePayload });
      navigate(`/listings/${listing.id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Đã xảy ra lỗi khi cập nhật bài đăng. Vui lòng kiểm tra lại thông tin và thử lại.';
      setServerError(message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      {/* Navigation & Breadcrumbs */}
      <nav aria-label="Điều hướng" className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/my-listings" className="hover:text-emerald-700 transition-colors">
          Bài đăng của tôi
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
        <Link to={`/listings/${listing.id}`} className="hover:text-emerald-700 transition-colors truncate max-w-[200px]">
          {listing.title}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
        <span className="text-slate-900 font-semibold" aria-current="page">
          Chỉnh sửa bài đăng
        </span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Edit3 className="w-7 h-7 text-emerald-600" aria-hidden="true" />
            <span>Chỉnh sửa bài đăng</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cập nhật thông tin mô tả, giá hoặc hình ảnh cho bài đăng của bạn
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/my-listings')}
          className="flex flex-row items-center justify-center gap-2 [&>span]:flex [&>span]:flex-row [&>span]:items-center [&>span]:gap-1.5 self-start sm:self-auto"
          aria-label="Quay lại"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Quay lại</span>
        </Button>
      </div>

      {/* Main Form */}
      <ListingForm
        mode="edit"
        initialData={listing}
        onSubmit={handleSubmit}
        isSubmitting={updateListingMutation.isPending}
        serverError={serverError}
        onCancel={() => navigate('/my-listings')}
      />
    </div>
  );
}

export default EditListingPage;
