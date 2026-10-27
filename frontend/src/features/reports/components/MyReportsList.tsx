import { useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorAlert, LoadingSpinner } from '@/components/ui/Feedback';
import { useMyReports } from '../hooks/use-reports';
import { ReportCard } from './ReportCard';
import { ReportDetailModal } from './ReportDetailModal';
import type { ReportResponse, ReportStatus } from '@/types/report';

const STATUS_FILTERS: { value?: ReportStatus; label: string }[] = [
  { value: undefined, label: 'Tất cả' },
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'INVESTIGATING', label: 'Đang điều tra' },
  { value: 'RESOLVED', label: 'Đã xử lý' },
  { value: 'DISMISSED', label: 'Đã bác bỏ' },
];

export function MyReportsList() {
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [selectedReport, setSelectedReport] = useState<ReportResponse | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useMyReports({
    status: selectedStatus,
    page,
    size: 10,
  });

  const handleStatusChange = (status?: ReportStatus) => {
    setSelectedStatus(status);
    setPage(0);
  };

  const reports = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  return (
    <div className="space-y-6">
      {/* Filter Badges */}
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
                    ? 'bg-red-600 text-white font-semibold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <LoadingSpinner size="md" label="Đang tải danh sách báo cáo vi phạm..." />
        </div>
      ) : isError ? (
        <ErrorAlert
          title="Không thể tải danh sách báo cáo"
          message={error?.message || 'Đã xảy ra lỗi khi kết nối với máy chủ.'}
          onRetry={refetch}
          retryLabel="Thử lại"
        />
      ) : reports.length === 0 ? (
        <EmptyState
          title={
            selectedStatus
              ? 'Không có báo cáo nào trong trạng thái này'
              : 'Bạn chưa gửi báo cáo vi phạm nào'
          }
          description="Khi phát hiện dấu hiệu lừa đảo, quấy rối hoặc đồ dùng vi phạm quy chuẩn, bạn có thể gửi báo cáo từ trang tin đăng, hồ sơ hoặc giao dịch tương ứng."
          icon={ShieldAlert}
          className="bg-white"
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports.map((rep) => (
              <ReportCard
                key={rep.id}
                report={rep}
                onSelect={(r) => setSelectedReport(r)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-600">
              <span>
                Hiển thị {reports.length} trên tổng số {totalElements} báo cáo
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
      <ReportDetailModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </div>
  );
}

export default MyReportsList;
