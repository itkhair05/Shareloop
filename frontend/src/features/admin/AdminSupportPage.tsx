import { useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  LifeBuoy,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/utils';
import { useAdminSupportRequests } from './hooks/use-admin-support';
import { formatSupportCategory, formatSupportStatus } from './utils/support-formatters';
import { SupportDetailModal } from './components/SupportDetailModal';
import { UpdateSupportStatusDialog } from './components/UpdateSupportStatusDialog';
import type { SupportCategory, SupportRequestStatus } from '@/types/support';
import type { AdminSupportRequestResponse } from '@/types/admin-support';

export function AdminSupportPage() {
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Modal states
  const [detailRequestId, setDetailRequestId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [selectedUpdateRequest, setSelectedUpdateRequest] =
    useState<AdminSupportRequestResponse | null>(null);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);

  const queryParams = {
    page,
    size,
    status: statusFilter !== 'ALL' ? (statusFilter as SupportRequestStatus) : undefined,
    category: categoryFilter !== 'ALL' ? (categoryFilter as SupportCategory) : undefined,
  };

  const { data, isLoading, isError, error, refetch, isFetching } =
    useAdminSupportRequests(queryParams);

  const requests = data?.content || [];
  const totalElements = data?.totalElements || 0;
  const totalPages = data?.totalPages || 0;

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setPage(0);
  };

  const handleCategoryFilterChange = (val: string) => {
    setCategoryFilter(val);
    setPage(0);
  };

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setPage(0);
  };

  const handleOpenDetail = (id: string) => {
    setDetailRequestId(id);
    setIsDetailOpen(true);
  };

  const handleOpenUpdateDialog = (req: AdminSupportRequestResponse) => {
    setSelectedUpdateRequest(req);
    setIsUpdateOpen(true);
  };

  const isFiltered = statusFilter !== 'ALL' || categoryFilter !== 'ALL';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Quản lý yêu cầu hỗ trợ
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tiếp nhận thắc mắc, xử lý sự cố giao dịch và hỗ trợ người dùng nền tảng
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap shadow-xs"
          >
            <RotateCw className={`w-3.5 h-3.5 shrink-0 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="filter-status-select"
                className="text-xs font-semibold text-slate-600 block mb-1"
              >
                Trạng thái yêu cầu
              </label>
              <select
                id="filter-status-select"
                aria-label="Trạng thái yêu cầu"
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="ALL">Tất cả trạng thái (4)</option>
                <option value="PENDING">Chờ xử lý (PENDING)</option>
                <option value="IN_PROGRESS">Đang xử lý (IN_PROGRESS)</option>
                <option value="RESOLVED">Đã giải quyết (RESOLVED)</option>
                <option value="CLOSED">Đã đóng (CLOSED)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-category-select"
                className="text-xs font-semibold text-slate-600 block mb-1"
              >
                Danh mục sự cố
              </label>
              <select
                id="filter-category-select"
                aria-label="Danh mục sự cố"
                value={categoryFilter}
                onChange={(e) => handleCategoryFilterChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="ALL">Tất cả danh mục (4)</option>
                <option value="TRANSACTION_ISSUE">Sự cố giao dịch (TRANSACTION_ISSUE)</option>
                <option value="ACCOUNT_ISSUE">Vấn đề tài khoản (ACCOUNT_ISSUE)</option>
                <option value="SAFETY_CONCERN">Mối ngại an toàn / Gian lận (SAFETY_CONCERN)</option>
                <option value="OTHER">Yêu cầu khác (OTHER)</option>
              </select>
            </div>
          </div>

          {/* Active Filter Indicators */}
          {isFiltered && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>Đang áp dụng bộ lọc tùy chỉnh</span>
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

      {/* Support Requests Data Table */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Yêu cầu & Danh mục
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Người gửi yêu cầu
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Trạng thái
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Thời gian gửi
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Cán bộ giải quyết
                </th>
                <th scope="col" className="px-4 py-3 text-right whitespace-nowrap w-[200px] min-w-[200px]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <div className="inline-block animate-spin w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full mb-2" />
                    <p className="text-xs">Đang tải danh sách yêu cầu hỗ trợ...</p>
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-red-600">
                    <div className="flex flex-col items-center gap-1.5">
                      <AlertCircle className="w-8 h-8" />
                      <p className="font-semibold text-sm">Không thể tải danh sách yêu cầu hỗ trợ</p>
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
              )}

              {!isLoading && !isError && requests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <LifeBuoy className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-sm text-slate-700">
                        Không tìm thấy yêu cầu hỗ trợ nào
                      </p>
                      <p className="text-xs text-slate-400">
                        Thử thay đổi hoặc đặt lại các bộ lọc đang chọn.
                      </p>
                      {isFiltered && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 inline-flex flex-row items-center justify-center gap-2 h-9 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                        >
                          <span className="whitespace-nowrap">Đặt lại bộ lọc</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Subject & Category */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge
                          variant={formatSupportCategory(req.category).variant}
                          className="text-[10px] px-1.5 py-0.5 whitespace-nowrap shrink-0"
                        >
                          {formatSupportCategory(req.category).label}
                        </Badge>
                      </div>
                      <div className="font-semibold text-slate-900 text-xs line-clamp-1 max-w-sm">
                        {req.subject}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1 max-w-sm mt-0.5">
                        {req.description}
                      </div>
                    </td>

                    {/* Requester Info */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800 text-xs">
                        {req.requesterDisplayName || 'Ẩn danh'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {req.requesterEmail || 'Chưa cung cấp'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Badge
                        variant={formatSupportStatus(req.status).variant}
                        className="text-[11px] whitespace-nowrap shrink-0"
                      >
                        {formatSupportStatus(req.status).label}
                      </Badge>
                    </td>

                    {/* Created Time */}
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(req.createdAt)}
                    </td>

                    {/* Resolver */}
                    <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {req.resolvedByDisplayName ? (
                        <span className="font-medium">{req.resolvedByDisplayName}</span>
                      ) : (
                        <span className="text-slate-400 italic">Chưa giải quyết</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap w-[200px] min-w-[200px]">
                      <div className="flex flex-row flex-nowrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(req.id)}
                          className="inline-flex flex-row items-center justify-center gap-1 h-8 px-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span className="whitespace-nowrap">Xem hồ sơ</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenUpdateDialog(req)}
                          className="inline-flex flex-row items-center justify-center h-8 px-2.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                        >
                          <span className="whitespace-nowrap">Xử lý</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {!isLoading && totalElements > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="whitespace-nowrap">
              Hiển thị trang <strong className="text-slate-900">{page + 1}</strong> /{' '}
              <strong className="text-slate-900">{Math.max(1, totalPages)}</strong> (Tổng cộng{' '}
              <strong className="text-slate-900">{totalElements}</strong> yêu cầu)
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

              <span className="px-2 font-medium whitespace-nowrap">{page + 1}</span>

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

      {/* Detail Modal */}
      <SupportDetailModal
        requestId={detailRequestId}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailRequestId(null);
        }}
        onOpenUpdateModal={(req) => {
          setSelectedUpdateRequest(req);
          setIsUpdateOpen(true);
        }}
      />

      {/* Update Dialog */}
      {selectedUpdateRequest && (
        <UpdateSupportStatusDialog
          key={selectedUpdateRequest.id}
          request={selectedUpdateRequest}
          isOpen={isUpdateOpen}
          onClose={() => {
            setIsUpdateOpen(false);
            setSelectedUpdateRequest(null);
          }}
        />
      )}
    </div>
  );
}

export default AdminSupportPage;
