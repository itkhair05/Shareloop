import { useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, LifeBuoy, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorAlert, LoadingSpinner } from '@/components/ui/Feedback';
import { useMySupportRequests } from '../hooks/use-support';
import { SupportRequestCard } from './SupportRequestCard';
import { SupportRequestDetailModal } from './SupportRequestDetailModal';
import { CreateSupportRequestModal } from './CreateSupportRequestModal';
import type { SupportRequestResponse, SupportRequestStatus } from '@/types/support';

const STATUS_FILTERS: { value?: SupportRequestStatus; label: string }[] = [
  { value: undefined, label: 'Tất cả' },
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'RESOLVED', label: 'Đã giải quyết' },
  { value: 'CLOSED', label: 'Đã đóng' },
];

export function MySupportRequestsList() {
  const [selectedStatus, setSelectedStatus] = useState<SupportRequestStatus | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<SupportRequestResponse | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useMySupportRequests({
    status: selectedStatus,
    page,
    size: 10,
  });

  const handleStatusChange = (status?: SupportRequestStatus) => {
    setSelectedStatus(status);
    setPage(0);
  };

  const requests = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  return (
    <div className="space-y-6">
      {/* Action Header & Filter Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const isSelected = selectedStatus === f.value;
              return (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => handleStatusChange(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
          className="self-start sm:self-auto shadow-2xs"
        >
          Gửi yêu cầu mới
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <LoadingSpinner size="md" label="Đang tải danh sách yêu cầu hỗ trợ..." />
        </div>
      ) : isError ? (
        <ErrorAlert
          title="Không thể tải danh sách yêu cầu"
          message={error?.message || 'Đã xảy ra lỗi khi kết nối với máy chủ.'}
          onRetry={refetch}
          retryLabel="Thử lại"
        />
      ) : requests.length === 0 ? (
        <EmptyState
          title={
            selectedStatus
              ? 'Không có yêu cầu nào trong trạng thái này'
              : 'Bạn chưa gửi yêu cầu hỗ trợ nào'
          }
          description="Nếu gặp bất kỳ khó khăn nào trong quá trình trao đổi hoặc sử dụng tài khoản, hãy gửi yêu cầu để Ban quản trị hỗ trợ bạn."
          icon={LifeBuoy}
          actionLabel="Gửi yêu cầu hỗ trợ ngay"
          onAction={() => setIsCreateOpen(true)}
          className="bg-white"
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map((req) => (
              <SupportRequestCard
                key={req.id}
                request={req}
                onSelect={(r) => setSelectedRequest(r)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-600">
              <span>
                Hiển thị {requests.length} trên tổng số {totalElements} yêu cầu
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || isFetching}
                  leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Trước
                </Button>
                <span className="font-semibold px-2">
                  Trang {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1 || isFetching}
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <SupportRequestDetailModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />

      {/* Create Modal */}
      <CreateSupportRequestModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

export default MySupportRequestsList;
