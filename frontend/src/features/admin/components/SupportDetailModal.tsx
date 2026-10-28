import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  LifeBuoy,
  Lock,
  Mail,
  MessageSquare,
  RotateCcw,
  User,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';
import { useAdminSupportRequestDetail } from '../hooks/use-admin-support';
import { formatSupportCategory, formatSupportStatus } from '../utils/support-formatters';
import type { AdminSupportRequestResponse } from '@/types/admin-support';

export interface SupportDetailModalProps {
  requestId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenUpdateModal?: (request: AdminSupportRequestResponse) => void;
}

export function SupportDetailModal({
  requestId,
  isOpen,
  onClose,
  onOpenUpdateModal,
}: SupportDetailModalProps) {
  const { data: request, isLoading, isError, error, refetch } = useAdminSupportRequestDetail(
    isOpen ? requestId : null
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      role="dialog"
      aria-label="Chi tiết yêu cầu hỗ trợ"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
              <LifeBuoy className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Chi tiết yêu cầu hỗ trợ
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Hồ sơ tiếp nhận và phản hồi thắc mắc của người dùng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
            aria-label="Đóng chi tiết"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm">
          {isLoading && (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full" />
              <p className="text-xs">Đang tải thông tin yêu cầu hỗ trợ...</p>
            </div>
          )}

          {isError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 space-y-2 text-center">
              <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
              <p className="text-sm font-semibold">Không thể tải chi tiết yêu cầu hỗ trợ</p>
              <p className="text-xs text-red-600">{error?.message || 'Lỗi kết nối máy chủ'}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 inline-flex flex-row items-center justify-center gap-2 h-9 px-4 text-sm font-medium text-red-700 bg-white border border-red-300 hover:bg-red-100 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Thử lại</span>
              </button>
            </div>
          )}

          {request && (
            <>
              {/* Status and Category Ribbon */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={formatSupportCategory(request.category).variant}
                    className="text-xs px-2.5 py-0.5 whitespace-nowrap shrink-0"
                  >
                    {formatSupportCategory(request.category).label}
                  </Badge>
                  <Badge
                    variant={formatSupportStatus(request.status).variant}
                    className="text-xs px-2.5 py-0.5 whitespace-nowrap shrink-0"
                  >
                    {formatSupportStatus(request.status).label}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono text-[11px] text-slate-400">
                    ID: {request.id.slice(0, 8)}...
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(request.id, 'req-id')}
                    className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-[11px] cursor-pointer whitespace-nowrap"
                    title="Sao chép ID yêu cầu"
                  >
                    {copiedField === 'req-id' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700 font-medium">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 shrink-0" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Requester Information */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  Người gửi yêu cầu
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Họ và tên: </span>
                    <strong className="text-slate-900 font-semibold">
                      {request.requesterDisplayName || 'Không có tên hiển thị'}
                    </strong>
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-500">Email: </span>
                    <strong className="text-slate-900 font-semibold break-all">
                      {request.requesterEmail || 'Chưa cung cấp'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Related Transaction Context if present */}
              {request.transactionId && (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 space-y-2">
                  <div className="text-xs font-bold text-blue-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      Giao dịch liên quan
                    </span>
                    <Link
                      to={`/transactions/${request.transactionId}`}
                      className="text-xs text-blue-700 hover:text-blue-900 font-medium hover:underline flex items-center gap-1"
                    >
                      Xem chi tiết giao dịch
                    </Link>
                  </div>
                  <div className="flex items-center justify-between text-xs text-blue-800">
                    <span className="font-mono text-[11px] break-all">
                      Mã giao dịch: {request.transactionId}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(request.transactionId!, 'tx-id')}
                      className="text-blue-700 hover:text-blue-900 flex items-center gap-1 text-[11px] cursor-pointer whitespace-nowrap ml-2"
                    >
                      {copiedField === 'tx-id' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="text-emerald-700 font-medium">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 shrink-0" />
                          <span>Sao chép ID</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Request Subject & Description */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Nội dung yêu cầu
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <h3 className="font-bold text-slate-900 text-sm">{request.subject}</h3>
                  <p className="text-slate-700 text-xs whitespace-pre-wrap leading-relaxed">
                    {request.description}
                  </p>
                </div>
              </div>

              {/* Public Admin Response */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    Phản hồi công khai cho người dùng
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium border border-emerald-100">
                    Hiển thị với người gửi
                  </span>
                </div>
                {request.adminResponse ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {request.adminResponse}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 italic">
                    Chưa có phản hồi công khai nào từ ban quản trị
                  </div>
                )}
              </div>

              {/* Internal Confidential Staff Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    Ghi chú xử lý nội bộ (Bảo mật)
                  </div>
                  <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                    Dành riêng cho Quản trị viên
                  </span>
                </div>
                {request.adminNotes ? (
                  <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-950 whitespace-pre-wrap leading-relaxed font-mono">
                    {request.adminNotes}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 italic">
                    Chưa có ghi chú nội bộ cho yêu cầu này
                  </div>
                )}
              </div>

              {/* Resolution Info if present */}
              {request.resolvedByDisplayName && (
                <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>
                      Cán bộ giải quyết:{' '}
                      <strong className="text-slate-900 font-semibold">
                        {request.resolvedByDisplayName}
                      </strong>
                    </span>
                    {request.resolvedAt && (
                      <span className="text-slate-500">
                        Thời gian: {formatDateTime(request.resolvedAt)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  Ngày gửi: {formatDateTime(request.createdAt)}
                </span>
                <span className="whitespace-nowrap">
                  Cập nhật: {formatDateTime(request.updatedAt)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 gap-3">
          <div>
            {request && onOpenUpdateModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenUpdateModal(request);
                }}
                className="inline-flex flex-row items-center justify-center gap-1.5 h-9 px-3.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-xs"
              >
                <span>Xử lý yêu cầu này</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex flex-row items-center justify-center h-9 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <span className="whitespace-nowrap">Đóng</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SupportDetailModal;
