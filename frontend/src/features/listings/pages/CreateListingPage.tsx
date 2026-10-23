import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ListingForm } from '../components/ListingForm';
import { useCreateListing } from '../hooks/use-listings';
import type { CreateListingRequest } from '@/types/listing';

export function CreateListingPage() {
  const navigate = useNavigate();
  const createListingMutation = useCreateListing();
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (payload: CreateListingRequest) => {
    setServerError(null);
    try {
      const created = await createListingMutation.mutateAsync(payload);
      navigate(`/listings/${created.id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Đã xảy ra lỗi khi tạo bài đăng. Vui lòng kiểm tra lại thông tin và thử lại.';
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
        <span className="text-slate-900 font-semibold" aria-current="page">
          Đăng bài mới
        </span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <PlusCircle className="w-7 h-7 text-emerald-600" aria-hidden="true" />
            <span>Đăng bài mới</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Chia sẻ, thanh lý hoặc đăng tin cần tìm món đồ hữu ích đến cộng đồng ShareLoop
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
        mode="create"
        onSubmit={handleSubmit}
        isSubmitting={createListingMutation.isPending}
        serverError={serverError}
        onCancel={() => navigate('/my-listings')}
      />
    </div>
  );
}

export default CreateListingPage;
