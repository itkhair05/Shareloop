import { useId, useState } from 'react';
import { CheckCircle2, LifeBuoy, Lock, MessageSquare, X } from 'lucide-react';
import type { SupportRequestStatus } from '@/types/support';
import type { AdminSupportRequestResponse } from '@/types/admin-support';
import { useUpdateAdminSupportRequest } from '../hooks/use-admin-support';
import { formatSupportCategory } from '../utils/support-formatters';

export interface UpdateSupportStatusDialogProps {
  request: AdminSupportRequestResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UpdateSupportStatusDialog({
  request,
  isOpen,
  onClose,
}: UpdateSupportStatusDialogProps) {
  const statusId = useId();
  const responseId = useId();
  const notesId = useId();

  const [selectedStatus, setSelectedStatus] = useState<SupportRequestStatus>(
    request?.status || 'PENDING'
  );
  const [adminResponse, setAdminResponse] = useState(request?.adminResponse || '');
  const [adminNotes, setAdminNotes] = useState(request?.adminNotes || '');

  const updateMutation = useUpdateAdminSupportRequest();

  if (!isOpen || !request) return null;

  const isReopening =
    (request.status === 'RESOLVED' || request.status === 'CLOSED') &&
    (selectedStatus === 'PENDING' || selectedStatus === 'IN_PROGRESS');

  const willNotifyUser =
    selectedStatus !== request.status ||
    adminResponse.trim() !== (request.adminResponse || '').trim();

  const isResponseTooLong = adminResponse.length > 2000;
  const isNotesTooLong = adminNotes.length > 2000;
  const isSubmitDisabled =
    updateMutation.isPending || isResponseTooLong || isNotesTooLong;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;

    await updateMutation.mutateAsync({
      id: request.id,
      payload: {
        status: selectedStatus,
        adminResponse: adminResponse.trim(),
        adminNotes: adminNotes.trim(),
      },
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      role="dialog"
      aria-label="Cập nhật trạng thái và phản hồi hỗ trợ"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
              <LifeBuoy className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Xử lý yêu cầu hỗ trợ
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cập nhật trạng thái, gửi phản hồi tới người dùng và lưu ghi chú nội bộ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={updateMutation.isPending}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
            {/* Request Summary Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">
                  {formatSupportCategory(request.category).label}
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  ID: {request.id.slice(0, 8)}...
                </span>
              </div>
              <p className="font-medium text-slate-900 line-clamp-1">{request.subject}</p>
              <div className="text-slate-500 pt-1">
                Người gửi:{' '}
                <strong className="text-slate-800">
                  {request.requesterDisplayName || 'Ẩn danh'}
                </strong>{' '}
                ({request.requesterEmail || 'Không có email'})
              </div>
            </div>

            {/* Status Select */}
            <div className="space-y-1.5">
              <label
                htmlFor={statusId}
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
              >
                Trạng thái xử lý <span className="text-red-500">*</span>
              </label>
              <select
                id={statusId}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as SupportRequestStatus)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="PENDING">Chờ xử lý (PENDING)</option>
                <option value="IN_PROGRESS">Đang xử lý (IN_PROGRESS)</option>
                <option value="RESOLVED">Đã giải quyết (RESOLVED)</option>
                <option value="CLOSED">Đã đóng (CLOSED)</option>
              </select>

              {/* Status Change Notice */}
              {isReopening && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  <strong>Lưu ý:</strong> Chuyển trạng thái từ Đã giải quyết / Đã đóng về Chờ xử lý hoặc Đang xử lý sẽ xóa thông tin người giải quyết và thời gian hoàn tất trước đó.
                </p>
              )}
            </div>

            {/* Public Admin Response */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={responseId}
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Phản hồi công khai cho người dùng
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    isResponseTooLong ? 'text-red-600 font-bold' : 'text-slate-400'
                  }`}
                >
                  {adminResponse.length} / 2000
                </span>
              </div>
              <textarea
                id={responseId}
                rows={3}
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                placeholder="Nhập nội dung giải đáp hoặc hướng dẫn dành cho người dùng (nội dung này sẽ hiển thị cho người gửi)..."
                className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 resize-y ${
                  isResponseTooLong
                    ? 'border-red-400 focus:ring-red-400/20 focus:border-red-500'
                    : 'border-slate-300 focus:ring-emerald-500/20 focus:border-emerald-500'
                }`}
              />
              {isResponseTooLong && (
                <p className="text-[11px] text-red-600">
                  Phản hồi công khai không được vượt quá 2000 ký tự.
                </p>
              )}
            </div>

            {/* Internal Staff Notes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={notesId}
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  Ghi chú xử lý nội bộ (Bảo mật)
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    isNotesTooLong ? 'text-red-600 font-bold' : 'text-slate-400'
                  }`}
                >
                  {adminNotes.length} / 2000
                </span>
              </div>
              <textarea
                id={notesId}
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Ghi chú nghiệp vụ, đối soát lịch sử hoặc phân công giữa các quản trị viên (chỉ lưu nội bộ, không hiển thị cho người dùng)..."
                className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 resize-y font-mono ${
                  isNotesTooLong
                    ? 'border-red-400 focus:ring-red-400/20 focus:border-red-500'
                    : 'border-slate-300 focus:ring-amber-500/20 focus:border-amber-500'
                }`}
              />
              {isNotesTooLong && (
                <p className="text-[11px] text-red-600">
                  Ghi chú nội bộ không được vượt quá 2000 ký tự.
                </p>
              )}
            </div>

            {/* Notification hint */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              {willNotifyUser ? (
                <p className="text-emerald-700 font-medium">
                  ✓ Người dùng sẽ nhận được thông báo trong ứng dụng về cập nhật này.
                </p>
              ) : (
                <p className="text-slate-500 italic">
                  ℹ Chỉ cập nhật ghi chú nội bộ sẽ không gửi thông báo tới người dùng.
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-row flex-nowrap items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={updateMutation.isPending}
              className="inline-flex flex-row items-center justify-center h-10 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50"
            >
              <span className="whitespace-nowrap">Hủy bỏ</span>
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="inline-flex flex-row items-center justify-center gap-2 h-10 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? (
                <svg
                  className="animate-spin w-4 h-4 shrink-0"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span className="whitespace-nowrap">
                {updateMutation.isPending ? 'Đang lưu...' : 'Lưu cập nhật'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UpdateSupportStatusDialog;
