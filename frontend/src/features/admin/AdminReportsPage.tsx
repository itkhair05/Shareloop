import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/utils';
import {
  useAdminReports,
  useUpdateReportAdmin,
} from './hooks/use-admin-reports';
import { ReportDetailModal } from './components/ReportDetailModal';
import {
  formatReportCategory,
  formatReportStatus,
  formatTargetType,
} from './utils/report-formatters';
import { UpdateReportStatusDialog } from './components/UpdateReportStatusDialog';
import { ReviewDetailModal } from './components/ReviewDetailModal';
import type { AdminReportResponse } from '@/types/admin-report';
import type { ReportCategory, ReportStatus, ReportTargetType } from '@/types/report';

export function AdminReportsPage() {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReportStatus>('ALL');
  const [targetTypeFilter, setTargetTypeFilter] = useState<'ALL' | ReportTargetType>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ReportCategory>('ALL');
  const [page, setPage] = useState(0);
  const size = 20;

  const queryParams = useMemo(() => {
    return {
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      targetType: targetTypeFilter === 'ALL' ? undefined : targetTypeFilter,
      category: categoryFilter === 'ALL' ? undefined : categoryFilter,
      page,
      size,
    };
  }, [statusFilter, targetTypeFilter, categoryFilter, page, size]);

  const {
    data: pageData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useAdminReports(queryParams);

  const updateReportStatusMutation = useUpdateReportAdmin();

  // Modal states
  const [detailReportId, setDetailReportId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [reportToUpdateStatus, setReportToUpdateStatus] = useState<AdminReportResponse | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

  // Review Inspection Modal (when report targets a review)
  const [inspectReviewId, setInspectReviewId] = useState<string | null>(null);

  // Feedback Notification Banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setTargetTypeFilter('ALL');
    setCategoryFilter('ALL');
    setPage(0);
  };

  const handleOpenDetail = (id: string) => {
    setDetailReportId(id);
    setIsDetailModalOpen(true);
  };

  const handleOpenStatusDialog = (report: AdminReportResponse) => {
    setReportToUpdateStatus(report);
    setIsStatusDialogOpen(true);
  };

  const handleConfirmStatusUpdate = async (newStatus: ReportStatus, resolutionNotes: string) => {
    if (!reportToUpdateStatus) return;
    try {
      await updateReportStatusMutation.mutateAsync({
        id: reportToUpdateStatus.id,
        payload: {
          status: newStatus,
          resolutionNotes: resolutionNotes || undefined,
        },
      });
      setIsStatusDialogOpen(false);
      setReportToUpdateStatus(null);
      setFeedback({
        type: 'success',
        text: `Đã cập nhật trạng thái báo cáo sang "${formatReportStatus(newStatus).label}" thành công.`,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi khi cập nhật trạng thái báo cáo';
      setFeedback({
        type: 'error',
        text: errMsg,
      });
    }
  };

  const reports = pageData?.content || [];
  const totalElements = pageData?.totalElements || 0;
  const totalPages = pageData?.totalPages || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Quản lý báo cáo vi phạm
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Xác minh nội dung bị khiếu nại, thụ lý điều tra và ghi nhận quyết định xử lý của ban quản trị
          </p>
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
          <div className="flex items-center gap-2.5 text-sm font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-md hover:bg-black/5 text-slate-500 hover:text-slate-800 cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters Card */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Status Filter */}
            <div>
              <label htmlFor="filter-status-select" className="text-xs font-semibold text-slate-600 block mb-1">
                Trạng thái hồ sơ
              </label>
              <select
                id="filter-status-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'ALL' | ReportStatus);
                  setPage(0);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="PENDING">Chờ xử lý (PENDING)</option>
                <option value="INVESTIGATING">Đang điều tra (INVESTIGATING)</option>
                <option value="RESOLVED">Đã giải quyết (RESOLVED)</option>
                <option value="DISMISSED">Đã bác bỏ (DISMISSED)</option>
              </select>
            </div>

            {/* Target Type Filter */}
            <div>
              <label htmlFor="filter-target-select" className="text-xs font-semibold text-slate-600 block mb-1">
                Loại đối tượng bị báo cáo
              </label>
              <select
                id="filter-target-select"
                value={targetTypeFilter}
                onChange={(e) => {
                  setTargetTypeFilter(e.target.value as 'ALL' | ReportTargetType);
                  setPage(0);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="ALL">Tất cả đối tượng</option>
                <option value="USER">Người dùng (USER)</option>
                <option value="LISTING">Tin đăng (LISTING)</option>
                <option value="TRANSACTION">Giao dịch (TRANSACTION)</option>
                <option value="REVIEW">Đánh giá (REVIEW)</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label htmlFor="filter-category-select" className="text-xs font-semibold text-slate-600 block mb-1">
                Lý do vi phạm
              </label>
              <select
                id="filter-category-select"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value as 'ALL' | ReportCategory);
                  setPage(0);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="ALL">Tất cả lý do vi phạm</option>
                <option value="FRAUD_OR_SCAM">Lừa đảo / Gian lận</option>
                <option value="HARASSMENT">Quấy rối / Công kích</option>
                <option value="ITEM_MISREPRESENTED">Hàng sai lệch mô tả</option>
                <option value="NO_SHOW_OR_UNRESPONSIVE">Không đến / Không phản hồi</option>
                <option value="PROHIBITED_ITEM">Hàng cấm / Vi phạm quy định</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>
          </div>

          {(statusFilter !== 'ALL' || targetTypeFilter !== 'ALL' || categoryFilter !== 'ALL') && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Đang áp dụng bộ lọc tùy chỉnh. Tìm thấy{' '}
                <strong className="text-slate-900">{totalElements}</strong> kết quả.
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                Đặt lại bộ lọc
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reports Data Table */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th scope="col" className="px-4 py-3 whitespace-nowrap">Đối tượng & Danh mục</th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">Người gửi báo cáo</th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">Trạng thái</th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">Thời gian</th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">Người xử lý</th>
                <th scope="col" className="px-4 py-3 text-right whitespace-nowrap w-[200px] min-w-[200px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-32 bg-slate-200 rounded mb-1.5" />
                      <div className="h-3 w-24 bg-slate-100 rounded" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-28 bg-slate-200 rounded mb-1" />
                      <div className="h-3 w-36 bg-slate-100 rounded" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-5 w-24 bg-slate-200 rounded-full" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-3.5 w-24 bg-slate-200 rounded" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-3.5 w-24 bg-slate-200 rounded" />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="h-8 w-24 bg-slate-200 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-red-600">
                      <AlertCircle className="w-8 h-8" />
                      <p className="font-semibold text-sm">Không thể tải danh sách báo cáo vi phạm</p>
                      <p className="text-xs text-slate-500">{error?.message || 'Lỗi kết nối máy chủ'}</p>
                      <button
                        type="button"
                        onClick={() => refetch()}
                        className="mt-2 inline-flex flex-row items-center justify-center gap-2 h-9 px-4 text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        <span className="whitespace-nowrap">Thử lại</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldAlert className="w-8 h-8 text-slate-400" />
                      <p className="font-semibold text-sm text-slate-700">Không có báo cáo vi phạm nào</p>
                      <p className="text-xs text-slate-400">
                        Hệ thống hiện không có báo cáo nào khớp với bộ lọc đang chọn.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Target & Category */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge variant={formatTargetType(rep.targetType).variant} className="text-[10px] px-1.5 py-0.5 whitespace-nowrap shrink-0">
                          {formatTargetType(rep.targetType).label}
                        </Badge>
                        <span className="text-xs font-semibold text-slate-900">
                          {formatReportCategory(rep.category)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 max-w-xs" title={rep.description}>
                        {rep.description || '(Không có mô tả chi tiết)'}
                      </p>
                    </td>

                    {/* Reporter */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800 text-xs truncate max-w-[150px]">
                        {rep.reporterDisplayName || 'Người dùng ẩn danh'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-[150px]">
                        {rep.reporterEmail || '—'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Badge variant={formatReportStatus(rep.status).variant} className="text-[11px] whitespace-nowrap shrink-0">
                        {formatReportStatus(rep.status).label}
                      </Badge>
                    </td>

                    {/* Created Date */}
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(rep.createdAt)}
                    </td>

                    {/* Resolver */}
                    <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {rep.resolvedByDisplayName ? (
                        <div>
                          <span className="font-medium">{rep.resolvedByDisplayName}</span>
                          <span className="block text-[10px] text-slate-400">
                            {formatDateTime(rep.resolvedAt)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Chưa giải quyết</span>
                      )}
                    </td>

                    {/* Actions - Dùng thẻ button thuần */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap w-[200px] min-w-[200px]">
                      <div className="flex flex-row flex-nowrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(rep.id)}
                          className="inline-flex flex-row items-center justify-center gap-1 h-8 px-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span className="whitespace-nowrap">Xem hồ sơ</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenStatusDialog(rep)}
                          className="inline-flex flex-row items-center justify-center h-8 px-2.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                        >
                          <span className="whitespace-nowrap">Xử lý</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar - Dùng thẻ button thuần */}
        {!isLoading && totalElements > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="whitespace-nowrap">
              Hiển thị trang <strong className="text-slate-900">{page + 1}</strong> /{' '}
              <strong className="text-slate-900">{Math.max(1, totalPages)}</strong> (Tổng cộng{' '}
              <strong className="text-slate-900">{totalElements}</strong> báo cáo)
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
                className="inline-flex flex-row items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Trước</span>
              </button>

              <span className="px-2 font-medium whitespace-nowrap">
                {page + 1}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isFetching}
                className="inline-flex flex-row items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="whitespace-nowrap">Sau</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Report Detail Modal */}
      <ReportDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailReportId(null);
        }}
        reportId={detailReportId}
        onOpenStatusDialog={(id) => {
          const rep = reports.find((r) => r.id === id);
          if (rep) handleOpenStatusDialog(rep);
        }}
        onViewReviewTarget={(targetReviewId) => {
          setInspectReviewId(targetReviewId);
        }}
      />

      {/* Update Report Status Dialog */}
      <UpdateReportStatusDialog
        isOpen={isStatusDialogOpen}
        onClose={() => {
          setIsStatusDialogOpen(false);
          setReportToUpdateStatus(null);
        }}
        report={reportToUpdateStatus}
        onConfirm={handleConfirmStatusUpdate}
        isLoading={updateReportStatusMutation.isPending}
      />

      {/* Review Target Inspection Modal */}
      <ReviewDetailModal
        isOpen={Boolean(inspectReviewId)}
        onClose={() => setInspectReviewId(null)}
        reviewId={inspectReviewId}
      />
    </div>
  );
}

export default AdminReportsPage;